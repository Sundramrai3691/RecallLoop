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
    recentMistakes: Array<{ conceptId: string; conceptName?: string; mistakes: string[]; submittedAt?: string }>;
}

export interface KnowledgeRole {
  id: string;
  name: string;
  description: string;
  domainName: string;
  skills: Array<{ id: string; name: string; priority: number; targetMastery: number }>;
}

export interface KnowledgeRoadmapRole extends KnowledgeRole {
  skills: Array<{
    id:string; name:string; description:string; priority:number; targetMastery:number;
    status:"not_started"|"studied"|"assessed";
    topics:Array<{
      id:string; name:string; description:string;
      status:"not_started"|"studied"|"assessed";
      concepts:Array<{
        id:string; name:string; description:string; difficulty:number;
        status:"not_started"|"studied"|"assessed";
        prerequisites:Array<{id:string;name:string;topicId:string;status:"not_started"|"studied"|"assessed"}>;
        resources:Array<{id:string;title:string;url:string;provider:string;estimatedMinutes:number}>;
        knowledgePoints:Array<{id:string;statement:string;importance:number;difficulty:number;evidence:{status:"correct"|"partial"|"missing"|"assessed"|"not_assessed";attemptCount:number}}>;
      }>;
    }>;
  }>;
}

export interface KnowledgeCheckSubject {
  id: string;
  domainName: string;
  name: string;
  description: string;
  topics: Array<{
    id: string;
    name: string;
    description: string;
    concepts: Array<{
      id: string;
      name: string;
      description: string;
        knowledgePoints: Array<{ id: string; statement: string; importance: number; difficulty: number }>;
      coverage: Record<string, number>;
        currentRevisionCount: number;
        awaitingReviewCount: number;
        eligibleCount: number;
        availability: "available" | "partial" | "awaiting_review" | "insufficient_eligible_questions" | "study_only";
      supportedModes: Array<"rapid_fire" | "deep_recall" | "mastery_check" | "practice">;
    }>;
  }>;
}

export interface BaselineQuestion {
  id: string;
  conceptId: string;
  knowledgePointId?: string | null;
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
  conceptName: string;
  reason: string;
  conceptsCovered: string[];
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
  pageNumber?: number | null;
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
  sourceUrl?: string | null;
  canonicalTopicId?: string | null;
  canonicalConceptId?: string | null;
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
  canonicalConceptId?: string | null;
  parentConceptId: string | null;
  requiredKnowledgePoints: string[];
  difficulty: number;
  mastery: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePointResult {
  point: string;
  canonicalKnowledgePointId?: string | null;
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
  questionData: null | { assessmentLevel: string; difficulty: number; title: string; context: string; prompt: string; estimatedMinutes: number; options: Array<{ id: string; text: string }> | null; parts?: StructuredQuestionPart[] | null; revealedHints: string[]; hintsRemaining: number; explanation?: string; rubric?: Array<{ id?: string; label?: string; weight?: number; fullCredit?: string; partialCredit?: string; insufficient?: string }> };
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
  retryable?: boolean;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, code: string, options: { retryable?: boolean; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = options.retryable;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
