import { DEFAULT_TEMPLATES } from "../shared/templates.js";
import { normalizeValues, renderPrompt } from "../shared/render.js";
import { copyTextToClipboard } from "../shared/clipboard.js";
import { getLocal, removeLocal, setLocal, storageErrorToUserMessage } from "../shared/storage.js";
import { sanitizeTemplates, validateTemplate } from "../shared/template_validation.js";
import { parseMasterPrompt } from "../shared/prompt_syntax.js";
import { computeTemplateSelectList, splitFavorites } from "./template_select.js";
import { isTauri, tauriInvoke, tauriListen } from "../shared/tauri.js";

const KEY_SELECTED_TEMPLATE = "pg.selectedTemplateId";
const KEY_CUSTOM_TEMPLATES = "pg.customTemplates";
const KEY_TEMPLATE_OVERRIDES = "pg.templateOverrides";
const KEY_PENDING_UPDATE = "pg.pendingUpdate";
const KEY_FAVORITE_TEMPLATE_IDS = "pg.favoriteTemplateIds";

const DEBUG_RENDER_TIMING = false;

function valuesKey(templateId) {
  return `pg.values.${templateId}`;
}

function clampString(s, maxLen) {
  const str = typeof s === "string" ? s : "";
  if (!maxLen) return str;
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

let statusTimer = null;
function setStatus(text) {
  const el = document.getElementById("status");
  el.textContent = text || "";

  if (statusTimer) clearTimeout(statusTimer);
  if (text) {
    statusTimer = setTimeout(() => {
      if (el.textContent === text) {
        el.textContent = "";
      }
    }, 5000);
  }
}

let lastStorageWriteStatusAt = 0;
let lastStorageWriteStatusText = "";

function reportStorageWriteFailure(action, err) {
  console.warn(`${action} failed:`, err);
  const text = storageErrorToUserMessage(err, action);

  const now = Date.now();
  if (text && text === lastStorageWriteStatusText && now - lastStorageWriteStatusAt < 4000) {
    return;
  }

  lastStorageWriteStatusAt = now;
  lastStorageWriteStatusText = text;
  setStatus(text);
}

function ensureTemplateWarningEl() {
  let el = document.getElementById("templateWarning");
  if (el) return el;

  el = document.createElement("div");
  el.id = "templateWarning";
  el.style.margin = "8px 0 10px";
  el.style.fontSize = "12px";
  el.style.color = "#ffb4b4";
  el.style.border = "1px solid #5a2a2a";
  el.style.background = "#241417";
  el.style.borderRadius = "10px";
  el.style.padding = "8px 10px";
  el.style.display = "none";

  const desc = document.getElementById("templateDesc");
  if (desc?.parentElement) {
    desc.insertAdjacentElement("afterend", el);
  } else {
    document.body.appendChild(el);
  }

  return el;
}

let baseTemplateWarningText = "";

function setTemplateWarning(text) {
  const el = ensureTemplateWarningEl();
  if (!text) {
    el.textContent = "";
    el.style.display = "none";
    return;
  }
  el.textContent = text;
  el.style.display = "block";
}

function summarizeMasterFieldConsistencyWarnings(warnings) {
  const items = Array.isArray(warnings)
    ? warnings.filter((w) => typeof w === "string" && w.startsWith("[정합성]"))
    : [];

  if (items.length === 0) return "";

  const maxLines = 2;
  const lines = items.slice(0, maxLines).map((w) => w.replace(/^\[정합성\]\s*/, "정합성: "));
  if (items.length > maxLines) {
    lines.push(`정합성 경고 ${items.length}건 중 ${maxLines}건만 표시합니다.`);
  }

  return lines.join("\n");
}

function updateTemplateWarningForCurrentTemplate(template) {
  const t = template || currentTemplate();
  const res = validateTemplate(t);

  const consistencyText = summarizeMasterFieldConsistencyWarnings(res?.warnings);
  const parts = [];
  if (baseTemplateWarningText) parts.push(baseTemplateWarningText);
  if (consistencyText) parts.push(consistencyText);

  setTemplateWarning(parts.join("\n"));
}

function selectPreviewText() {
  const preview = document.getElementById("preview");
  if (!preview) return;

  try {
    preview.focus();
    preview.select();
    preview.setSelectionRange(0, preview.value.length);
  } catch {
    // ignore
  }
}

function setErrors(errors) {
  const root = document.getElementById("errorsRoot");
  root.innerHTML = "";
  if (!errors || errors.length === 0) {
    root.classList.add("hidden");
    return;
  }
  root.classList.remove("hidden");

  const title = document.createElement("div");
  title.className = "errors-title";
  title.textContent = "검증 오류";
  root.appendChild(title);

  const ul = document.createElement("ul");
  for (const e of errors) {
    const li = document.createElement("li");
    li.textContent = e;
    ul.appendChild(li);
  }
  root.appendChild(ul);
}

function badge(required) {
  const span = document.createElement("span");
  span.className = `badge ${required ? "badge-required" : "badge-optional"}`;
  span.textContent = required ? "필수" : "선택";
  return span;
}

function defaultValues(template) {
  const v = {};
  for (const field of template.fields) {
    if (field.kind === "text") v[field.id] = "";
    else if (field.kind === "single")
      v[field.id] = field.defaultValue ?? (field.allowNone ? "" : "");
    else if (field.kind === "multi") v[field.id] = [];
  }
  return normalizeValues(template, v);
}

let state = {
  templates: deepClone(DEFAULT_TEMPLATES),
  templateId: DEFAULT_TEMPLATES[0]?.id ?? "pixel-sprite-db16",
  values: {}
};

let fieldUi = new Map();

let templateSearchQuery = "";
let favoriteTemplateIds = new Set();

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await setLocal({
        [KEY_SELECTED_TEMPLATE]: state.templateId,
        [valuesKey(state.templateId)]: state.values
      });
    } catch (e) {
      reportStorageWriteFailure("자동 저장", e);
    }
  }, 200);
}

