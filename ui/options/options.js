import { DEFAULT_TEMPLATES } from "../shared/templates.js";
import { getLocal, setLocal, storageErrorToUserMessage } from "../shared/storage.js";
import { sanitizeTemplates, validateTemplate } from "../shared/template_validation.js";
import { parseMasterPrompt } from "../shared/prompt_syntax.js";
import { wireQuickOptions } from "./quick_options.js";
import { createPersistence } from "./persistence.js";
import { downloadTextFile, el, setBox, setGlobalStatus } from "./ui.js";
import {
  makeUniqueId,
  nonEmptyString,
  reservedCustomIdsExcluding,
  uniqueImportedId
} from "./id_utils.js";

const KEY_CUSTOM_TEMPLATES = "pg.customTemplates";
const KEY_TEMPLATE_OVERRIDES = "pg.templateOverrides";

const DEFAULT_IDS = new Set((DEFAULT_TEMPLATES || []).map((t) => t.id));

const state = {
  templates: [],
  customTemplates: [],
  overrides: new Map(),
  selectedId: null,
  quickOptions: {
    nextIndex: 1,
    items: []
  }
};

function isDefaultTemplateId(id) {
  return DEFAULT_IDS.has(id);
}

const { persistCustomTemplates, persistOverrides, persistAll } = createPersistence({
  state,
  setLocal,
  setGlobalStatus,
  storageErrorToUserMessage,
  KEY_CUSTOM_TEMPLATES,
  KEY_TEMPLATE_OVERRIDES
});

function clearEditor() {
  el("idInput").disabled = false;
  el("idInput").value = "";
  el("nameInput").value = "";
  el("descInput").value = "";
  el("masterInput").value = "";
  el("fieldsInput").value = "[]";
  setBox("formErrors", "오류", []);
  setBox("formWarnings", "경고", []);
}

function fillEditor(t) {
  el("idInput").disabled = isDefaultTemplateId(t?.id ?? "");
  el("idInput").value = t?.id ?? "";
  el("nameInput").value = t?.name ?? "";
  el("descInput").value = t?.description ?? "";
  el("masterInput").value = t?.master ?? "";
  el("fieldsInput").value = JSON.stringify(t?.fields ?? [], null, 2);
  setBox("formErrors", "오류", []);
  setBox("formWarnings", "경고", []);
}

function renderList() {
  const list = el("templateList");
  list.innerHTML = "";

  for (const t of state.templates) {
    const li = document.createElement("li");
    li.className = `template-item ${t.id === state.selectedId ? "selected" : ""}`;

    const meta = document.createElement("div");
    meta.className = "template-meta";

    const name = document.createElement("div");
    name.className = "template-name";
    name.textContent = isDefaultTemplateId(t.id) ? `${t.name} (기본)` : t.name;

    const id = document.createElement("div");
    id.className = "template-id";
    id.textContent = t.id;

    meta.appendChild(name);
    meta.appendChild(id);
    li.appendChild(meta);

    li.addEventListener("click", () => {
      selectTemplate(t.id);
    });

    list.appendChild(li);
  }
}

