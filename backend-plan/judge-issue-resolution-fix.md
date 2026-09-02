# Fix Judge Issue Resolution: Make Spec Changes Stick & Ensure Choices Always Exist

## Problem Summary

Two bugs in the judge issues flow (Step 5):

1. **Issues not truly resolved**: Only `gap`-type issues actually rewrite spec content. The other 4 judge types (`contribution`, `experiment`, `evidence`, `conference-readiness`) just mark the issue `RESOLVED` in the DB, but then `runJudge()` re-runs the judge, which finds the same problems (spec unchanged) and re-creates identical issues. The frontend goes forward and can't go back.

2. **Empty choices**: Some issues arrive from the AI with no `choices` array, leaving users with nothing to click.

---

## Root Cause Analysis

### Bug 1 — Resolved issues reappear

**Current flow in `issue.service.ts` → `resolve()`:**

```
User clicks "Xác nhận xử lý" with choice "A"
  → issue.status = "RESOLVED" in DB               ✅
  → if (judgeType === "gap") → rewrite spec        ✅ (only for gap)
  → else → nothing changes in the spec             ❌
  → runJudge() re-runs the single judge             
  → persistIssues() deletes non-RESOLVED issues     
  → persistIssues() creates NEW issues from output  ← identical issues come back!
```

**Why gap works but others don't:**
- `gap`: calls `ai.gapAnalysis(instruction)` → writes revised `data.gapAnalysis` → new SpecIteration → judge re-runs on the **changed** spec → different/no issues
- `contribution/experiment/evidence/conference-readiness`: no revision call → spec unchanged → judge re-runs on **same** spec → same issues re-created

### Bug 2 — Empty choices

The `IssueSchema` in the AI service defines `choices` as `Optional[List[IssueChoice]]` with `default=None`. When the LLM doesn't produce choices in its structured output, the field stays `None`/`[]`. The backend's `persistIssues()` stores whatever comes back. The frontend's `ChoicePanel` shows "Judge chưa đề xuất lựa chọn xử lý nào cho issue này."

---

## Spec Data ↔ Judge Type Mapping

| Judge Type | JUDGE_NODE | Spec Data Field(s) Evaluated | Context Fields Used |
|---|---|---|---|
| `gap` | `gap` | `data.gapAnalysis` | `problem`, `gap`, `relatedWork` |
| `contribution` | `contribution` | `data.experimentPlan.contributions` | `problem`, `gap`, `contribution`, `relatedWork` |
| `experiment` | `experiment` | `data.experimentPlan.experiments` + claims | `claims`, `experiments` |
| `evidence` | `claim` | `experimentPlan.contributions[].claimEvidence` + SpecCards(EVIDENCE) | `claims`, `evidence`, `relatedWork` |
| `conference-readiness` | `judge` | ALL fields (cross-cutting) | ALL context fields |

---

## Proposed Changes

### Layer 1: Python AI Service — New Generic Revision Endpoint

> **Key decision**: One generic `POST /ai/v1/revise-section` endpoint handles all section types. Avoids creating 4+ separate endpoints.

#### [MODIFY] `ai_service/schemas/spec_schemas.py`

Add new Pydantic models:

```python
class ReviseSectionRequest(BaseModel):
    section_type: str = Field(description="contribution | experiment | evidence | conference-readiness")
    current_content: Any = Field(description="Current content of the section to revise")
    instruction: str = Field(description="User's revision instruction")
    context: Optional[dict] = Field(default=None, description="Additional context (problem, gap, etc.)")

class ReviseSectionResponse(BaseModel):
    revised_content: Any = Field(description="Revised section content in the same shape as input")
    summary: str = Field(default="", description="Brief description of what was changed")
```

#### [MODIFY] `ai_service/routers/ai_router.py`

Add route:

```python
@router.post("/ai/v1/revise-section", response_model=ReviseSectionResponse)
async def revise_section(request: ReviseSectionRequest):
    result = llm_service.revise_section(
        section_type=request.section_type,
        current_content=request.current_content,
        instruction=request.instruction,
        context=request.context or {}
    )
    return result
```

#### [MODIFY] `ai_service/services/llm_service.py`

Add `revise_section()` method + fallback mock:

```python
def revise_section(self, section_type: str, current_content: Any, instruction: str, context: dict) -> ReviseSectionResponse:
    prompt = f"""
System: You are a research spec revision assistant. Revise the following {section_type} section
based on the user's instruction. Return the revised content in the EXACT SAME JSON shape as the input.

Current content:
{json.dumps(current_content, ensure_ascii=False, indent=2)}

Revision instruction: {instruction}

Additional context:
Problem: {context.get('problem', '')}
Gap: {context.get('gap', '')}

Return a JSON with:
- revised_content: the revised section in the same shape
- summary: brief Vietnamese description of what was changed
"""
    return self.call_gemini_structured(prompt, ReviseSectionResponse, context={"section_type": section_type})
```