async function resetCurrentTemplateValues() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const template = ensureParsedTemplate(currentTemplate());
  state.values = defaultValues(template);

  for (const field of template.fields) {
    syncFieldUi(field.id);
  }
  renderPreview(template);

  try {
    await setLocal({
      [KEY_SELECTED_TEMPLATE]: state.templateId,
      [valuesKey(state.templateId)]: state.values
    });
    setStatus("기본값으로 초기화했습니다.");
  } catch (e) {
    reportStorageWriteFailure("값 초기화 저장", e);
  }
}

function getTemplateById(id) {
  return state.templates.find((t) => t.id === id) || state.templates[0];
}

function currentTemplate() {
  return getTemplateById(state.templateId);
}

function ensureParsedTemplate(t) {
  if (!t || typeof t !== "object") return t;
  if (Array.isArray(t.fields) && t.fields.length > 0) return t;
  if (typeof t.master !== "string" || !t.master.trim()) return t;

  const res = parseMasterPrompt(t.master);
  if (!res.ok || !Array.isArray(res.fields) || res.fields.length === 0) return t;

  t.master = res.master;
  t.fields = res.fields;
  return t;
}

function setTemplateSelectValue() {
  const select = document.getElementById("templateSelect");
  if (!select) return;
  select.value = state.templateId;
}

function updateFavoriteButton() {
  const btn = document.getElementById("favoriteBtn");
  if (!btn) return;

  const isFav = favoriteTemplateIds.has(state.templateId);
  btn.setAttribute("aria-pressed", isFav ? "true" : "false");
  btn.textContent = isFav ? "★" : "☆";
  btn.title = isFav ? "즐겨찾기 해제" : "즐겨찾기 추가";
}

async function toggleFavoriteForCurrentTemplate() {
  const id = state.templateId;
  if (!id) return;

  const wasFav = favoriteTemplateIds.has(id);
  if (wasFav) favoriteTemplateIds.delete(id);
  else favoriteTemplateIds.add(id);

  updateFavoriteButton();
  renderTemplateSelect();

  try {
    await setLocal({ [KEY_FAVORITE_TEMPLATE_IDS]: Array.from(favoriteTemplateIds) });
    setStatus(wasFav ? "즐겨찾기에서 제거했습니다." : "즐겨찾기에 추가했습니다.");
  } catch (e) {
    if (wasFav) favoriteTemplateIds.add(id);
    else favoriteTemplateIds.delete(id);

    updateFavoriteButton();
    renderTemplateSelect();
    reportStorageWriteFailure("즐겨찾기 저장", e);
  }
}

