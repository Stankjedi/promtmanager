function tokenOf(field) {
  return field.token || `{{${field.id}}}`;
}

const COMPILED_TEMPLATE_CACHE = new WeakMap();

function compileTemplate(template) {
  const cached = COMPILED_TEMPLATE_CACHE.get(template);
  if (cached && cached.master === template.master && cached.fieldsRef === template.fields) {
    return cached;
  }

  const fields = Array.isArray(template.fields) ? template.fields : [];
  const tokens = fields.map((field) => tokenOf(field));
  const lines = template.master.split(/\r?\n/);

  const lineInfos = lines.map((line) => {
    let minReplaceIndex = Infinity;
    const omitFieldIndices = [];

    for (let i = 0; i < fields.length; i++) {
      const token = tokens[i];
      if (!line.includes(token)) continue;
      if (minReplaceIndex === Infinity) minReplaceIndex = i;
      if (fields[i].omitLineIfEmpty) omitFieldIndices.push(i);
    }

    return { line, minReplaceIndex, omitFieldIndices };
  });

  const compiled = {
    master: template.master,
    fieldsRef: template.fields,
    fields,
    tokens,
    lineInfos
  };

  COMPILED_TEMPLATE_CACHE.set(template, compiled);
  return compiled;
}

function replaceAllSafe(haystack, needle, replacement) {
  return haystack.split(needle).join(replacement);
}

function coerceTextValue(raw) {
  if (typeof raw === "string") return raw;
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

function clampString(s, maxLen) {
  const str = typeof s === "string" ? s : "";
  if (typeof maxLen !== "number" || !Number.isFinite(maxLen)) return str;
  const m = Math.max(0, Math.floor(maxLen));
  return str.length > m ? str.slice(0, m) : str;
}

function defaultSingleValue(field) {
  if (typeof field.defaultValue === "string") {
    if (field.defaultValue || field.allowNone) return field.defaultValue;
  }
  if (field.allowNone) return "";
  const opts = Array.isArray(field.options) ? field.options : [];
  return opts[0]?.value ?? "";
}

export function normalizeValues(template, values) {
  const input = values && typeof values === "object" ? values : {};
  const out = { ...input };

  for (const field of template.fields) {
    const cur = out[field.id];

    if (field.kind === "text") {
      out[field.id] = clampString(coerceTextValue(cur), field.maxLen);
      continue;
    }

    if (field.kind === "single") {
      const curStr = typeof cur === "string" ? cur : "";
      const opts = Array.isArray(field.options) ? field.options : null;
      const allowed =
        !opts || opts.length === 0 || opts.some((o) => o && o.value === curStr);

      if (!curStr || !allowed) {
        out[field.id] = defaultSingleValue(field);
      }
      continue;
    }

    if (field.kind === "multi") {
      const rawArr = Array.isArray(cur) ? cur : [];
      const strings = rawArr.filter((x) => typeof x === "string");
      const seen = new Set();
      let outArr = strings.filter((x) => {
        if (seen.has(x)) return false;
        seen.add(x);
        return true;
      });

      const opts = Array.isArray(field.options) ? field.options : null;
      if (opts && opts.length) {
        const allowed = new Set(opts.map((o) => o?.value).filter((v) => typeof v === "string"));
        outArr = outArr.filter((x) => allowed.has(x));
      }

      out[field.id] = outArr;
      continue;
    }
  }

  return out;
}

function renderFieldValue(field, raw) {
  if (field.kind === "text") return typeof raw === "string" ? raw : "";
  if (field.kind === "single") return typeof raw === "string" ? raw : "";
  if (field.kind === "multi") {
    const arr = Array.isArray(raw) ? raw : [];
    const joiner = field.joiner ?? ", ";
    return arr.join(joiner);
  }
  return "";
}

export function renderPrompt(template, values) {
  const v = normalizeValues(template, values);
  const errors = [];
  const compiled = compileTemplate(template);
  const rendered = Object.create(null);

  // 1) required 검증
  for (const field of compiled.fields) {
    if (!field.required) continue;
    const raw = v[field.id];

    if (field.kind === "text") {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) errors.push(`필수 입력 항목입니다: ${field.label}`);
      continue;
    }

    if (field.kind === "single") {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) errors.push(`필수 선택 항목입니다: ${field.label}`);
      continue;
    }

    if (field.kind === "multi") {
      const arr = Array.isArray(raw) ? raw : [];
      const min = field.minSelected ?? 1;
      if (arr.length < min) errors.push(`선택 개수가 부족합니다: ${field.label} (최소 ${min}개)`);
      continue;
    }
  }

  for (const field of compiled.fields) {
    rendered[field.id] = renderFieldValue(field, v[field.id]);
  }

  // 2) 라인 단위 처리 (omitLineIfEmpty -> replace)
  const replaced = [];
  for (const info of compiled.lineInfos) {
    let keep = true;
    for (const idx of info.omitFieldIndices) {
      const field = compiled.fields[idx];
      const text = rendered[field.id].trim();
      if (!text) {
        keep = false;
        break;
      }
    }
    if (!keep) continue;

    let outLine = info.line;
    if (info.minReplaceIndex !== Infinity) {
      for (let i = info.minReplaceIndex; i < compiled.fields.length; i++) {
        const field = compiled.fields[i];
        const token = compiled.tokens[i];
        if (!outLine.includes(token)) continue;
        outLine = replaceAllSafe(outLine, token, rendered[field.id]);
      }
    }
    replaced.push(outLine);
  }

  // 3) 빈 줄 정리
  const joined = replaced.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();

  return { ok: errors.length === 0, errors, prompt: joined, values: v };
}
