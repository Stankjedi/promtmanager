# AI Agent Improvement Prompts

## Mandatory execution rules
1. Execute every prompt sequentially from top to bottom. Do not skip or reorder.
2. Do not respond with text-only explanations. Always apply changes using file-edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`).
3. Keep each change tightly scoped to the current prompt and its Improvement ID.
4. After each prompt: run Verification, report modified files, mark the prompt as Done, then proceed to the next prompt.

## Execution checklist
| # | Prompt ID | Title | Priority | Status |
|:---:|:---|:---|:---:|:---:|
| 1 | PROMPT-001 | Add master-field consistency warnings | P2 | ⬜ Pending |
| 2 | PROMPT-002 | Add CI packaging verification | P2 | ⬜ Pending |
| 3 | PROMPT-003 | Add template favorites (pin) in Side Panel | P3 | ⬜ Pending |
| 4 | OPT-1 | Modularize Side Panel code | OPT | ⬜ Pending |
| 5 | OPT-2 | Further modularize Options page | OPT | ⬜ Pending |

Total: 5 prompts | Completed: 0 | Remaining: 5

---

## P1
No P1 items are currently pending. Proceed to P2.

---

## P2

### [PROMPT-001] Add master-field consistency warnings
Execute this prompt now, then proceed to [PROMPT-002].

**Improvement ID:** `validation-master-field-consistency-001`

**Task**
Add warnings when a template's `master` text and `fields` definitions are inconsistent (undefined tokens in `master`, and fields whose token never appears in `master`). Surface these warnings in both the Options page (on save) and the Side Panel (for the currently selected template).

**Target files**
- `promptgen-extension/shared/template_validation.js`
- `promptgen-extension/options/options.js`
- `promptgen-extension/sidepanel/sidepanel.js`
- `tests/template_validation.test.js`

**Steps**
1. In `template_validation.js`, implement a token extraction helper for `master`:
   - Detect `{{token}}` occurrences (trim inner whitespace).
   - Also account for custom field tokens (`field.token`) when present.
2. Emit warnings:
   - Token in `master` has no matching field (undefined token).
   - Field token is never used in `master` (unused field).
3. Options page:
   - Ensure warnings returned from `validateTemplate()` are clearly visible after Save (use the existing warnings UI).
4. Side Panel:
   - Validate the currently selected template and display a short, non-blocking warning summary in the existing warning area (do not spam; keep it concise).
5. Add/extend Node tests to lock down:
   - undefined tokens
   - unused fields
   - custom `field.token` behavior

**Implementation requirements**
- Write complete, working JavaScript (no placeholder logic).
- Keep UI language consistent with the existing UI.
- Do not fail template loading for warning-level issues.
- Keep warnings deterministic and stable.

**Verification**
- Commands:
  - `npm test`
- Manual:
  1. In the Options page, create a template where `master` references a token with no field definition, save, and confirm the warning is shown.
  2. Create a template where a field token is never used in `master`, save, and confirm the warning is shown.
  3. Open the Side Panel, select the template, and confirm a concise warning summary is visible.

After completing this prompt, proceed to [PROMPT-002].

---

### [PROMPT-002] Add CI packaging verification
Execute this prompt now, then proceed to [PROMPT-003].

**Improvement ID:** `tooling-ci-package-001`

**Task**
Extend the existing GitHub Actions workflow to also verify the extension packaging step. The workflow must fail if packaging fails or if the expected zip artifact is not produced.

**Target files**
- `.github/workflows/ci.yml`

**Steps**
1. Update the existing `CI` workflow job to run packaging after tests:
   - `npm test`
   - `npm run package:ext`
2. Add a small sanity check step that asserts a zip file exists under `dist/` after packaging (for example, `ls -1 dist/*.zip`).
3. Keep the workflow fast and deterministic (no additional dependencies beyond what `ubuntu-latest` provides).

**Implementation requirements**
- Do not introduce new third-party actions unless strictly necessary.
- Do not commit build artifacts.
- Keep the workflow readable and minimal.

**Verification**
- Commands:
  - `npm test`
  - `npm run package:ext`

After completing this prompt, proceed to [PROMPT-003].

---

## P3

### [PROMPT-003] Add template favorites (pin) in Side Panel
Execute this prompt now, then proceed to [OPT-1].

**Improvement ID:** `feat-sidepanel-favorites-001`

**Task**
Add a favorites (pin/star) feature so users can keep frequently used templates at the top of the template selector. Favorites must persist via `chrome.storage.local`, and must work correctly with the existing search/filter UI.

**Target files**
- `promptgen-extension/sidepanel/sidepanel.html`
- `promptgen-extension/sidepanel/sidepanel.css`
- `promptgen-extension/sidepanel/sidepanel.js`
- `promptgen-extension/shared/storage.js`

**Steps**
1. Add a new storage key (for example, `pg.favoriteTemplateIds`) and load it during Side Panel initialization.
2. Add a small UI control (star/pin toggle) near the template selector:
   - Toggling on adds the current `templateId` to favorites.
   - Toggling off removes it.
   - Persist changes immediately and show a non-blocking status message on success/failure.
3. Update the template rendering logic so favorites are ordered first:
   - Favorites section first, then the remaining templates.
   - Keep the currently selected template visible even when the search query is active.
4. Ensure the feature is resilient:
   - Favorites must not break selection persistence (`pg.selectedTemplateId`).
   - Storage failures must be user-visible (reuse the existing storage error UX).

**Implementation requirements**
- Write complete, working JavaScript (no placeholder logic).
- Do not add new permissions.
- Keep UI language consistent with the existing UI.

**Verification**
- Commands:
  - `npm test`
- Manual:
  1. Create or import multiple templates in the Options page.
  2. In the Side Panel, favorite 2 templates and confirm they appear at the top.
  3. Reload the Side Panel and confirm favorites persist.
  4. Use the search box and confirm favorites and non-favorites behave correctly.

After completing this prompt, proceed to [OPT-1].

---

## OPT

### [OPT-1] Modularize Side Panel code
Execute this prompt now, then proceed to [OPT-2].

**Improvement ID:** `opt-sidepanel-modularize-001`

**Task**
Refactor the Side Panel implementation to reduce file size and separate responsibilities. Keep behavior identical, but split logic into smaller ES modules so future changes are safer and more testable.

**Target files**
- `promptgen-extension/sidepanel/sidepanel.js`
- (Create) one or more modules under `promptgen-extension/sidepanel/`
- (Optional) add Node tests under `tests/` for extracted pure functions

**Steps**
1. Identify pure logic that can be extracted without DOM or `chrome.*` dependencies (for example: search normalization, template filtering, ordering rules).
2. Move the extracted logic into a new module (for example, `template_filter.js`) and import it from `sidepanel.js`.
3. Extract Side Panel storage-load glue into a small module (for example, `sidepanel_storage.js`) if it meaningfully reduces complexity.
4. Keep `sidepanel.js` as the orchestrator that wires:
   - initialization
   - event listeners
   - UI updates
5. If you extract any pure functions, add Node tests using `node:test` so the behavior is locked down.

**Implementation requirements**
- No behavior changes unless explicitly required by the refactor.
- No placeholders like `// TODO` or `/* omitted */`.
- Keep module boundaries simple and documented by naming (no deep nesting).

**Verification**
- Commands:
  - `npm test`
- Manual:
  1. Load the unpacked extension.
  2. Confirm template switching, search, reset, preview, copy, and persistence still work.

After completing this prompt, proceed to [OPT-2].

---

### [OPT-2] Further modularize Options page
Execute this prompt now, then proceed to [COMPLETION].

**Improvement ID:** `opt-options-modularize-001`

**Task**
Continue modularizing the Options page to reduce complexity and isolate concerns. The Options page already has `persistence.js` and `quick_options.js`; split additional responsibilities out of `options.js` without changing behavior.

**Target files**
- `promptgen-extension/options/options.js`
- `promptgen-extension/options/persistence.js`
- `promptgen-extension/options/quick_options.js`
- (Create) one or more modules under `promptgen-extension/options/`

**Steps**
1. Extract cohesive areas into modules, such as:
   - DOM helpers (`el()` wrappers, status helpers)
   - template list rendering and selection
   - import/export handlers
   - editor read/fill helpers
2. Keep all imports relative and ES-module compatible.
3. Ensure the refactor keeps the same IDs, storage keys, and UI behavior.

**Implementation requirements**
- No behavior changes unless explicitly required by the refactor.
- Keep changes incremental (small modules, clear boundaries).
- Do not introduce new dependencies.

**Verification**
- Commands:
  - `npm test`
- Manual:
  1. Open the Options page.
  2. Verify create/clone/delete, generate fields, and import/export still work.

After completing this prompt, proceed to [COMPLETION].

---

## COMPLETION
1. Confirm every prompt above is marked as Done.
2. Run final verification:
   - `npm test`
   - `npm run package:ext`
3. Print exactly:
   - `ALL PROMPTS COMPLETED. All pending improvement and optimization items from the latest report have been applied.`