function selectTemplate(id) {
  const t = state.templates.find((x) => x.id === id);
  state.selectedId = t?.id ?? null;
  renderList();
  if (t) fillEditor(t);
  else clearEditor();
  updateButtonsForSelection();
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeDefaultOverrides(rawOverrides) {
  const overrides = new Map();
  const errors = [];
  const warnings = [];

  if (rawOverrides === undefined) {
    return { overrides, invalidCount: 0, totalCount: 0, errors, warnings };
  }

  if (!isPlainObject(rawOverrides)) {
    return {
      overrides,
      invalidCount: 0,
      totalCount: 0,
      errors: ["templateOverrides 항목은 객체여야 합니다."],
      warnings: []
    };
  }

  const entries = Object.entries(rawOverrides);
  let invalidCount = 0;

  for (const [id, raw] of entries) {
    if (!isDefaultTemplateId(id)) {
      warnings.push(`templateOverrides["${id}"]는 기본 템플릿 ID가 아니므로 무시합니다.`);
      continue;
    }

    const rawTemplate = isPlainObject(raw) ? { ...raw, id } : { id };
    const res = validateTemplate(rawTemplate);
    if (!res.ok) {
      invalidCount++;
      errors.push(...res.errors.map((e) => `templateOverrides["${id}"]: ${e}`));
      warnings.push(...res.warnings.map((w) => `templateOverrides["${id}"]: ${w}`));
      continue;
    }

    overrides.set(id, res.template);
    warnings.push(...res.warnings.map((w) => `templateOverrides["${id}"]: ${w}`));
  }

  return { overrides, invalidCount, totalCount: entries.length, errors, warnings };
}

function rebuildTemplates() {
  const defaults = (DEFAULT_TEMPLATES || []).map((t) => state.overrides.get(t.id) ?? t);
  state.templates = [...defaults, ...state.customTemplates];
}

function updateButtonsForSelection() {
  const cur = state.templates.find((t) => t.id === state.selectedId);
  const deleteBtn = el("deleteBtn");
  const cloneBtn = el("cloneBtn");

  if (!cur) {
    deleteBtn.textContent = "삭제";
    deleteBtn.disabled = true;
    cloneBtn.disabled = true;
    return;
  }

  cloneBtn.disabled = false;

  if (isDefaultTemplateId(cur.id)) {
    deleteBtn.textContent = "기본값으로 복원";
    deleteBtn.disabled = !state.overrides.has(cur.id);
  } else {
    deleteBtn.textContent = "삭제";
    deleteBtn.disabled = false;
  }
}

async function loadTemplates() {
  console.log("loadTemplates started");
  setGlobalStatus("");

  const prevSelected = state.selectedId;
  const data = await getLocal({
    [KEY_CUSTOM_TEMPLATES]: [],
    [KEY_TEMPLATE_OVERRIDES]: {}
  });

  const rawCustom = data?.[KEY_CUSTOM_TEMPLATES];
  const rawOverrides = data?.[KEY_TEMPLATE_OVERRIDES];

  console.log("loadTemplates: raw data", { customCount: rawCustom?.length, overrideCount: Object.keys(rawOverrides || {}).length });

  const customRes =
    rawCustom === undefined || rawCustom === null
      ? { templates: [], invalidCount: 0, totalCount: 0, errors: [], warnings: [] }
      : sanitizeTemplates(rawCustom, { reservedIds: DEFAULT_IDS });

  const overridesRes = sanitizeDefaultOverrides(rawOverrides);

  state.customTemplates = customRes.templates;
  state.overrides = overridesRes.overrides;
  rebuildTemplates();

  const nextId =
    typeof prevSelected === "string" && state.templates.some((t) => t.id === prevSelected)
      ? prevSelected
      : state.templates[0]?.id ?? null;

  selectTemplate(nextId);

  const msgs = [];
  if (overridesRes.invalidCount > 0) {
    msgs.push(
      `형식 오류로 제외된 기본 템플릿 수정본: ${overridesRes.invalidCount}/${overridesRes.totalCount}`
    );
  }
  if (customRes.invalidCount > 0) {
    msgs.push(`형식 오류로 제외된 사용자 템플릿: ${customRes.invalidCount}/${customRes.totalCount}`);
  }

  if (msgs.length || overridesRes.errors.length || customRes.errors.length) {
    setGlobalStatus(`${msgs.join(" / ")}. 자세한 내용은 콘솔을 확인하세요.`);
    if (overridesRes.errors.length || overridesRes.warnings.length) {
      console.warn("templateOverrides load warnings:", overridesRes);
    }
    if (customRes.errors.length || customRes.warnings.length) {
      console.warn("customTemplates load warnings:", customRes);
    }
    return;
  }

  setGlobalStatus(
    `템플릿을 불러왔습니다. (기본 ${(DEFAULT_TEMPLATES || []).length}개, 사용자 ${state.customTemplates.length}개)`
  );
}

async function onNew() {
  console.log("onNew started");
  const reserved = reservedCustomIdsExcluding({
    defaultIds: DEFAULT_IDS,
    customTemplates: state.customTemplates,
    currentId: null
  });
  const id = makeUniqueId("custom-template", reserved);

  const draft = {
    id,
    name: "사용자 템플릿",
    description: "",
    master: "ASSET: {{asset}}",
    fields: [{ id: "asset", label: "에셋(ASSET)", kind: "text", required: true }]
  };

  const res = validateTemplate(draft, { reservedIds: reserved });
  if (!res.ok) {
    console.warn("onNew: validation failed", res.errors);
    setBox("formErrors", "오류", res.errors);
    setBox("formWarnings", "경고", res.warnings);
    return;
  }

  console.log("onNew: creating", res.template.id);
  state.customTemplates = [res.template, ...state.customTemplates];
  rebuildTemplates();
  selectTemplate(res.template.id);

  const persisted = await persistCustomTemplates("저장");
  if (persisted) {
    setGlobalStatus("새 템플릿을 만들었습니다.");
  } else {
    console.error("onNew: persistence failed");
  }
}

async function onClone() {
  console.log("onClone started");
  const cur = state.templates.find((t) => t.id === state.selectedId);
  if (!cur) return;

  const reserved = reservedCustomIdsExcluding({
    defaultIds: DEFAULT_IDS,
    customTemplates: state.customTemplates,
    currentId: null
  });
  const id = makeUniqueId(`${cur.id}-copy`, reserved);

  const draft = JSON.parse(JSON.stringify(cur));
  draft.id = id;
  draft.name = `${cur.name} (복사본)`;

  const res = validateTemplate(draft, { reservedIds: reserved });
  if (!res.ok) {
    console.warn("onClone: validation failed", res.errors);
    setBox("formErrors", "오류", res.errors);
    setBox("formWarnings", "경고", res.warnings);
    return;
  }

  console.log("onClone: creating", res.template.id);
  state.customTemplates = [res.template, ...state.customTemplates];
  rebuildTemplates();
  selectTemplate(res.template.id);

  const persisted = await persistCustomTemplates("저장");
  if (persisted) {
    setGlobalStatus("템플릿을 복제했습니다.");
  }
}

async function onDelete() {
  console.log("onDelete started");
  const cur = state.templates.find((t) => t.id === state.selectedId);
  if (!cur) return;

  if (isDefaultTemplateId(cur.id)) {
    if (!state.overrides.has(cur.id)) return;

    const ok = confirm(
      `기본 템플릿을 기본값으로 복원할까요?\n- 이름: "${cur.name}"\n- ID: ${cur.id}`
    );
    if (!ok) return;

    state.overrides.delete(cur.id);
    const persisted = await persistOverrides("저장");
    rebuildTemplates();
    selectTemplate(cur.id);
    if (persisted) setGlobalStatus("기본값으로 복원했습니다.");
    return;
  }

  const ok = confirm(`템플릿을 삭제할까요?\n- 이름: "${cur.name}"\n- ID: ${cur.id}`);
  if (!ok) return;

  state.customTemplates = state.customTemplates.filter((t) => t.id !== cur.id);
  rebuildTemplates();
  const persisted = await persistCustomTemplates("저장");

  const nextId = state.templates[0]?.id ?? null;
  selectTemplate(nextId);
  if (persisted) setGlobalStatus("템플릿을 삭제했습니다.");
}
async function onSave() {
  console.log("onSave started");
  const selectedId = state.selectedId;
  const oldId = selectedId;
  const isDefault = typeof selectedId === "string" && isDefaultTemplateId(selectedId);
  const idx = state.customTemplates.findIndex((t) => t.id === oldId);

  let rawFields = [];
  try {
    const txt = el("fieldsInput").value.trim();
    rawFields = txt ? JSON.parse(txt) : [];
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e ?? "unknown");
    console.warn("onSave: JSON parse error", err);
    setBox("formErrors", "오류", [`필드 JSON이 올바르지 않습니다: ${err}`]);
    setBox("formWarnings", "경고", []);
    return;
  }

  const rawTemplate = {
    id: el("idInput").value,
    name: el("nameInput").value,
    description: el("descInput").value,
    master: el("masterInput").value,
    fields: rawFields
  };

  if (isDefault) {
    console.log("onSave: saving default override", selectedId);
    rawTemplate.id = selectedId;
    el("idInput").value = selectedId;

    const res = validateTemplate(rawTemplate);
    if (!res.ok) {
      console.warn("onSave: default validation failed", res.errors);
      setBox("formErrors", "오류", res.errors);
      setBox("formWarnings", "경고", res.warnings);
      return;
    }

    setBox("formErrors", "오류", []);
    setBox("formWarnings", "경고", res.warnings);

    const warnings = res.warnings;
    state.overrides.set(selectedId, res.template);
    const persisted = await persistOverrides("저장");
    rebuildTemplates();
    selectTemplate(selectedId);
    setBox("formErrors", "오류", []);
    setBox("formWarnings", "경고", warnings);
    if (persisted) setGlobalStatus("기본 템플릿을 저장했습니다.");
    return;
  }

  const reserved = reservedCustomIdsExcluding({
    defaultIds: DEFAULT_IDS,
    customTemplates: state.customTemplates,
    currentId: oldId
  });
  const res = validateTemplate(rawTemplate, { reservedIds: reserved });
  if (!res.ok) {
    console.warn("onSave: custom validation failed", res.errors);
    setBox("formErrors", "오류", res.errors);
    setBox("formWarnings", "경고", res.warnings);
    return;
  }

  console.log("onSave: saving custom template", res.template.id);
  setBox("formErrors", "오류", []);
  setBox("formWarnings", "경고", res.warnings);

  const warnings = res.warnings;
  if (idx >= 0) {
    state.customTemplates[idx] = res.template;
  } else {
    state.customTemplates.unshift(res.template);
  }

  rebuildTemplates();
  state.selectedId = res.template.id;
  const persisted = await persistCustomTemplates("저장");
  selectTemplate(res.template.id);
  setBox("formErrors", "오류", []);
  setBox("formWarnings", "경고", warnings);
  if (persisted) setGlobalStatus("저장했습니다.");
}