function updateTemplateSearchStatus(query, matchCount) {
  const searchMsg =
    "검색 결과가 없습니다. 검색어를 지우면 전체 템플릿이 다시 표시됩니다.";

  const cur = document.getElementById("status")?.textContent ?? "";
  const isSearchStatus = cur === searchMsg || cur.startsWith("검색 결과가 없습니다");

  if (query && matchCount === 0) {
    const now = Date.now();
    const isRecentStorageWriteStatus =
      cur &&
      cur === lastStorageWriteStatusText &&
      now - lastStorageWriteStatusAt < 4000;

    if (!isRecentStorageWriteStatus) setStatus(searchMsg);
    return;
  }

  if (isSearchStatus) setStatus("");
}

function renderTemplateSelect() {
  const select = document.getElementById("templateSelect");
  if (!select) return;
  select.innerHTML = "";

  const { query, matchCount, list } = computeTemplateSelectList({
    templates: state.templates,
    selectedId: state.templateId,
    query: templateSearchQuery
  });

  const { favorites, rest } = splitFavorites(list, favoriteTemplateIds);

  const appendOptions = (root, items) => {
    for (const t of items) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      root.appendChild(opt);
    }
  };

  if (favorites.length) {
    const g = document.createElement("optgroup");
    g.label = "즐겨찾기";
    appendOptions(g, favorites);
    select.appendChild(g);
  }

  if (rest.length) {
    const g = document.createElement("optgroup");
    g.label = favorites.length ? "전체" : "템플릿";
    appendOptions(g, rest);
    select.appendChild(g);
  }

  setTemplateSelectValue();
  updateFavoriteButton();
  select.onchange = async (e) => {
    const nextId = e.target.value;
    await switchTemplate(nextId);
  };

  updateTemplateSearchStatus(query, matchCount);
}

function renderDesc(template) {
  const desc = document.getElementById("templateDesc");
  desc.textContent = template.description || "";
}

function syncFieldUi(fieldId) {
  const ui = fieldUi.get(fieldId);
  if (ui?.update) ui.update();
}

