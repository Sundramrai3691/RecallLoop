export type SourceType = "manual" | "notes" | "url" | "file";
export type SessionStatus = "in_progress" | "completed";
export type QuestionType = "explain" | "compare" | "application" | "coding";
export type KnowledgePointStatus = "correct" | "partial" | "missing";

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
  currentMastery: number;
}

export interface PlanTask {
  id: string;
  taskType: "recall" | "learn" | "practice" | "remediation";
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
}

export interface LearnerSummary {
  totalConcepts: number;
  averageMastery: number;
  dueConcepts: number;
  weakConceptCount: number;
  weakSkills: Array<Skill & { skillId: string; status: string }>;
  weakConcepts: Array<{
    conceptId: string;
    conceptName: string;
    mastery: number;
    status: string;
    mistakeCount: number;
  }>;
  recentMistakes: Array<{ conceptId: string; mistakes: string[]; submittedAt?: string }>;
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
  answer: string | null;
  confidence: number | null;
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