async function onGenerateFields() {
  const master = el("masterInput").value;
  const res = parseMasterPrompt(master);
  if (!res.ok) {
    setBox("formErrors", "오류", res.errors);
    setBox("formWarnings", "경고", res.warnings);
    setGlobalStatus("필드 생성에 실패했습니다.");
    return;
  }

  el("masterInput").value = res.master;
  el("fieldsInput").value = JSON.stringify(res.fields, null, 2);

  setBox("formErrors", "오류", res.errors);
  setBox("formWarnings", "경고", res.warnings);
  setGlobalStatus("마스터 프롬프트에서 필드를 생성했습니다.");
}

async function onExport() {
  const payload = JSON.stringify(
    [...state.customTemplates, ...Array.from(state.overrides.values())],
    null,
    2
  );
  downloadTextFile("promptgen-templates.json", payload);
  setGlobalStatus(
    `템플릿을 내보냈습니다. (사용자 ${state.customTemplates.length}개, 기본 수정본 ${state.overrides.size}개)`
  );
}

async function onImportFile(file) {
  if (!file) return;

  let parsed;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e ?? "unknown");
    setBox("formErrors", "오류", [`JSON 파일이 올바르지 않습니다: ${err}`]);
    setBox("formWarnings", "경고", []);
    setGlobalStatus("가져오기에 실패했습니다.");
    return;
  }

  if (!Array.isArray(parsed)) {
    setBox("formErrors", "오류", ["가져오기 JSON은 템플릿 배열이어야 합니다."]);
    setBox("formWarnings", "경고", []);
    setGlobalStatus("가져오기에 실패했습니다.");
    return;
  }

  const reserved = reservedCustomIdsExcluding({
    defaultIds: DEFAULT_IDS,
    customTemplates: state.customTemplates,
    currentId: null
  });
  const importedCustom = [];
  const importedOverrideIds = [];
  const errors = [];
  const warnings = [];

  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i];
    if (!isPlainObject(raw)) {
      errors.push(`templates[${i}] 항목은 객체여야 합니다.`);
      continue;
    }

    const rawId = nonEmptyString(raw.id);
    if (!rawId) {
      errors.push(`templates[${i}].id 값은 비어있지 않은 문자열이어야 합니다.`);
      continue;
    }

    // 기본 템플릿 ID인 경우: "기본 템플릿 수정본(오버라이드)"로 처리
    if (isDefaultTemplateId(rawId)) {
      const res = validateTemplate({ ...raw, id: rawId });
      if (!res.ok) {
        errors.push(...res.errors.map((e) => `templates[${i}]: ${e}`));
        warnings.push(...res.warnings.map((w) => `templates[${i}]: ${w}`));
        continue;
      }

      if (state.overrides.has(rawId)) {
        warnings.push(`templates[${i}]는 기존 기본 템플릿 수정본을 덮어썼습니다: ${rawId}`);
      }

      state.overrides.set(rawId, res.template);
      importedOverrideIds.push(rawId);
      warnings.push(...res.warnings.map((w) => `templates[${i}]: ${w}`));
      continue;
    }

    // 그 외: 사용자 템플릿으로 가져오기(충돌 시 자동 리네임)
    const cloned = { ...raw, id: uniqueImportedId(rawId, reserved) };
    if (cloned.id !== rawId) {
      warnings.push(`templates[${i}]의 id가 "${cloned.id}"로 변경되었습니다.`);
    }

    const res = validateTemplate(cloned, { reservedIds: reserved });
    if (!res.ok) {
      errors.push(...res.errors.map((e) => `templates[${i}]: ${e}`));
      warnings.push(...res.warnings.map((w) => `templates[${i}]: ${w}`));
      continue;
    }

    reserved.add(res.template.id);
    importedCustom.push(res.template);
    warnings.push(...res.warnings.map((w) => `templates[${i}]: ${w}`));
  }

  if (importedCustom.length === 0 && importedOverrideIds.length === 0) {
    setBox(
      "formErrors",
      "오류",
      errors.length ? errors : ["가져올 수 있는 유효한 템플릿이 없습니다."]
    );
    setBox("formWarnings", "경고", warnings);
    setGlobalStatus("가져오기에 실패했습니다.");
    return;
  }

  state.customTemplates = [...importedCustom, ...state.customTemplates];
  const persisted = await persistAll("저장");
  rebuildTemplates();

  const focusId = importedCustom[0]?.id ?? importedOverrideIds[0] ?? state.templates[0]?.id ?? null;
  selectTemplate(focusId);

  setBox("formErrors", "오류", errors);
  setBox("formWarnings", "경고", warnings);

  const parts = [];
  if (importedCustom.length) parts.push(`사용자 ${importedCustom.length}개`);
  if (importedOverrideIds.length) parts.push(`기본 수정본 ${importedOverrideIds.length}개`);
  const skipped = parsed.length - importedCustom.length - importedOverrideIds.length;

  if (persisted) {
    setGlobalStatus(`템플릿을 가져왔습니다: ${parts.join(", ")} (건너뜀 ${skipped}개).`);
  } else {
    setGlobalStatus(
      `템플릿을 가져왔지만 저장에 실패했습니다. 페이지를 닫으면 반영되지 않을 수 있습니다. (건너뜀 ${skipped}개)`
    );
  }
}

