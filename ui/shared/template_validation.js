function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function optionalString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value;
}

function optionalBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function optionalNumber(value, fallback = null) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const MASTER_TOKEN_RE = /\{\{\s*([^{}\n\r]+)\s*\}\}/g;

function extractTokenIdsFromMaster(master) {
  const s = typeof master === "string" ? master : "";
  const out = [];
  const seen = new Set();
  let match;
  while ((match = MASTER_TOKEN_RE.exec(s)) !== null) {
    const id = match[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function activeTokenOf(field) {
  if (typeof field?.token === "string" && field.token) return field.token;
  return `{{${field.id}}}`;
}

function addMasterFieldConsistencyWarnings(template, warnings) {
  if (!template || typeof template !== "object") return;
  if (!Array.isArray(warnings)) return;

  const master = typeof template.master === "string" ? template.master : "";
  const fields = Array.isArray(template.fields) ? template.fields : [];

  const activeTokens = new Set(fields.map((f) => activeTokenOf(f)));

  // 1) Undefined {{tokens}} in master (no matching field token)
  const tokenIds = extractTokenIdsFromMaster(master);
  for (const id of tokenIds) {
    const token = `{{${id}}}`;
    if (activeTokens.has(token)) continue;
    warnings.push(`[정합성] 마스터 프롬프트에 정의되지 않은 토큰이 있습니다: ${token}`);
  }

  // 2) Unused fields (field token never appears in master)
  for (const field of fields) {
    const token = activeTokenOf(field);
    if (!token) continue;
    if (master.includes(token)) continue;
    const label = nonEmptyString(field?.label) ?? field?.id ?? "필드";
    warnings.push(`[정합성] 마스터 프롬프트에 사용되지 않는 필드가 있습니다: ${label} (${field.id})`);
  }
}

function sanitizeOptions(rawOptions, errors, path) {
  if (rawOptions === undefined) return undefined;
  if (!Array.isArray(rawOptions)) {
    errors.push(`${path} 항목은 배열이어야 합니다.`);
    return undefined;
  }

  const out = [];
  for (let i = 0; i < rawOptions.length; i++) {
    const raw = rawOptions[i];
    if (!isPlainObject(raw)) {
      errors.push(`${path}[${i}] 항목은 객체여야 합니다.`);
      continue;
    }
    const label = nonEmptyString(raw.label);
    const value = nonEmptyString(raw.value);
    if (!label || !value) {
      errors.push(`${path}[${i}] 항목의 label/value는 비어있지 않은 문자열이어야 합니다.`);
      continue;
    }
    out.push({ label, value });
  }
  return out;
}

function sanitizeField(rawField, index, warnings) {
  const errors = [];
  if (!isPlainObject(rawField)) {
    errors.push(`fields[${index}] 항목은 객체여야 합니다.`);
    return { ok: false, errors };
  }

  const id = nonEmptyString(rawField.id);
  const label = nonEmptyString(rawField.label);
  const kind = nonEmptyString(rawField.kind);

  if (!id) errors.push(`fields[${index}].id 값은 비어있지 않은 문자열이어야 합니다.`);
  if (!label) errors.push(`fields[${index}].label 값은 비어있지 않은 문자열이어야 합니다.`);
  if (!kind) errors.push(`fields[${index}].kind 값은 비어있지 않은 문자열이어야 합니다.`);

  if (errors.length) return { ok: false, errors };

  if (kind !== "text" && kind !== "single" && kind !== "multi") {
    return {
      ok: false,
      errors: [`fields[${index}].kind는 "text" | "single" | "multi" 중 하나여야 합니다.`]
    };
  }

  const base = {
    id,
    label,
    kind,
    required: optionalBoolean(rawField.required, false),
    help: optionalString(rawField.help, ""),
    token: optionalString(rawField.token, "")
  };

  if (!base.help) delete base.help;
  if (!base.token) delete base.token;

  if (kind === "text") {
    const maxLen = optionalNumber(rawField.maxLen);
    const omitLineIfEmpty = optionalBoolean(rawField.omitLineIfEmpty, false);
    const field = {
      ...base,
      placeholder: optionalString(rawField.placeholder, ""),
      omitLineIfEmpty
    };
    if (!field.placeholder) delete field.placeholder;
    if (maxLen !== null) field.maxLen = Math.max(0, Math.floor(maxLen));
    return { ok: true, field };
  }

  if (kind === "single") {
    const optsErrors = [];
    const options = sanitizeOptions(rawField.options, optsErrors, `fields[${index}].options`);
    if (optsErrors.length) warnings.push(...optsErrors);

    const field = {
      ...base,
      options: Array.isArray(options) ? options : undefined,
      defaultValue: optionalString(rawField.defaultValue, ""),
      allowNone: optionalBoolean(rawField.allowNone, false),
      noneLabel: optionalString(rawField.noneLabel, ""),
      omitLineIfEmpty: optionalBoolean(rawField.omitLineIfEmpty, false)
    };

    if (!field.defaultValue) delete field.defaultValue;
    if (!field.noneLabel) delete field.noneLabel;
    if (!field.options) delete field.options;

    if (field.defaultValue && Array.isArray(field.options) && field.options.length > 0) {
      const ok = field.options.some((o) => o && o.value === field.defaultValue);
      if (!ok) {
        warnings.push(
          `fields[${index}].defaultValue "${field.defaultValue}"는 options에 포함되어야 합니다. 첫 옵션으로 대체합니다.`
        );
        field.defaultValue = field.options[0].value;
      }
    }

    return { ok: true, field };
  }

  // kind === "multi"
  const optsErrors = [];
  const options = sanitizeOptions(rawField.options, optsErrors, `fields[${index}].options`);
  if (optsErrors.length) warnings.push(...optsErrors);

  const minSelected = optionalNumber(rawField.minSelected);
  const field = {
    ...base,
    options: Array.isArray(options) ? options : undefined,
    omitLineIfEmpty: optionalBoolean(rawField.omitLineIfEmpty, false),
    joiner: optionalString(rawField.joiner, "")
  };

  if (!field.joiner) delete field.joiner;
  if (!field.options) delete field.options;
  if (minSelected !== null) field.minSelected = Math.max(0, Math.floor(minSelected));

  return { ok: true, field };
}

function sanitizeTemplate(rawTemplate, path, reservedIds) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(rawTemplate)) {
    errors.push(`${path} 항목은 객체여야 합니다.`);
    return { ok: false, errors, warnings };
  }

  const id = nonEmptyString(rawTemplate.id);
  const name = nonEmptyString(rawTemplate.name);
  const master = nonEmptyString(rawTemplate.master);

  if (!id) errors.push(`${path}.id는 비어있지 않은 문자열이어야 합니다.`);
  if (!name) errors.push(`${path}.name은 비어있지 않은 문자열이어야 합니다.`);
  if (!master) errors.push(`${path}.master는 비어있지 않은 문자열이어야 합니다.`);

  if (id && reservedIds && reservedIds.has(id)) {
    errors.push(`${path}.id "${id}"는 이미 사용 중입니다.`);
  }

  if (errors.length) return { ok: false, errors, warnings };

  const rawFields = rawTemplate.fields;
  const fields = [];

  if (rawFields === undefined) {
    warnings.push(`${path}.fields가 없습니다. []로 처리합니다.`);
  } else if (!Array.isArray(rawFields)) {
    warnings.push(`${path}.fields는 배열이어야 합니다. []로 처리합니다.`);
  } else {
    const seenFieldIds = new Set();
    for (let i = 0; i < rawFields.length; i++) {
      const res = sanitizeField(rawFields[i], i, warnings);
      if (!res.ok) {
        warnings.push(...res.errors);
        continue;
      }
      if (seenFieldIds.has(res.field.id)) {
        warnings.push(`fields[${i}].id "${res.field.id}"가 중복됩니다. 제외합니다.`);
        continue;
      }
      seenFieldIds.add(res.field.id);
      fields.push(res.field);
    }
  }

  const template = {
    id,
    name,
    description: optionalString(rawTemplate.description, ""),
    master,
    fields
  };
  if (!template.description) delete template.description;

  addMasterFieldConsistencyWarnings(template, warnings);

  return { ok: true, template, errors, warnings };
}

export function validateTemplate(rawTemplate, opts = {}) {
  const reservedIds = opts?.reservedIds instanceof Set ? opts.reservedIds : undefined;
  return sanitizeTemplate(rawTemplate, "template", reservedIds);
}

export function sanitizeTemplates(rawTemplates, opts = {}) {
  const templates = [];
  const errors = [];
  const warnings = [];

  if (!Array.isArray(rawTemplates)) {
    return {
      templates,
      invalidCount: 0,
      totalCount: 0,
      errors: ["customTemplates는 배열이어야 합니다."],
      warnings: []
    };
  }

  const reservedIds =
    opts?.reservedIds instanceof Set ? new Set(opts.reservedIds) : new Set();

  let invalidCount = 0;
  for (let i = 0; i < rawTemplates.length; i++) {
    const res = sanitizeTemplate(rawTemplates[i], `templates[${i}]`, reservedIds);
    if (!res.ok) {
      invalidCount++;
      errors.push(...res.errors);
      continue;
    }
    reservedIds.add(res.template.id);
    templates.push(res.template);
    warnings.push(...res.warnings);
  }

  return {
    templates,
    invalidCount,
    totalCount: rawTemplates.length,
    errors,
    warnings
  };
}
