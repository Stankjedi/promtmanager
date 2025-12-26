import assert from "node:assert/strict";
import test from "node:test";

import {
  computeTemplateSelectList,
  splitFavorites
} from "../ui/sidepanel/template_select.js";

test("computeTemplateSelectList: empty query returns all templates", () => {
  const templates = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" }
  ];

  const res = computeTemplateSelectList({ templates, selectedId: "b", query: "" });
  assert.equal(res.query, "");
  assert.equal(res.matchCount, 2);
  assert.deepEqual(res.list.map((t) => t.id), ["a", "b"]);
});

test("computeTemplateSelectList: keeps selected visible when filtered out", () => {
  const templates = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" }
  ];

  const res = computeTemplateSelectList({ templates, selectedId: "b", query: "alpha" });
  assert.equal(res.query, "alpha");
  assert.equal(res.matchCount, 1);
  assert.deepEqual(res.list.map((t) => t.id), ["b", "a"]);
});

test("splitFavorites: separates favorites from the rest", () => {
  const list = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
    { id: "c", name: "Gamma" }
  ];

  const { favorites, rest } = splitFavorites(list, new Set(["c", "a"]));
  assert.deepEqual(favorites.map((t) => t.id), ["a", "c"]);
  assert.deepEqual(rest.map((t) => t.id), ["b"]);
});

