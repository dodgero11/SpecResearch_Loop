/**
 * Pure mapping helpers between the backend's free-form spec context (camelCase,
 * `SpecData = Record<string, unknown>`) and the Python AI service's strict
 * snake_case request/response schemas (`JudgesPanelRequest`/`JudgesPanelResponse`).
 *
 * Mapping is deliberately defensive: spec data is user-entered and free-form, so
 * strings are coerced into stub objects and missing fields get neutral defaults
 * instead of failing the remote call with a 422.
 */

export type JsonRecord = Record<string, unknown>;

export const PANEL_JUDGE_TYPES = ['gap', 'contribution', 'experiment', 'evidence', 'conference-readiness'] as const;
export type PanelJudgeType = (typeof PANEL_JUDGE_TYPES)[number];

export type PanelRequest = {
  problem: string;
  gap: string;
  related_work: JsonRecord[];
  contribution: string;
  claims: JsonRecord[];
  experiments: JsonRecord[];
  evidence: string[];
};

/** Maps a backend judge task (`gap-judge`) to its panel judge type (`gap`). */
export function judgeTypeFromTask(task: string): PanelJudgeType {
  const match = PANEL_JUDGE_TYPES.find((type) => `${type}-judge` === task);
  if (!match) {
    const supported = PANEL_JUDGE_TYPES.map((type) => `${type}-judge`).join(', ');
    throw new Error(`Unsupported LLM task "${task}": the AI service adapter supports ${supported}`);
  }
  return match;
}

/** Builds the AI service `POST /ai/v1/judges/panel` request body from backend context. */
export function toPanelRequest(inputContext: Record<string, unknown>): PanelRequest {
  return {
    problem: asString(inputContext.problem),
    gap: asString(inputContext.gap),
    related_work: asArray(inputContext.relatedWork).map(toRelatedWorkItem),
    contribution: toContributionText(inputContext.contribution),
    claims: asArray(inputContext.claims).map(toClaimCard),
    experiments: toExperiments(inputContext.experiment, inputContext.baselines),
    evidence: asArray(inputContext.evidence).map((item) => asString(item)).filter((item) => item.length > 0),
  };
}

/** Extracts one judge result from a panel response; throws when the judge is missing. */
export function sliceJudge(panelResponse: JsonRecord, judgeType: PanelJudgeType): JsonRecord {
  const match = asArray(panelResponse.judges).find((judge) => asString(asRecord(judge).type) === judgeType);
  if (!match) {
    throw new Error(`AI service panel response did not include a "${judgeType}" judge result`);
  }
  return toJudgeResult(match);
}

/** Normalizes a full panel response to `{ status, judges }` (backend owns spec versioning). */
export function toPanelOutput(panelResponse: JsonRecord): JsonRecord {
  return {
    status: asString(panelResponse.status, 'COMPLETED'),
    judges: asArray(panelResponse.judges).map(toJudgeResult),
  };
}

function toJudgeResult(value: unknown): JsonRecord {
  const record = asRecord(value);
  return {
    type: asString(record.type),
    verdict: asString(record.verdict, 'REVIEW_REQUIRED'),
    issues: Array.isArray(record.issues) ? record.issues : [],
  };
}

function toRelatedWorkItem(value: unknown): JsonRecord {
  if (typeof value === 'string') {
    return {
      paper_title: value,
      authors: '',
      year: 0,
      what_they_did: '',
      feedback: '',
      missing_points: '',
      source_url: /^https?:\/\//i.test(value) ? value : '',
    };
  }
  const record = asRecord(value);
  return {
    paper_title: asString(record.paper_title ?? record.paperTitle ?? record.title),
    authors: asJoinedString(record.authors),
    year: typeof record.year === 'number' ? record.year : 0,
    what_they_did: asString(record.what_they_did ?? record.whatTheyDid),
    feedback: asString(record.feedback),
    missing_points: asString(record.missing_points ?? record.missingPoints),
    source_url: asString(record.source_url ?? record.sourceUrl),
  };
}

function toClaimCard(value: unknown): JsonRecord {
  if (typeof value === 'string') {
    return { claim: value, baseline: '', metric: '', evidence: '', rejection_condition: '' };
  }
  const record = asRecord(value);
  return {
    claim: asString(record.claim),
    baseline: asString(record.baseline),
    metric: asString(record.metric),
    evidence: asString(record.evidence),
    rejection_condition: asString(record.rejection_condition ?? record.rejectionCondition),
  };
}

function toExperiments(experiment: unknown, baselines: unknown): JsonRecord[] {
  const source = experiment !== undefined ? experiment : baselines;
  if (typeof source === 'string') {
    return source.trim() ? [{ name: 'Experiment plan', protocol: source, expected_outcome: '' }] : [];
  }
  return asArray(source).map((item) => {
    if (typeof item === 'string') {
      return { name: item, protocol: '', expected_outcome: '' };
    }
    const record = asRecord(item);
    return {
      name: asString(record.name),
      protocol: asString(record.protocol),
      expected_outcome: asString(record.expected_outcome ?? record.expectedOutcome),
    };
  });
}

function toContributionText(contribution: unknown): string {
  if (Array.isArray(contribution)) {
    return contribution.map((item) => asString(item)).filter((item) => item.length > 0).join('; ');
  }
  return asString(contribution);
}

/** Joins array values (e.g. author lists) into the comma-separated string the AI service expects. */
function asJoinedString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter((item) => item.length > 0).join(', ');
  }
  return asString(value);
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}
