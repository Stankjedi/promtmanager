import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeTemplates,
  validateTemplate
} from "../promptgen-extension/shared/template_validation.js";

test("validateTemplate: rejects non-objects", () => {
  const res = validateTemplate(null);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => String(e).includes("객체")));
});

test("validateTemplate: rejects missing required fields", () => {
  const res = validateTemplate({ id: "t1", name: "T1" });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => String(e).includes("master")));
});

test("validateTemplate: respects reservedIds", () => {
  const res = validateTemplate(
    { id: "dup", name: "Dup", master: "ASSET: {{asset}}" },
    { reservedIds: new Set(["dup"]) }
  );
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => String(e).includes("이미 사용 중")));
});

test("validateTemplate: normalizes text.maxLen", () => {
  const res = validateTemplate({
    id: "t2",
    name: "T2",
    master: "A: {{a}}",
    fields: [{ id: "a", label: "A", kind: "text", maxLen: 1.9 }]
  });

  assert.equal(res.ok, true);
  assert.equal(res.template.fields[0].maxLen, 1);
});

test("validateTemplate: fixes single.defaultValue not in options", () => {
  const res = validateTemplate({
    id: "t3",
    name: "T3",
    master: "MODE: {{mode}}",
    fields: [
      {
        id: "mode",
        label: "MODE",
        kind: "single",
        defaultValue: "z",
        options: [
          { label: "a", value: "a" },
          { label: "b", value: "b" }
        ]
      }
    ]
  });

  assert.equal(res.ok, true);
  assert.equal(res.template.fields[0].defaultValue, "a");
  assert.ok(res.warnings.some((w) => String(w).includes("defaultValue")));
});

test("sanitizeTemplates: filters invalid templates and counts invalidCount", () => {
  const raw = [
    {
      id: "ok",
      name: "Ok",
      master: "A: {{a}}",
      fields: [{ id: "a", label: "A", kind: "text" }]
    },
    { bad: true }
  ];

  const res = sanitizeTemplates(raw);
  assert.equal(res.totalCount, 2);
  assert.equal(res.invalidCount, 1);
  assert.equal(res.templates.length, 1);
  assert.ok(res.errors.length > 0);
});

test("sanitizeTemplates: warns for invalid options and skips duplicate field IDs", () => {
  const raw = [
    {
      id: "ok2",
      name: "Ok2",
      master: "X: {{x}}",
      fields: [
        { id: "x", label: "X", kind: "single", options: "nope", defaultValue: "x" },
        { id: "x", label: "X2", kind: "text" }
      ]
    }
  ];

  const res = sanitizeTemplates(raw);
  assert.equal(res.invalidCount, 0);
  assert.equal(res.templates.length, 1);
  assert.equal(res.templates[0].fields.length, 1);
  assert.ok(res.warnings.some((w) => String(w).includes("options")));
  assert.ok(res.warnings.some((w) => String(w).includes("중복")));
});

test("validateTemplate: warns for undefined tokens in master", () => {
  const res = validateTemplate({
    id: "t4",
    name: "T4",
    master: ["A: {{a}}", "B: {{b}}"].join("\n"),
    fields: [{ id: "a", label: "A", kind: "text" }]
  });

  assert.equal(res.ok, true);
  assert.ok(
    res.warnings.some(
      (w) => String(w).includes("정의되지 않은 토큰") && String(w).includes("{{b}}")
    )
  );
});

test("validateTemplate: warns for unused fields", () => {
  const res = validateTemplate({
    id: "t5",
    name: "T5",
    master: "A: {{a}}",
    fields: [
      { id: "a", label: "A", kind: "text" },
      { id: "b", label: "B", kind: "text" }
    ]
  });

  assert.equal(res.ok, true);
  assert.ok(
    res.warnings.some(
      (w) => String(w).includes("사용되지 않는 필드") && String(w).includes("(b)")
    )
  );
});

test("validateTemplate: uses field.token for master-field consistency", () => {
  const res = validateTemplate({
    id: "t6",
    name: "T6",
    master: "X: {{x}}",
    fields: [{ id: "a", label: "A", kind: "text", token: "{{x}}" }]
  });

  assert.equal(res.ok, true);
  assert.equal(res.warnings.some((w) => String(w).includes("정의되지 않은 토큰")), false);
  assert.equal(res.warnings.some((w) => String(w).includes("사용되지 않는 필드")), false);
});
