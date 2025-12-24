import { parseMasterPrompt } from "../shared/prompt_syntax.js";

function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function escapeRegExp(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseOptionValues(text) {
  const raw = typeof text === "string" ? text : "";
  const parts = raw
    .split(/[\n\r,|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function makeUniqueFieldId(base, used) {
  const b = nonEmptyString(base) ?? "field";
  if (!used.has(b)) return b;
  let i = 2;
  while (used.has(`${b}_${i}`)) i++;
  return `${b}_${i}`;
}

function insertOrReplaceInMaster(master, label, nextLine) {
  const src = typeof master === "string" ? master : "";
  const lines = src.split(/\r?\n/);

  const labelText = nonEmptyString(label) ?? "";
  const labelRe = labelText
    ? new RegExp(
        `^\\s*\\*\\s*${escapeRegExp(labelText)}\\s*(?:\\(Optional\\)|\\(optional\\))?\\s*:\\s*.*$`
      )
    : null;

  if (labelRe) {
    const idx = lines.findIndex((l) => labelRe.test(l));
    if (idx !== -1) {
      const prevLine = lines[idx];
      const tokenMatch = prevLine.match(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/);
      lines[idx] = nextLine;
      return {
        master: lines.join("\n"),
        replaced: true,
        existingTokenId: tokenMatch?.[1] ?? null
      };
    }
  }

  // Insert into **[Target ...]** section if present, otherwise append to the end.
  const targetIdx = lines.findIndex((l) => /^\s*\*\*\[Target\b/i.test(l));
  if (targetIdx === -1) {
    const trimmed = src.trimEnd();
    return {
      master: trimmed ? `${trimmed}\n\n${nextLine}\n` : `${nextLine}\n`,
      replaced: false,
      existingTokenId: null
    };
  }

  let nextSectionIdx = lines.length;
  for (let i = targetIdx + 1; i < lines.length; i++) {
    if (/^\s*\*\*\[[^\]]+\]\*\*/.test(lines[i])) {
      nextSectionIdx = i;
      break;
    }
  }

  let insertAt = targetIdx + 1;
  let lastBulletIdx = -1;
  for (let i = targetIdx + 1; i < nextSectionIdx; i++) {
    if (/^\s*[\*\-]\s+/.test(lines[i])) lastBulletIdx = i;
  }
  if (lastBulletIdx !== -1) insertAt = lastBulletIdx + 1;

  lines.splice(insertAt, 0, nextLine);
  return { master: lines.join("\n"), replaced: false, existingTokenId: null };
}

export function wireQuickOptions({ state, el, setGlobalStatus, setBox }) {
  function readCurrentFields() {
    try {
      const txt = el("fieldsInput").value.trim();
      const parsed = txt ? JSON.parse(txt) : [];
      if (!Array.isArray(parsed)) {
        return { ok: false, fields: [], error: "필드 JSON은 배열이어야 합니다." };
      }
      return { ok: true, fields: parsed };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e ?? "unknown");
      return { ok: false, fields: [], error: `필드 JSON이 올바르지 않습니다: ${err}` };
    }
  }

  function renderQuickOptions() {
    const root = el("quickOptionsRoot");
    root.innerHTML = "";

    if (!state.quickOptions.items.length) {
      const empty = document.createElement("div");
      empty.className = "panel-help";
      empty.textContent = "옵션 추가를 눌러 선택형 옵션 라인을 빠르게 만들 수 있습니다.";
      root.appendChild(empty);
      return;
    }

    for (const item of state.quickOptions.items) {
      const card = document.createElement("div");
      card.className = "quick-option";

      const row1 = document.createElement("div");
      row1.className = "quick-option-row";

      const nameInput = document.createElement("input");
      nameInput.className = "input";
      nameInput.placeholder = "옵션 이름 (예: 옵션1)";
      nameInput.value = item.label;

      const kindSelect = document.createElement("select");
      kindSelect.className = "select";
      kindSelect.innerHTML = `
      <option value="single">단일 선택 (|)</option>
      <option value="multi">다중 선택 (,)</option>
    `;
      kindSelect.value = item.kind;

      const optLabel = document.createElement("label");
      optLabel.style.display = "flex";
      optLabel.style.alignItems = "center";
      optLabel.style.gap = "6px";
      optLabel.style.fontSize = "12px";

      const optChk = document.createElement("input");
      optChk.type = "checkbox";
      optChk.checked = !!item.optional;

      const optTxt = document.createElement("span");
      optTxt.textContent = "선택";
      optLabel.appendChild(optChk);
      optLabel.appendChild(optTxt);

      const preview = document.createElement("div");
      preview.className = "quick-preview";

      const updatePreview = () => {
        const label = nonEmptyString(item.label) ?? `옵션${item.index}`;
        const values = parseOptionValues(item.valuesText);
        const brace = item.kind === "multi" ? values.join(", ") : values.join(" | ");
        const optionalSuffix = item.optional ? " (Optional)" : "";
        preview.textContent =
          values.length >= 2
            ? `* ${label}${optionalSuffix}: {${brace}}`
            : `* ${label}${optionalSuffix}: {값을 2개 이상 입력하세요}`;
      };

      nameInput.addEventListener("input", (e) => {
        item.label = e.target.value;
        updatePreview();
      });

      kindSelect.addEventListener("change", (e) => {
        item.kind = e.target.value === "multi" ? "multi" : "single";
        updatePreview();
      });

      optChk.addEventListener("change", (e) => {
        item.optional = !!e.target.checked;
        updatePreview();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-small";
      removeBtn.textContent = "삭제";
      removeBtn.addEventListener("click", () => {
        state.quickOptions.items = state.quickOptions.items.filter((x) => x !== item);
        renderQuickOptions();
      });

      row1.appendChild(nameInput);
      row1.appendChild(kindSelect);
      row1.appendChild(optLabel);
      row1.appendChild(removeBtn);

      const row2 = document.createElement("div");
      row2.className = "quick-option-row";

      const valuesArea = document.createElement("textarea");
      valuesArea.className = "textarea";
      valuesArea.placeholder = "옵션 값 (예: a|b|c 또는 a, b, c 또는 줄바꿈)";
      valuesArea.value = item.valuesText;
      valuesArea.rows = 3;
      valuesArea.addEventListener("input", (e) => {
        item.valuesText = e.target.value;
        updatePreview();
      });

      row2.appendChild(valuesArea);

      const row3 = document.createElement("div");
      row3.className = "quick-option-row";

      updatePreview();

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "btn btn-small btn-primary";
      applyBtn.textContent = "마스터에 추가";
      applyBtn.addEventListener("click", () => {
        applyQuickOption(item).catch(console.error);
      });

      row3.appendChild(preview);
      row3.appendChild(applyBtn);

      card.appendChild(row1);
      card.appendChild(row2);
      card.appendChild(row3);

      root.appendChild(card);
    }
  }

  async function applyQuickOption(item) {
    const label = nonEmptyString(item?.label) ?? `옵션${item?.index ?? 1}`;
    const values = parseOptionValues(item?.valuesText);
    const kind = item?.kind === "multi" ? "multi" : "single";
    const optional = !!item?.optional;

    if (values.length < 2) {
      setGlobalStatus("옵션 값은 2개 이상 입력해야 합니다.");
      return;
    }

    const brace = kind === "multi" ? values.join(", ") : values.join(" | ");
    const optionalSuffix = optional ? " (Optional)" : "";
    const rawLine = `* ${label}${optionalSuffix}: {${brace}}`;

    const res = parseMasterPrompt(rawLine);
    if (!res.ok) {
      setBox("formErrors", "오류", res.errors);
      setBox("formWarnings", "경고", res.warnings);
      setGlobalStatus("옵션 라인을 만들지 못했습니다. 입력을 확인하세요.");
      return;
    }

    const optionField = res.fields.find((f) => f?.kind === "single" || f?.kind === "multi");
    const generatedLine = (res.master || "").split(/\r?\n/)[0] || "";
    if (!optionField || !generatedLine) {
      setBox("formErrors", "오류", ["옵션 라인을 만들지 못했습니다. (필드 추출 실패)"]);
      setBox("formWarnings", "경고", []);
      setGlobalStatus("옵션 라인을 만들지 못했습니다.");
      return;
    }

    const fieldsRes = readCurrentFields();
    if (!fieldsRes.ok) {
      setBox("formErrors", "오류", [fieldsRes.error]);
      setBox("formWarnings", "경고", []);
      setGlobalStatus("필드 JSON을 먼저 올바르게 만든 뒤 다시 시도하세요.");
      return;
    }

    const fields = fieldsRes.fields;
    const usedIds = new Set(
      fields.map((f) => (f && typeof f === "object" ? f.id : null)).filter(Boolean)
    );

    const masterTxt = el("masterInput").value;
    const insertion = insertOrReplaceInMaster(masterTxt, label, generatedLine);

    let finalId = optionField.id;
    if (insertion.existingTokenId) {
      finalId = insertion.existingTokenId;
    } else {
      finalId = makeUniqueFieldId(optionField.id, usedIds);
    }

    const oldId = optionField.id;
    optionField.id = finalId;

    let finalLine = insertion.replaced ? generatedLine : generatedLine;
    if (oldId !== finalId) {
      finalLine = generatedLine.split(`{{${oldId}}}`).join(`{{${finalId}}}`);
    }

    // Update master (replace again if we had to rewrite token id)
    let nextMaster = insertion.master;
    if (finalLine !== generatedLine) {
      // Replace the line we inserted/replaced with the rewritten one.
      const lines = nextMaster.split(/\r?\n/);
      const idx = lines.findIndex((l) => l.trim() === generatedLine.trim());
      if (idx !== -1) {
        lines[idx] = finalLine;
        nextMaster = lines.join("\n");
      } else {
        // best-effort: also try matching by label if exact line differs
        const labelRe = new RegExp(
          `^\\s*\\*\\s*${escapeRegExp(label)}\\s*(?:\\(Optional\\)|\\(optional\\))?\\s*:\\s*.*$`
        );
        const idx2 = lines.findIndex((l) => labelRe.test(l));
        if (idx2 !== -1) {
          lines[idx2] = finalLine;
          nextMaster = lines.join("\n");
        }
      }
    }

    el("masterInput").value = nextMaster;

    // Merge/update field in fields JSON
    const existingIdx = fields.findIndex((f) => f && typeof f === "object" && f.id === finalId);
    if (existingIdx !== -1) {
      const prev = fields[existingIdx];
      const merged = { ...optionField };
      if (prev && typeof prev === "object") {
        if (prev.help && !merged.help) merged.help = prev.help;
        if (prev.token && !merged.token) merged.token = prev.token;
      }
      fields[existingIdx] = merged;
    } else {
      fields.push(optionField);
    }

    el("fieldsInput").value = JSON.stringify(fields, null, 2);

    setBox("formErrors", "오류", []);
    setBox("formWarnings", "경고", []);
    setGlobalStatus("옵션 라인을 추가했습니다. 저장 버튼을 눌러 반영하세요.");
  }

  el("addQuickOptionBtn").addEventListener("click", () => {
    const n = state.quickOptions.nextIndex++;
    state.quickOptions.items.push({
      index: n,
      label: `옵션${n}`,
      kind: "single",
      optional: false,
      valuesText: ""
    });
    renderQuickOptions();
  });

  renderQuickOptions();
}

