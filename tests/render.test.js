import assert from "node:assert/strict";
import test from "node:test";

import { normalizeValues, renderPrompt } from "../promptgen-extension/shared/render.js";

const TEMPLATE = {
  id: "test-template",
  name: "Test Template",
  master: ["ASSET: {{asset}}", "MODE: {{mode}}", "OPTIONAL: {{optional}}"].join("\n"),
  fields: [
    { id: "asset", label: "ASSET", kind: "text", required: true },
    {
      id: "mode",
      label: "MODE",
      kind: "single",
      required: true,
      defaultValue: "a",
      options: [
        { label: "a", value: "a" },
        { label: "b", value: "b" }
      ]
    },
    {
      id: "optional",
      label: "OPTIONAL",
      kind: "text",
      required: false,
      omitLineIfEmpty: true
    }
  ]
};

test("renderPrompt: required text missing -> ok=false with error", () => {
  const res = renderPrompt(TEMPLATE, { mode: "a" });
  assert.equal(res.ok, false);
  assert.ok(Array.isArray(res.errors) && res.errors.length > 0);
});

test("renderPrompt: token replacement includes provided values", () => {
  const res = renderPrompt(TEMPLATE, { asset: "my-asset", mode: "b", optional: "x" });
  assert.equal(res.ok, true);
  assert.match(res.prompt, /ASSET:\s*my-asset/);
  assert.match(res.prompt, /MODE:\s*b/);
  assert.match(res.prompt, /OPTIONAL:\s*x/);
  assert.equal(res.prompt.includes("{{asset}}"), false);
});

test("renderPrompt: replaces tokens introduced by earlier replacements", () => {
  const t = {
    id: "test-nested-tokens",
    name: "Test Nested Tokens",
    master: "A: {{a}}",
    fields: [
      { id: "a", label: "A", kind: "text", required: false },
      { id: "b", label: "B", kind: "text", required: false }
    ]
  };

  const res = renderPrompt(t, { a: "{{b}}", b: "X" });
  assert.equal(res.ok, true);
  assert.equal(res.prompt, "A: X");
});

test("renderPrompt: omitLineIfEmpty removes the whole line", () => {
  const res = renderPrompt(TEMPLATE, { asset: "my-asset", mode: "a", optional: "" });
  assert.equal(res.ok, true);
  assert.equal(res.prompt.includes("OPTIONAL:"), false);
});

test("normalizeValues: applies defaultValue for single fields", () => {
  const values = normalizeValues(TEMPLATE, {});
  assert.equal(values.mode, "a");
});

test("normalizeValues: single values not in options fall back safely", () => {
  const values = normalizeValues(TEMPLATE, { asset: "x", mode: "nope" });
  assert.equal(values.mode, "a");
});

test("normalizeValues: multi values are de-duplicated and filtered by options", () => {
  const t = {
    id: "test-multi",
    name: "Test Multi",
    master: "TAGS: {{tags}}",
    fields: [
      {
        id: "tags",
        label: "TAGS",
        kind: "multi",
        required: false,
        options: [
          { label: "x", value: "x" },
          { label: "y", value: "y" }
        ]
      }
    ]
  };

  const values = normalizeValues(t, { tags: ["x", "bad", "x", 1] });
  assert.deepEqual(values.tags, ["x"]);
});

test("normalizeValues: text values are clamped by maxLen", () => {
  const t = {
    id: "test-maxlen",
    name: "Test MaxLen",
    master: "A: {{a}}",
    fields: [{ id: "a", label: "A", kind: "text", required: false, maxLen: 3 }]
  };

  const values = normalizeValues(t, { a: "abcd" });
  assert.equal(values.a, "abc");
});
