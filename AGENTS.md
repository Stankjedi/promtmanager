# agents.md

This document defines global rules for **all AI agents, tools, and automations** that work in this workspace.

The goal is simple: **every explicit instruction from the user must be followed exactly, unless it is impossible, unsafe, or clearly contradictory.**

---

## 🚨 CRITICAL: Anti-Stalling Rules (MUST READ FIRST)

> **⛔ FORBIDDEN BEHAVIORS - These will cause task failure:**
> 
> 1. **DO NOT** say "I'll review..." or "I'll analyze..." and then stop responding
> 2. **DO NOT** provide a plan or summary without executing it
> 3. **DO NOT** respond with only text when file modifications are required
> 4. **DO NOT** complete partial work and wait for approval
> 5. **DO NOT** ask clarification questions when instructions are clear
> 
> **✅ REQUIRED BEHAVIORS:**
> 
> 1. **IMMEDIATELY START** executing TODO items when given a task list
> 2. **USE FILE EDITING TOOLS** (`replace_string_in_file`, `create_file`) to make changes
> 3. **COMPLETE ALL ITEMS** in the TODO list sequentially
> 4. **REPORT PROGRESS** after each TODO completion, then continue to next
> 5. **NEVER STOP** until all TODO items are marked complete

---

## 1. Scope

These rules apply to:

- All AI coding assistants (Chat-based, editor-based, CLI-based, etc.).  
- All automation scripts that generate, modify, or refactor code or documents.  
- All future agents added to this workspace.

If an agent cannot read or respect this file, it **must not** be used on this project.

---

## 2. Instruction obedience (MUST FOLLOW)

1. **The user's explicit instructions are mandatory.**  
   When the user gives a clear instruction, the agent must:
   - Follow it exactly, or  
   - Clearly explain why it cannot follow it (e.g. impossible, unsafe, missing context).

2. **No silent ignoring of instructions.**  
   An agent must not:
   - Silently skip parts of the request.
   - Replace requested behavior with a different one "for convenience".
   - Simplify or truncate requested functionality without saying so.
   - **Say "I'll do X" and then not do X.**
   - **Respond with analysis/review without taking action.**

3. **If something is unclear, ask or state assumptions.**  
   - If the agent cannot safely infer the intention, it must ask a clarification question.  
   - If it chooses to make an assumption, it must write:  
     "Assumption: …" and continue based on that assumption.

4. **Do not self-censor functionality without reason.**  
   - The agent must not remove features, endpoints, files, or logic that the user asked to keep.  
   - If removal or refactor seems necessary, it must propose it first and wait for approval.

---

## 3. Priority of instructions

When instructions conflict, the agent must use this priority order:

1. **Current user message in this workspace.**
2. **Local project rules** (e.g. `agents.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`).  
3. **Tool / agent default behavior or system presets.**

Rules:

- Newer, more specific instructions override older, more generic ones.  
- If there is a real conflict, the agent must:
  - Explain the conflict briefly, and  
  - Ask the user which instruction to follow.

---

## 4. Code and document changes

When modifying files, the agent must:

1. **Stay within the requested scope.**  
   - Only touch files that are clearly related to the user's request.  
   - Do not change project-wide structure unless the user explicitly asks for it.

2. **Keep things working.**  
   - Do not break existing features without warning.  
   - If a breaking change is required, state it clearly and explain why.

3. **Be explicit about side effects.**  
   - If a change affects other modules, services, or configs, the agent must mention it.

---

## 5. Honesty and limitations

1. **No guessing APIs or behavior as facts.**  
   - If the agent is not sure about a library, version, or API, it must say so explicitly.
2. **Separate facts from assumptions.**  
   - Use clear wording like: "Fact: …", "Assumption: …", "Suggestion: …".

---

## 6. Minimal workflow for every agent

Before doing work, every agent must:

1. Read this `agents.md`.  
2. Read any directly relevant project docs (e.g. README, architecture, or feature spec).  
3. Confirm it understands the user's latest instructions.  
4. Ensure required tools are installed and usable in the **current environment** (e.g., install Node.js in WSL and update PATH when missing).  
5. Execute the work while obeying all rules above.  
6. Summarize:
   - What was changed.  
   - Which files were touched.  
   - Any trade-offs, assumptions, or TODO items.

