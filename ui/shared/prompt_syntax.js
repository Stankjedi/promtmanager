function slugifyToId(s) {
  const raw = typeof s === "string" ? s : "";
  const cleaned = raw.replace(/\(optional\)|\boptional\b|\(선택\)|선택\s*사항/gi, " ");
  const slug = cleaned
    .toLowerCase()
    .replace(/^[\s\-\*\d\.\)\(]+/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) return "";
  if (/^\d/.test(slug)) return `f_${slug}`;
  return slug;
}

function isOptionalLine(line) {
  const s = typeof line === "string" ? line : "";
  return /\(optional\)|\boptional\b|\(선택\)|선택\s*사항/i.test(s);
}

function extractLabelFromLinePrefix(prefix) {
  if (typeof prefix !== "string") return "";
  const before = prefix.trimEnd();
  const colonIdx = before.lastIndexOf(":");
  if (colonIdx === -1) return "";

  let label = before.slice(0, colonIdx).trim();
  label = label.replace(/^[\s\-\*\d\.\)\(]+/g, "").trim();
  return label;
}

function chooseOptionsDelimiter(content) {
  if (content.includes("|")) return { kind: "single", split: (s) => s.split("|") };
  if (content.includes(",")) return { kind: "multi", split: (s) => s.split(",") };
  if (content.includes(" / ")) return { kind: "single", split: (s) => s.split(/\s*\/\s*/) };
  return null;
}

function parseOptions(content) {
  const trimmed = (content ?? "").trim();
  const chooser = chooseOptionsDelimiter(trimmed);
  if (!chooser) return null;

  const parts = chooser
    .split(trimmed)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;
  return { kind: chooser.kind, values: parts };
}

function makeUniqueId(baseId, usedIds, fallbackPrefix = "field") {
  const base = baseId || fallbackPrefix;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  let i = 2;
  while (usedIds.has(`${base}_${i}`)) i++;
  const id = `${base}_${i}`;
  usedIds.add(id);
  return id;
}

function optionObjects(values) {
  return values.map((v) => ({ label: v, value: v }));
}

function labelFromId(id) {
  const s = typeof id === "string" ? id : "";
  return s ? s.toUpperCase() : "필드";
}

function addFieldIfMissing(fields, field) {
  if (!field?.id) return;
  if (fields.some((f) => f.id === field.id)) return;
  fields.push(field);
}

export function parseMasterPrompt(master) {
  const errors = [];
  const warnings = [];

  if (typeof master !== "string" || !master.trim()) {
    return {
      ok: false,
      master: "",
      fields: [],
      errors: ["master는 비어있지 않은 문자열이어야 합니다."],
      warnings
    };
  }

  const usedIds = new Set();
  const fields = [];

  const lines = master.split(/\r?\n/);
  const outLines = [];

  for (const line of lines) {
    const optional = isOptionalLine(line);
    let out = line;

    // 1) Parse {a|b|c} / {a, b, c} blocks into selectable fields
    const braceRe = /\{([^{}\n\r]+)\}/g;
    let match;
    let delta = 0;
    while ((match = braceRe.exec(line)) !== null) {
      const rawContent = match[1];
      const parsed = parseOptions(rawContent);
      if (!parsed) continue;

      const start = match.index + delta;
      const end = start + match[0].length;
      const before = out.slice(0, start);
      const label = extractLabelFromLinePrefix(before) || `OPTION_${fields.length + 1}`;
      const baseId = slugifyToId(label) || `field_${fields.length + 1}`;
      const id = makeUniqueId(baseId, usedIds, "field");

      const token = `{{${id}}}`;
      out = `${out.slice(0, start)}${token}${out.slice(end)}`;
      delta += token.length - match[0].length;

      if (parsed.kind === "single") {
        const field = {
          id,
          label,
          kind: "single",
          required: !optional,
          options: optionObjects(parsed.values),
          omitLineIfEmpty: optional
        };
        if (optional) {
          field.allowNone = true;
          field.noneLabel = "(없음)";
        } else {
          field.defaultValue = parsed.values[0];
        }
        addFieldIfMissing(fields, field);
      } else {
        const field = {
          id,
          label,
          kind: "multi",
          required: !optional,
          options: optionObjects(parsed.values),
          joiner: ", ",
          omitLineIfEmpty: optional
        };
        addFieldIfMissing(fields, field);
      }
    }

    // 2) Ensure {{tokens}} also create text fields (if not already created)
    const tokenRe = /\{\{\s*([^{}\n\r]+)\s*\}\}/g;
    let tm;
    while ((tm = tokenRe.exec(out)) !== null) {
      const id = tm[1].trim();
      if (!id || fields.some((f) => f.id === id)) continue;
      usedIds.add(id);

      const prefix = out.slice(0, tm.index);
      const lastTokenEnd = prefix.lastIndexOf("}}");
      const labelPrefix = lastTokenEnd === -1 ? prefix : prefix.slice(lastTokenEnd + 2);
      const label = extractLabelFromLinePrefix(labelPrefix) || labelFromId(id);

      const field = {
        id,
        label,
        kind: "text",
        required: !optional,
        omitLineIfEmpty: optional
      };
      addFieldIfMissing(fields, field);
    }

    outLines.push(out);
  }

  if (fields.length === 0) {
    warnings.push("필드를 찾지 못했습니다. {{토큰}} 또는 {a|b|c} 옵션 블록을 사용하세요.");
  }

  return {
    ok: true,
    master: outLines.join("\n"),
    fields,
    errors,
    warnings
  };
}