Mock fallback (for `USE_MOCK=true`):
```python
elif response_schema == ReviseSectionResponse:
    return ReviseSectionResponse(
        revised_content=context.get("current_content", {}),
        summary="Mock: nội dung đã được sửa theo yêu cầu."
    )
```

---

### Layer 2: Backend — AI Gateway Extension

#### [MODIFY] `backend/src/integrations/ai-gateway.port.ts`

Add 4 new methods to the `AiGateway` interface:

```typescript
/** POST /ai/v1/revise-section — { section_type: "contribution", ... } */
contributionRevision(currentContent: unknown, instruction: string, context: Record<string, unknown>): Promise<AiGatewayResponse>;
/** POST /ai/v1/revise-section — { section_type: "experiment", ... } */
experimentRevision(currentContent: unknown, instruction: string, context: Record<string, unknown>): Promise<AiGatewayResponse>;
/** POST /ai/v1/revise-section — { section_type: "evidence", ... } */
evidenceRevision(currentContent: unknown, instruction: string, context: Record<string, unknown>): Promise<AiGatewayResponse>;
/** POST /ai/v1/revise-section — { section_type: "conference-readiness", ... } */
conferenceReadinessRevision(currentContent: unknown, instruction: string, context: Record<string, unknown>): Promise<AiGatewayResponse>;
```

#### [MODIFY] `backend/src/integrations/http-ai-gateway.adapter.ts`

All 4 delegate to one private helper:

```typescript
private async reviseSection(
  sectionType: string,
  currentContent: unknown,
  instruction: string,
  context: Record<string, unknown>,
): Promise<AiGatewayResponse> {
  return this.call('/ai/v1/revise-section', {
    section_type: sectionType,
    current_content: currentContent,
    instruction,
    context,
  });
}

async contributionRevision(currentContent: unknown, instruction: string, context: Record<string, unknown>): Promise<AiGatewayResponse> {
  return this.reviseSection('contribution', currentContent, instruction, context);
}
// ... same pattern for experiment, evidence, conference-readiness
```

#### [MODIFY] `backend/src/integrations/local-ai-gateway.adapter.ts`

Add mock implementations that return the input content with a small modification:

```typescript
async contributionRevision(currentContent: unknown, instruction: string, context: Record<string, unknown>): Promise<AiGatewayResponse> {
  return {
    output: {
      revised_content: currentContent,
      summary: "Mock: đóng góp đã được sửa theo yêu cầu.",
    },
    inputTokens: JSON.stringify(currentContent).length,
    outputTokens: 1,
  };
}
// ... same for experiment, evidence, conference-readiness
```

---

### Layer 3: Backend — Issue Resolution Logic (Core Fix)

#### [MODIFY] `backend/src/issue.service.ts`

Extend `resolve()` from a single `if (judgeType === "gap")` to handle all 5 types.

**Pattern for each type:**
1. Read current section content from latest spec
2. Build `instruction` from user's choice (same logic as gap)
3. Call the type-specific AI gateway method
4. Create a new spec iteration with revised content
5. Record before/after for diff display