If an agent cannot follow this workflow, it **must not** be used in this workspace.

---

## 7. Task Completion and Verification Rules (MANDATORY)

When executing tasks from `devplan/Prompt.md` or any TODO list, agents MUST:

1. **Use a TODO List Workflow**
   - Create or reference a TODO list at the beginning of any multi-step work.
   - Track each prompt/task as an individual TODO item with clear status updates.
   - Update status in sequence: `⬜ Pending` → `🟡 In Progress` → `✅ Done`.

2. **Complete ALL tasks without skipping**
   - Do NOT stop after completing one prompt if more prompts remain.
   - Process all tasks in order of priority (P1 → P2 → P3) unless explicitly told otherwise.
   - If a task depends on another, complete the dependency first.

3. **Verify each task before marking as Done**
   - Run the Verification steps defined in each prompt (e.g., `pnpm compile`, `pnpm test`).
   - Confirm that all Definition of Done criteria are met.
   - If verification fails, fix the issues and re-run verification.
   - Only mark a task as `✅ Done` after ALL verification steps pass.

4. **Explicit confirmation required**
   - After completing each task, explicitly state:
     - Which files were modified.
     - Which verification steps were run and their results.
     - Any assumptions or trade-offs made.
   - At the end of all tasks, provide a final summary of all completed work.

5. **No partial work allowed**
   - If you cannot complete a task, explain why and what is needed to proceed.
   - Do not leave tasks in an ambiguous state (e.g., "partially done" with no follow-up).

---

## 8. Report and Prompt Generation Rules

When working with `devplan/` reports:

1. **Single Source of Truth**
   - `Project_Improvement_Exploration_Report.md` is the single source for improvement items.
   - `Prompt.md`, `Project_Evaluation_Report.md`, and `Session_History.md` reference or summarize this source.

2. **ID Consistency**
   - Use consistent IDs across all documents:
     - Improvement IDs: `category-sequence` format (e.g., `test-commands-001`)
     - Prompt IDs: `PROMPT-###` format with linked Improvement ID
   - Never create duplicate or conflicting IDs.

3. **Language Rules for Prompt.md**
   - `Prompt.md` MUST be written entirely in English.
   - If source content is in Korean, translate it to English during generation.
   - Verify no Korean characters (가-힣) appear in the final output.

4. **Definition of Done for each Improvement Item**
   - Every improvement item should have clear, measurable completion criteria.
   - These criteria should be reflected in the corresponding Prompt's DoD section.

---

## 9. Report Update Task Execution (CRITICAL)

When receiving a "프로젝트 분석 및 보고서 작성 요청" (Project Analysis and Report Writing Request):

### 🚨 MANDATORY EXECUTION FLOW

1. **DO NOT** just acknowledge or analyze the request
2. **IMMEDIATELY START** with TODO-1 (first file modification)
3. **EXECUTE EACH TODO** by calling file editing tools
4. **REPORT COMPLETION** after each TODO, then continue
5. **NEVER STOP** until all 10 TODOs are complete

### 📋 Expected Execution Pattern

```
[Receive prompt] → [Start TODO-1] → [Edit file] → [Report: "TODO-1 완료"] 
→ [Start TODO-2] → [Edit file] → [Report: "TODO-2 완료"]
→ ... continue until TODO-10 ...
→ [Report: "모든 TODO 완료. 최종 요약:"]
```

### ❌ WRONG Execution Pattern (DO NOT DO THIS)

```
[Receive prompt] → [Say "I'll review the reports..."] → [STOP]
```

### ✅ Correct First Response Example

```
TODO-1 시작: 평가 보고서 파트1 - 프로젝트 개요 섹션 수정

[replace_string_in_file 호출...]

TODO-1 완료: Project_Evaluation_Report.md의 AUTO-OVERVIEW 섹션 수정됨.
TODO-2 시작: 평가 보고서 파트2 - 종합 점수 테이블 수정
...
```
