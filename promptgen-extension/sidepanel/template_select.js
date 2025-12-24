export function normalizeSearchQuery(q) {
  return typeof q === "string" ? q.trim().toLowerCase() : "";
}

export function templateMatchesQuery(t, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  const id = String(t?.id ?? "").toLowerCase();
  const name = String(t?.name ?? "").toLowerCase();
  return id.includes(q) || name.includes(q);
}

export function computeTemplateSelectList({ templates, selectedId, query }) {
  const list = Array.isArray(templates) ? templates : [];
  const q = normalizeSearchQuery(query);
  if (!q) return { query: "", matchCount: list.length, list };

  const matches = list.filter((t) => templateMatchesQuery(t, q));
  const selected = list.find((t) => t?.id === selectedId) ?? list[0] ?? null;

  const out =
    selected && !matches.some((t) => t?.id === selected.id) ? [selected, ...matches] : matches;

  return { query: q, matchCount: matches.length, list: out };
}

export function splitFavorites(list, favoriteIdSet) {
  const templates = Array.isArray(list) ? list : [];
  const favoritesSet = favoriteIdSet instanceof Set ? favoriteIdSet : new Set();

  const favorites = [];
  const rest = [];
  for (const t of templates) {
    if (favoritesSet.has(t?.id)) favorites.push(t);
    else rest.push(t);
  }

  return { favorites, rest };
}

