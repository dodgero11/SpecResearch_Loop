# Fix: Confirmation Question Stacking on Re-run of `understand`

## Problem

When a user re-runs `POST .../clarify/understand`, the backend regenerates the
`Clarification` row (via upsert) but **never touches the `ConfirmationQuestion`
table**. Combined with the partial cleanup inside `questions()`, this creates
three accumulation scenarios:

| Scenario | Result |
|---|---|
| `understand` → `questions` → `understand` (no re-question) | Old answered rows stay forever |
| `understand` → `questions` → answer → `understand` → `questions` | New batch + answered batch co-exist |
| `understand` → `questions` → answer → `understand` → `questions` → answer (repeated) | Answered rows pile up indefinitely |

Root causes:

1. **`understand()` never deletes questions** — re-running it leaves all
   previous questions (answered and unanswered) in the DB.
2. **`questions()` only deletes `answeredAt: null` rows** — answered rows are
   never evicted, and no lifecycle event cleans them up.

---

## Fix Strategy

### Option A — Delete ALL questions inside `understand()` *(chosen)*

When `understand` is called, the user is starting over from the clarification
step. Any previously generated questions (answered or not) belong to the
**old understanding** and are stale. Delete them all atomically inside the same
transaction that upserts the `Clarification`.

**Pros:** Simple, single-place fix, no new endpoint needed.
**Cons:** Answered question history is lost on re-understand (acceptable —
the Decision Log already captures the semantic answers via `decisions.record`).

### Option B — Keep answered rows, add a `clarificationVersion` column

More complex; overkill for the current single-spec-per-project model.

---

## Files to Change

### `clarify.service.ts` — `understand()` method

Wrap the clarification upsert **and** a full question purge inside a single
`$transaction`. The AI call happens before the transaction (no DB side-effects
if the AI call fails).

```typescript
async understand(projectId: string, idea: string, feedback?: string) {
  await this.assertProject(projectId);
  const response = await this.ai.understandIdea(idea, feedback);
  const output = response.output;
  const clarifiedIdea = String(output.clarified_idea ?? "");
  const keyIssues = Array.isArray(output.key_issues)
    ? output.key_issues.map(String)
    : [];
  const confidence =
    typeof output.confidence === "number" ? output.confidence : null;

  // FIX: purge ALL stale questions (answered or not) atomically with the
  // clarification upsert. Questions generated from a previous understanding
  // are semantically invalid once the understanding changes.
  await this.prisma.$transaction([
    this.prisma.confirmationQuestion.deleteMany({ where: { projectId } }),
    this.prisma.clarification.upsert({
      where: { projectId },
      create: { projectId, idea, clarifiedIdea, keyIssues, confidence, feedback },
      update: { idea, clarifiedIdea, keyIssues, confidence, feedback },
    }),
  ]);

  return { clarifiedIdea, keyIssues, confidence };
}
```

### `clarify.service.ts` — `questions()` method

No change required. The existing `deleteMany({ where: { projectId, answeredAt: null } })`
stays as a safety net for the case where `questions()` is called twice without
answering in between.

---

## No Other Files Need Changing

- No controller changes.
- No DTO changes.
- No Prisma schema changes (no migration needed).

---

## Acceptance Criteria

- [ ] Re-running `understand` leaves zero `ConfirmationQuestion` rows from the
      previous run in the DB.
- [ ] `understand` -> `questions` -> answer -> `understand` -> `questions`
      returns only the freshly generated questions.
- [ ] Repeated re-understand cycles do not accumulate rows.
- [ ] Decision Log entries (table `Decision`, written by `answer()`) are
      **not** affected — they live in a separate table.

---

## Optional: One-off DB Cleanup for Existing Data

```sql
-- Remove orphaned answered questions whose understanding has since changed.
-- Safe: answered content is already captured in the Decision table.
DELETE FROM "ConfirmationQuestion"
WHERE "answeredAt" IS NOT NULL;
```

---

## Implementation Steps

1. Open `backend/src/clarify.service.ts`.
2. In `understand()`, replace the standalone `prisma.clarification.upsert()`
   call with a `prisma.$transaction([deleteMany, upsert])` array transaction.
3. Run smoke-test: understand -> questions -> answer -> re-understand -> questions
   and confirm only the new batch appears.