function buildFields(template) {
  const root = document.getElementById("fieldsRoot");
  root.innerHTML = "";
  fieldUi = new Map();

  for (const field of template.fields) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const header = document.createElement("div");
    header.className = "field-header";

    const title = document.createElement("div");
    title.className = "field-title";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = field.label;
    title.appendChild(labelSpan);
    title.appendChild(badge(!!field.required));

    header.appendChild(title);
    wrap.appendChild(header);

    const raw = state.values[field.id];

    if (field.kind === "text") {
      const input = document.createElement("input");
      input.className = "input";
      input.value = typeof raw === "string" ? raw : "";
      input.placeholder = field.placeholder || "";
      input.addEventListener("input", (ev) => {
        const v = clampString(ev.target.value, field.maxLen);
        state.values[field.id] = v;
        scheduleSave();
        renderPreview(template);
      });
      wrap.appendChild(input);

      fieldUi.set(field.id, {
        update: () => {
          if (document.activeElement === input) return;
          const next = typeof state.values[field.id] === "string" ? state.values[field.id] : "";
          if (input.value !== next) input.value = next;
        }
      });
    } else if (field.kind === "single") {
      const row = document.createElement("div");
      row.className = "button-row";

      const buttons = [];
      const update = () => {
        const cur = typeof state.values[field.id] === "string" ? state.values[field.id] : "";
        for (const b of buttons) {
          b.el.classList.toggle("btn-selected", cur === b.value);
        }
      };

      if (field.allowNone) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = field.noneLabel || "(없음)";
        b.addEventListener("click", () => {
          state.values[field.id] = "";
          scheduleSave();
          update();
          renderPreview(template);
        });
        buttons.push({ value: "", el: b });
        row.appendChild(b);
      }

      const opts = Array.isArray(field.options) ? field.options : [];
      for (const opt of opts) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = opt.label;
        b.addEventListener("click", () => {
          state.values[field.id] = opt.value;
          scheduleSave();
          update();
          renderPreview(template);
        });
        buttons.push({ value: opt.value, el: b });
        row.appendChild(b);
      }

      update();
      wrap.appendChild(row);
      fieldUi.set(field.id, { update });
    } else if (field.kind === "multi") {
      const row = document.createElement("div");
      row.className = "button-row";

      const buttons = [];
      const update = () => {
        const arr = Array.isArray(state.values[field.id]) ? state.values[field.id] : [];
        for (const b of buttons) {
          b.el.classList.toggle("btn-selected", arr.includes(b.value));
        }
      };

      const opts = Array.isArray(field.options) ? field.options : [];
      for (const opt of opts) {
        const selected = Array.isArray(raw) ? raw.includes(opt.value) : false;
        const b = document.createElement("button");
        b.type = "button";
        b.className = `btn ${selected ? "btn-selected" : ""}`;
        b.textContent = opt.label;
        b.addEventListener("click", () => {
          const curArr = Array.isArray(state.values[field.id]) ? state.values[field.id] : [];
          const wasSelected = curArr.includes(opt.value);
          const next = wasSelected
            ? curArr.filter((x) => x !== opt.value)
            : [...curArr, opt.value];
          state.values[field.id] = next;
          scheduleSave();
          b.classList.toggle("btn-selected", !wasSelected);
          renderPreview(template);
        });
        buttons.push({ value: opt.value, el: b });
        row.appendChild(b);
      }

      update();
      wrap.appendChild(row);
      fieldUi.set(field.id, { update });
    }

    if (field.help) {
      const help = document.createElement("div");
      help.className = "help";
      help.textContent = field.help;
      wrap.appendChild(help);
    }

    root.appendChild(wrap);
  }
}

function renderPreview(template) {
  const preview = document.getElementById("preview");
  const t0 = DEBUG_RENDER_TIMING ? performance.now() : 0;
  const res = renderPrompt(template, state.values);
  preview.value = res.prompt;
  setErrors(res.errors);
  state.values = res.values;
  if (DEBUG_RENDER_TIMING) {
    const dt = performance.now() - t0;
    console.log(`[renderPreview] ${dt.toFixed(2)}ms`);
  }
}

function renderForTemplateSwitch() {
  const template = ensureParsedTemplate(currentTemplate());
  setTemplateSelectValue();
  updateFavoriteButton();
  renderDesc(template);
  buildFields(template);
  renderPreview(template);
  updateTemplateWarningForCurrentTemplate(template);
}

async function switchTemplate(nextId) {
  const template = ensureParsedTemplate(getTemplateById(nextId));
  state.templateId = template.id;

  try {
    const data = await getLocal([valuesKey(template.id)]);
    const saved = data[valuesKey(template.id)];
    if (saved && typeof saved === "object") {
      state.values = normalizeValues(template, saved);
    } else {
      state.values = defaultValues(template);
    }
  } catch {
    state.values = defaultValues(template);
  }

  renderForTemplateSwitch();
  scheduleSave();
}

async function applyPendingUpdateIfAny() {
  let pending;
  try {
    const data = await getLocal([KEY_PENDING_UPDATE]);
    pending = data[KEY_PENDING_UPDATE];
  } catch {
    return;
  }

  if (!pending || typeof pending !== "object") return;

  const { fieldId, value } = pending;
  if (typeof fieldId === "string" && typeof value === "string") {
    state.values[fieldId] = value;
    scheduleSave();
    syncFieldUi(fieldId);
    renderPreview(currentTemplate());
    setStatus("선택 텍스트를 에셋(ASSET)에 반영했습니다.");
  }

  try {
    await removeLocal([KEY_PENDING_UPDATE]);
  } catch (e) {
    reportStorageWriteFailure("저장 데이터 정리", e);
  }
}