function wireUi() {
  const backBtn = document.getElementById("backToPanelBtn");
  if (backBtn) {
    backBtn.classList.remove("hidden");
    backBtn.addEventListener("click", () => {
      window.location.href = "../sidepanel/sidepanel.html";
    });
  }

  el("newBtn").addEventListener("click", () => onNew().catch(console.error));
  el("cloneBtn").addEventListener("click", () => onClone().catch(console.error));
  el("deleteBtn").addEventListener("click", () => onDelete().catch(console.error));
  el("saveBtn").addEventListener("click", () => onSave().catch(console.error));
  el("generateFieldsBtn").addEventListener("click", () => onGenerateFields().catch(console.error));
  el("reloadBtn").addEventListener("click", () => loadTemplates().catch(console.error));

  el("exportBtn").addEventListener("click", () => onExport().catch(console.error));
  el("importBtn").addEventListener("click", () => {
    el("importFileInput").click();
  });
  el("importFileInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    onImportFile(file).catch(console.error);
    e.target.value = "";
  });

  wireQuickOptions({ state, el, setGlobalStatus, setBox });
}

wireUi();
loadTemplates().catch((e) => {
  console.error("options init failed:", e);
  setGlobalStatus("템플릿을 불러오지 못했습니다. 콘솔을 확인하세요.");
});
