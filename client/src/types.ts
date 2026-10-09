export type SourceType = "manual" | "notes" | "url" | "file";
export type SessionStatus = "in_progress" | "completed";
export type QuestionType = "mcq" | "rapid_recall" | "short_explanation" | "descriptive" | "comparison" | "scenario" | "application" | "transfer" | "explain" | "compare" | "coding";
export type KnowledgePointStatus = "correct" | "partial" | "missing";
export interface StructuredQuestionPart { id: string; label: string; prompt: string; knowledgePoints: string[]; rubric: string[]; }

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  goalType: string;
  targetDate: string | null;
  weeklyTimeBudgetMinutes: number;
  status: string;
}

export interface Skill {
  id: string;
  goalId: string;
  name: string;
  description: string;
  priority: number;
  targetMastery: number;
  currentMastery: number | null;
}

export interface PlanTask {
  id: string;
  taskType: "recall" | "learn" | "practice" | "remediation" | "assessment";
  title: string;
  description: string;
  priority: number;
  estimatedMinutes: number;
  scheduledFor: string;
  status: string;
  source: string;
  reason: string;
  conceptId: string | null;
  recallAttemptId: string | null;
  category: "must_do" | "recommended" | "optional";
  requiredness: "must" | "recommended" | "optional";
  sequenceOrder: number;
  resourceUrl: string | null;
}

export interface LearnerSummary {
  totalConcepts: number;
  assessedConcepts: number;
  averageMastery: number | null;
  dueConcepts: number;
  weakConceptCount: number;
  weakSkills: Array<{ skillId: string; name: string; priority: number; targetMastery: number; currentMastery: number | null; status: string }>;
  weakConcepts: Array<{
    conceptId: string;
    conceptName: string;
    mastery: number;
    status: string;
    mistakeCount: number;
  }>;
  recentMistakes: Array<{ conceptId: string; mistakes: string[]; submittedAt?: string }>;
}

export interface KnowledgeRole {
  id: string;
  name: string;
  description: string;
  domainName: string;
  skills: Array<{ id: string; name: string; priority: number; targetMastery: number }>;
}

export interface BaselineQuestion {
  id: string;
  conceptId: string;
  level: string;
  question: string;
  answer: string | null;
  coverage: number | null;
  confidence: number | null;
  knowledgePointResults?: KnowledgePointResult[] | null;
  submittedAt: string | null;
}

export interface ResourceRecommendation {
  id: string;
  title: string;
  url: string;
  provider: string;
  resourceType?: string;
  estimatedMinutes: number;
  difficulty: number;
  description: string;
  trustTier: number;
  conceptName: string;
  reason: string;
  conceptsCovered: string[];
  freshness?: string;
  score?: number;
  reasons?: Array<{code:string;text:string}>;
}

export interface GroundedRemediationSource {
  chunkId: string;
  sourceId: string;
  title: string;
  sourceType: string;
  reference: string;
  provenance: Record<string, unknown>;
  relevance: number;
  chunkOrder: number;
  text: string;
}

export interface GroundedRemediation {
  id: string;
  conceptId: string;
  conceptName: string;
  triggeringAttemptId: string;
  knowledgePoint: string;
  reason: string;
  evidence: { status: string; feedback: string; confidence: number | null; mistakes: string[]; attemptCount: number };
  status: "pending" | "insufficient_sources" | "failed" | "ready" | "verification_created" | "verified";
  content: null | { title: string; whyThis: string; explanation: string; keyPoints: string[]; commonMistake: string; checkYourself: string[]; unsupportedAspects: string[] };
  generationError: string | null;
  triggerScore: number | null;
  verificationAttemptId: string | null;
  verificationScore: number | null;
  improved: boolean | null;
  sources: GroundedRemediationSource[];
  fallbackResources: ResourceRecommendation[];
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  userId?: string;
  title: string;
  rawMaterial?: string;
  sourceType: SourceType;
  startedAt: string;
  completedAt: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Concept {
  id: string;
  studySessionId: string;
  name: string;
  description: string;
  parentConceptId: string | null;
  requiredKnowledgePoints: string[];
  difficulty: number;
  mastery: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePointResult {
  point: string;
  status: KnowledgePointStatus;
  evidence: string;
  feedback: string;
  partId?: string | null;
}

export interface RecallEvaluation {
  overallCoverage: number;
  knowledgePointResults: KnowledgePointResult[];
  missingConcepts: string[];
  mistakes: string[];
  strengths: string[];
  feedback: string;
  suggestedRecallType: QuestionType;
  evaluatorVersion: string;
}

export interface RecallAttempt {
  id: string;
  conceptId: string;
  studySessionId: string;
  question: string;
  questionType: QuestionType;
  questionId?: string | null;
  questionData: null | { assessmentLevel: string; difficulty: number; title: string; context: string; prompt: string; estimatedMinutes: number; options: Array<{ id: string; text: string }> | null; parts?: StructuredQuestionPart[] | null; revealedHints: string[]; hintsRemaining: number };
  answer: string | null;
  structuredAnswers?: Array<{partId:string;answer:string}> | null;
  selectedOptionId: string | null;
  confidence: number | null;
  hintsUsed: number;
  maxHintLevel: number;
  startedAt: string;
  timeTakenSeconds: number | null;
  resultStatus: string | null;
  evidenceWeight: number;
  repetitionReason?: "spaced_recall" | "mastery_confirmation" | "remediation" | null;
  remediationId?: string | null;
  recommendation?: { actionType: "recall" | "learn" | "practice" | "remediation" | "mastery_check" | "none"; title: string; reason: string; estimatedMinutes: number; priority: number } | null;
  evaluation: RecallEvaluation | null;
  submittedAt: string | null;
  createdAt: string;
  concept?: Concept | null;
}

export interface ReviewState {
  conceptId: string;
  state: string;
  dueAt: string;
  intervalDays: number;
  stability: number;
  difficulty: number;
  lastRecallAt: string | null;
  lastOutcome: string | null;
  consecutiveSuccesses: number;
  updatedAt: string;
}

export interface DashboardData {
  generatedAt: string;
  todayDue: {
    recallId: string;
    conceptId: string;
    conceptName: string;
    question: string;
    dueAt: string;
  }[];
  upcoming: {
    conceptId: string;
    conceptName: string;
    dueAt: string;
    intervalDays: number;
  }[];
  recentlyStudied: {
    id: string;
    title: string;
    status: SessionStatus;
    startedAt: string;
    completedAt?: string;
  }[];
  masteryByConcept: {
    id: string;
    name: string;
    mastery: number;
    difficulty: number;
    studySessionId: string;
  }[];
  recallAttemptCount: number;
  submittedRecallCount: number;
  pendingRecallCount: number;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
