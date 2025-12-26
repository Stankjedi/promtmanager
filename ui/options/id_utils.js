export function nonEmptyString(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

export function makeUniqueId(base, reserved) {
  const baseId = (base || "custom-template").trim() || "custom-template";
  if (!reserved.has(baseId)) return baseId;
  let i = 2;
  while (reserved.has(`${baseId}-${i}`)) i++;
  return `${baseId}-${i}`;
}

export function reservedCustomIdsExcluding({ defaultIds, customTemplates, currentId }) {
  const reserved = new Set(defaultIds);
  for (const t of customTemplates || []) {
    if (t?.id !== currentId) reserved.add(t.id);
  }
  return reserved;
}

export function uniqueImportedId(rawId, reserved) {
  const base = nonEmptyString(rawId) ?? "imported-template";
  if (!reserved.has(base)) return base;
  let i = 2;
  while (reserved.has(`${base}-imported-${i}`)) i++;
  return `${base}-imported-${i}`;
}