```typescript
async resolve(projectId: string, issueId: string, choice: string, customChoice?: string) {
  const issue = await this.prisma.judgeIssue.findFirst({ where: { id: issueId, projectId } });
  if (!issue) throw new NotFoundException(`Issue ${issueId} was not found`);
  
  const judgeType = issue.judgeType as JudgeType;
  const invalidatedNodes = this.dependencyGraph.getAffectedNodes(JUDGE_NODE[judgeType]);

  // Build instruction from choice
  const choices = Array.isArray(issue.choices)
    ? (issue.choices as { letter: string; understanding: string }[])
    : [];
  const instruction =
    customChoice ??
    choices.find((c) => c.letter === choice)?.understanding ??
    issue.description;

  let before: unknown;
  let after: unknown;

  const specBefore = await this.projects.latestSpec(projectId);
  const data = specBefore.data as SpecData;

  // Provide common context for the AI
  const context = {
    problem: String((data as any).problem ?? ''),
    gap: String(((data as any).gapAnalysis as any)?.limitation ?? ''),
  };

  if (judgeType === "gap") {
    // ... existing gap logic (unchanged)
  } else if (judgeType === "contribution") {
    const experimentPlan = (data.experimentPlan ?? {}) as Record<string, unknown>;
    const contributions = experimentPlan.contributions ?? [];
    before = contributions;

    const response = await this.ai.contributionRevision(contributions, instruction, context);
    after = response.output.revised_content ?? contributions;

    await this.projects.createSpec(projectId, {
      ...data,
      experimentPlan: { ...experimentPlan, contributions: after },
    });

  } else if (judgeType === "experiment") {
    const experimentPlan = (data.experimentPlan ?? {}) as Record<string, unknown>;
    const experiments = experimentPlan.experiments ?? [];
    before = experiments;

    const response = await this.ai.experimentRevision(experiments, instruction, context);
    after = response.output.revised_content ?? experiments;

    await this.projects.createSpec(projectId, {
      ...data,
      experimentPlan: { ...experimentPlan, experiments: after },
    });

  } else if (judgeType === "evidence") {
    const experimentPlan = (data.experimentPlan ?? {}) as Record<string, unknown>;
    const contributions = (experimentPlan.contributions ?? []) as Array<Record<string, unknown>>;
    // Extract claim-evidence pairs for revision
    const claimEvidencePairs = contributions
      .filter((c) => c.claimEvidence)
      .map((c) => c.claimEvidence);
    before = claimEvidencePairs;

    const response = await this.ai.evidenceRevision(claimEvidencePairs, instruction, context);
    const revisedPairs = (response.output.revised_content ?? claimEvidencePairs) as unknown[];

    // Map revised evidence back into contributions
    let pairIndex = 0;
    const revisedContributions = contributions.map((c) => {
      if (c.claimEvidence && pairIndex < revisedPairs.length) {
        return { ...c, claimEvidence: revisedPairs[pairIndex++] };
      }
      return c;
    });
    after = revisedPairs;

    await this.projects.createSpec(projectId, {
      ...data,
      experimentPlan: { ...experimentPlan, contributions: revisedContributions },
    });

  } else if (judgeType === "conference-readiness") {
    // Cross-cutting: send the full spec snapshot
    const fullSnapshot = {
      gapAnalysis: data.gapAnalysis,
      experimentPlan: data.experimentPlan,
      relatedWork: data.relatedWork,
    };
    before = fullSnapshot;

    const response = await this.ai.conferenceReadinessRevision(fullSnapshot, instruction, context);
    const revised = (response.output.revised_content ?? {}) as Record<string, unknown>;
    after = revised;

    // Merge the revised fields back — only overwrite fields the AI actually returned
    const nextData = { ...data };
    if (revised.gapAnalysis !== undefined) nextData.gapAnalysis = revised.gapAnalysis;
    if (revised.experimentPlan !== undefined) {
      nextData.experimentPlan = {
        ...((data.experimentPlan ?? {}) as object),
        ...(revised.experimentPlan as object),
      };
    }
    if (revised.relatedWork !== undefined) nextData.relatedWork = revised.relatedWork;

    await this.projects.createSpec(projectId, nextData);
  }

  // --- Common tail: unchanged from current code ---
  const spec = await this.projects.latestSpec(projectId);

  const updatedIssue = await this.prisma.$transaction(async (tx) => {
    const updated = await tx.judgeIssue.update({
      where: { id: issueId },
      data: {
        status: "RESOLVED",
        resolvedChoice: choice,
        customResolution: customChoice,
      },
    });
    for (const node of invalidatedNodes) {
      await tx.specArtifact.upsert({
        where: { specIterationId_node: { specIterationId: spec.id, node } },
        create: { projectId, specIterationId: spec.id, node, status: "STALE", data: {} },
        update: { status: "STALE" },
      });
    }
    await this.decisions.record(projectId, "ACCEPT", `issue:${issueId}`, { choice, customChoice }, tx);
    return updated;
  });

  const judgeResult = await this.judges.runJudge(projectId, judgeType);
  return { updatedIssue, invalidatedNodes, judgeResult, before, after };
}
```

---

### Layer 4: Backend — Fallback Choices on Persist

#### [MODIFY] `backend/src/judge.service.ts`

In `persistIssues()`, after building the issue record, check if `choices` is empty and inject defaults:

```typescript
const DEFAULT_ISSUE_CHOICES = [
  { letter: "A", label: "Áp dụng đề xuất của Judge", understanding: "Thực hiện gợi ý sửa đổi mà Judge đã nêu." },
  { letter: "B", label: "Giữ nguyên, chấp nhận rủi ro", understanding: "Không thay đổi nội dung, ghi nhận issue đã xem xét." },
  { letter: "C", label: "Other", understanding: "Tự nhập phương án xử lý." },
];

// Inside persistIssues(), where issues are created:
for (const issue of issues) {
  const record = issue as Record<string, unknown>;
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  const choices = rawChoices.length > 0 ? rawChoices : DEFAULT_ISSUE_CHOICES;
  
  await this.prisma.judgeIssue.create({
    data: {
      // ... existing fields ...
      choices: choices as Prisma.InputJsonValue,
    },
  });
}
```

