import assert from "node:assert/strict";
import test from "node:test";

import { parseMasterPrompt } from "../promptgen-extension/shared/prompt_syntax.js";

test("parseMasterPrompt: derives fields from option blocks and tokens", () => {
  const input = [
    "CATEGORY: {building|nature|animal}",
    "TAGS (optional): {cute, scary, boss}",
    "ASSET: {{asset}}"
  ].join("\n");

  const res = parseMasterPrompt(input);
  assert.equal(res.ok, true);
  assert.ok(Array.isArray(res.fields) && res.fields.length >= 3);

  assert.match(res.master, /CATEGORY:\s*\{\{category\}\}/);
  assert.match(res.master, /TAGS\s*\(optional\):\s*\{\{tags\}\}/);
  assert.match(res.master, /ASSET:\s*\{\{asset\}\}/);

  const byId = Object.fromEntries(res.fields.map((f) => [f.id, f]));

  assert.equal(byId.category.kind, "single");
  assert.equal(byId.category.required, true);
  assert.equal(byId.category.defaultValue, "building");
  assert.equal(byId.category.options.length, 3);

  assert.equal(byId.tags.kind, "multi");
  assert.equal(byId.tags.required, false);
  assert.equal(byId.tags.omitLineIfEmpty, true);
  assert.equal(byId.tags.options.length, 3);
  assert.equal(byId.tags.joiner, ", ");

  assert.equal(byId.asset.kind, "text");
  assert.equal(byId.asset.required, true);
});

test("parseMasterPrompt: derives labels per token in multi-token lines", () => {
  const input = "ASSET: {{asset}} STYLE: {{style}}";
  const res = parseMasterPrompt(input);
  assert.equal(res.ok, true);

  assert.match(res.master, /ASSET:\s*\{\{asset\}\}/);
  assert.match(res.master, /STYLE:\s*\{\{style\}\}/);

  const byId = Object.fromEntries(res.fields.map((f) => [f.id, f]));
  assert.equal(byId.asset.kind, "text");
  assert.equal(byId.asset.label, "ASSET");
  assert.equal(byId.style.kind, "text");
  assert.equal(byId.style.label, "STYLE");
});