async function init() {
  try {
    const data = await getLocal([
      KEY_CUSTOM_TEMPLATES,
      KEY_TEMPLATE_OVERRIDES,
      KEY_SELECTED_TEMPLATE,
      KEY_FAVORITE_TEMPLATE_IDS
    ]);
    const baseTemplates = deepClone(DEFAULT_TEMPLATES);
    const custom = data[KEY_CUSTOM_TEMPLATES];
    const rawOverrides = data[KEY_TEMPLATE_OVERRIDES];

    const rawFavorites = data[KEY_FAVORITE_TEMPLATE_IDS];
    favoriteTemplateIds = new Set(
      Array.isArray(rawFavorites) ? rawFavorites.filter((x) => typeof x === "string" && x) : []
    );

    const defaultIds = new Set(baseTemplates.map((t) => t.id));
    const overrides = new Map();
    const overrideErrors = [];
    const overrideWarnings = [];
    let overrideInvalidCount = 0;
    let overrideTotalCount = 0;

    if (rawOverrides !== undefined) {
      if (!isPlainObject(rawOverrides)) {
        overrideErrors.push("templateOverrides 항목은 객체여야 합니다.");
      } else {
        const entries = Object.entries(rawOverrides);
        overrideTotalCount = entries.length;
        for (const [id, raw] of entries) {
          if (!defaultIds.has(id)) {
            overrideWarnings.push(`templateOverrides["${id}"]는 기본 템플릿 ID가 아니므로 무시합니다.`);
            continue;
          }

          const rawTemplate = isPlainObject(raw) ? { ...raw, id } : { id };
          const res = validateTemplate(rawTemplate);
          if (!res.ok) {
            overrideInvalidCount++;
            overrideErrors.push(...res.errors.map((e) => `templateOverrides["${id}"]: ${e}`));
            overrideWarnings.push(...res.warnings.map((w) => `templateOverrides["${id}"]: ${w}`));
            continue;
          }

          overrides.set(id, res.template);
          overrideWarnings.push(...res.warnings.map((w) => `templateOverrides["${id}"]: ${w}`));
        }

        // Apply overrides to defaults (replace by id)
        for (let i = 0; i < baseTemplates.length; i++) {
          const id = baseTemplates[i].id;
          const ov = overrides.get(id);
          if (ov) baseTemplates[i] = deepClone(ov);
        }
      }
    }

    baseTemplateWarningText = "";
    const warningParts = [];
    if (overrideInvalidCount > 0) {
      warningParts.push(
        `형식 오류로 제외된 기본 템플릿 수정본이 있습니다 (${overrideInvalidCount}/${overrideTotalCount}).`
      );
    }
    if (overrideErrors.length || overrideWarnings.length) {
      console.warn("templateOverrides validation:", {
        errors: overrideErrors,
        warnings: overrideWarnings
      });
    }

    if (Array.isArray(custom) && custom.length > 0) {
      const res = sanitizeTemplates(custom, {
        reservedIds: new Set(baseTemplates.map((t) => t.id))
      });

      if (res.templates.length > 0) state.templates = [...baseTemplates, ...res.templates];
      else state.templates = baseTemplates;

      if (res.invalidCount > 0) {
        warningParts.push(`형식 오류로 제외된 사용자 템플릿이 있습니다 (${res.invalidCount}/${res.totalCount}).`);
      }

      if (res.errors.length || res.warnings.length) {
        console.warn("customTemplates validation:", { errors: res.errors, warnings: res.warnings });
      }
    } else {
      state.templates = baseTemplates;
    }

    if (warningParts.length) {
      baseTemplateWarningText = `${warningParts.join(" ")} 기본 템플릿을 사용할 수 있습니다.`;
    }

    const sel = data[KEY_SELECTED_TEMPLATE];
    if (typeof sel === "string" && state.templates.some((t) => t.id === sel)) {
      state.templateId = sel;
    } else {
      state.templateId = state.templates[0].id;
    }
  } catch {
    baseTemplateWarningText = "";
    favoriteTemplateIds = new Set();
    state.templates = deepClone(DEFAULT_TEMPLATES);
    state.templateId = state.templates[0].id;
  }

  const template = currentTemplate();
  try {
    const data = await getLocal([valuesKey(template.id)]);
    const saved = data[valuesKey(template.id)];
    if (saved && typeof saved === "object") {
      state.values = normalizeValues(template, saved);
    } else {
      state.values = defaultValues(template);
    }
  } catch {
    state.values = defaultValues(template);
  }

  renderTemplateSelect();
  renderForTemplateSwitch();
  await applyPendingUpdateIfAny();

  const search = document.getElementById("templateSearch");
  if (search) {
    search.addEventListener("input", (e) => {
      templateSearchQuery = e.target.value;
      renderTemplateSelect();
    });
  }

  const favBtn = document.getElementById("favoriteBtn");
  if (favBtn) {
    favBtn.addEventListener("click", async () => {
      await toggleFavoriteForCurrentTemplate();
    });
  }

  document.getElementById("openOptionsBtn").addEventListener("click", () => {
    window.location.href = "../options/options.html";
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const t = currentTemplate();
    const res = renderPrompt(t, state.values);
    if (!res.ok) {
      setStatus("필수 항목을 먼저 채워주세요.");
      return;
    }

    const result = await copyTextToClipboard(res.prompt);
    if (result.ok) {
      const methodText = result.method === "execCommand" ? " (호환 모드)" : "";
      setStatus(`클립보드에 복사했습니다.${methodText}`);
      return;
    }

    console.warn("copy failed:", result);
    selectPreviewText();
    setStatus("복사 실패: 미리보기 텍스트를 선택했습니다. Ctrl/⌘+C로 수동 복사하세요.");
  });

  document.getElementById("selectPreviewBtn").addEventListener("click", () => {
    selectPreviewText();
    setStatus("미리보기 텍스트를 선택했습니다. Ctrl/⌘+C로 복사하세요.");
  });

  document.getElementById("resetValuesBtn").addEventListener("click", async () => {
    await resetCurrentTemplateValues();
  });

  window.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      document.getElementById("copyBtn").click();
    }
  });

  if (isTauri()) {
    try {
      await tauriListen("PG_SET_FIELD", (event) => {
        try {
          const msg = event?.payload ?? null;
          if (msg?.type === "PG_SET_FIELD" && typeof msg.fieldId === "string") {
            state.values[msg.fieldId] = String(msg.value ?? "");
            scheduleSave();
            syncFieldUi(msg.fieldId);
            renderPreview(currentTemplate());
            setStatus(`필드(${msg.fieldId})를 업데이트했습니다.`);
          }
        } catch {
          // ignore
        }
      });
    } catch (e) {
      console.warn("tauri event listen failed:", e);
    }
  }

  // Resizer drag functionality
  setupResizer();
}