---

### Layer 5: Frontend — ChoicePanel & Spec Refresh

#### [MODIFY] `frontend/components/steps/step-5/choice-panel.tsx`

Expand `SUPPORTED_REVISION_TYPES` from `['gap']` to all 5 types:

```typescript
const SUPPORTED_REVISION_TYPES = ['gap', 'contribution', 'experiment', 'evidence', 'conference-readiness']
```

This makes the diff view ("Nội dung đã được sửa lại" before/after columns) show for ALL resolved issues.

#### [MODIFY] `frontend/components/steps/step-5/index.tsx`

After `handleResolveIssue` succeeds, refresh the temporary spec panel so the user sees updated content:

```typescript
async function handleResolveIssue(issueId: string, choice: string, customChoice?: string) {
  if (!projectId) return
  setError(null)
  try {
    const result = await apiPost<{ before?: unknown; after?: unknown }>(
      `/projects/${projectId}/issues/${issueId}/resolve`,
      { choice, customChoice }
    )
    if (result.before !== undefined || result.after !== undefined) {
      setResolutionDiffs((prev) => ({ ...prev, [issueId]: { before: result.before, after: result.after } }))
    }
    setIssues((prev) => prev.map((issue) => (issue.id === issueId ? { ...issue, status: 'RESOLVED' } : issue)))
    setActiveIssueId(issues.find((i) => i.id !== issueId && i.status !== 'RESOLVED')?.id ?? null)

    // Refresh the temporary spec panel to show updated content
    const temp = await apiGet<RawTemporary>(`/projects/${projectId}/spec/temporary`)
    setSpecItems(toSpecItems(temp))
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Xử lý issue thất bại, thử lại.')
  }
}
```

---

## File Change Summary

| Layer | File | Action | Description |
|---|---|---|---|
| AI Service | `schemas/spec_schemas.py` | MODIFY | Add `ReviseSectionRequest` + `ReviseSectionResponse` |
| AI Service | `routers/ai_router.py` | MODIFY | Add `POST /ai/v1/revise-section` route |
| AI Service | `services/llm_service.py` | MODIFY | Add `revise_section()` + mock fallback |
| Backend | `integrations/ai-gateway.port.ts` | MODIFY | Add 4 revision methods to interface |
| Backend | `integrations/http-ai-gateway.adapter.ts` | MODIFY | Implement 4 methods via `reviseSection()` helper |
| Backend | `integrations/local-ai-gateway.adapter.ts` | MODIFY | Add 4 mock implementations |
| Backend | `issue.service.ts` | MODIFY | Extend `resolve()` for all 5 judge types |
| Backend | `judge.service.ts` | MODIFY | Add `DEFAULT_ISSUE_CHOICES` fallback in `persistIssues()` |
| Frontend | `step-5/choice-panel.tsx` | MODIFY | Expand `SUPPORTED_REVISION_TYPES` to all 5 |
| Frontend | `step-5/index.tsx` | MODIFY | Refresh spec panel after resolve |

---

## Verification Plan

### Automated Tests

```bash
cd d:\GitHub\SpecResearch_Loop\backend
npx jest --testPathPattern="issue.service" --verbose
npx jest --testPathPattern="judge.service" --verbose
```

Update existing tests + add:
- Resolving a `contribution`-type issue creates a new spec iteration with revised contributions
- Resolving an `experiment`-type issue creates a new spec with revised experiments
- Resolving an `evidence`-type issue updates claim-evidence pairs
- Resolving a `conference-readiness`-type issue applies cross-cutting revision
- Issues always have at least 3 fallback choices when AI returns none
- Re-running judge after resolution with changed spec doesn't recreate the same RESOLVED issue

### Manual Verification

1. Run full stack locally (backend + AI service + frontend)
2. Go through Steps 1-4 to generate a spec
3. At Step 5, run judges panel
4. Pick a **non-gap** issue → verify choices are present (including fallback ones)
5. Resolve it → verify the spec content changes (temporary spec panel updates in left column)
6. Verify the issue stays RESOLVED and doesn't reappear as a new identical issue
7. Check that the before/after diff view shows for all judge types

---

## Open Questions

1. **Conference-readiness cross-cutting revision**: The AI receives the full spec snapshot and returns revised fields. If the LLM only partially revises (e.g., only touches `experimentPlan` but not `gapAnalysis`), we merge only the returned fields. Is this acceptable, or should we require the AI to always return the complete snapshot?

2. **New issues from re-runs**: After resolution rewrites the spec, the re-run judge may find *new* (different) issues. These appear as new rows in the issue list. Should we surface this to the user (e.g., "Spec đã được sửa, Judge phát hiện 1 vấn đề mới") or let them just appear?