const KEY_PANEL_WIDTH = "pg.panelWidth";

function setupResizer() {
  const resizer = document.getElementById("resizer");
  const leftPanel = document.getElementById("leftPanel");
  const main = document.querySelector(".main");

  if (!resizer || !leftPanel || !main) return;

  // Restore saved width
  try {
    const saved = localStorage.getItem(KEY_PANEL_WIDTH);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= 150) {
        leftPanel.style.width = `${width}px`;
      }
    }
  } catch {
    // ignore
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = leftPanel.getBoundingClientRect().width;

    resizer.classList.add("active");
    document.body.classList.add("resizing");
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const mainRect = main.getBoundingClientRect();
    const maxWidth = mainRect.width - 180; // min 150px for right + 8px resizer + padding
    const minWidth = 150;

    let newWidth = startWidth + dx;
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    leftPanel.style.width = `${newWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) return;

    isResizing = false;
    resizer.classList.remove("active");
    document.body.classList.remove("resizing");

    // Save width
    try {
      const width = leftPanel.getBoundingClientRect().width;
      localStorage.setItem(KEY_PANEL_WIDTH, String(Math.round(width)));
    } catch {
      // ignore
    }
  });
}

init().catch((e) => {
  console.error("init failed:", e);
  setStatus("초기화 실패: 콘솔을 확인하세요.");
});
