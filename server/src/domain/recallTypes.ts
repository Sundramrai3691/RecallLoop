export const QUESTION_TYPES = ["mcq", "rapid_recall", "short_explanation", "descriptive", "comparison", "scenario", "application", "transfer", "explain", "compare", "coding"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const ASSESSMENT_LEVELS = ["recognition", "recall", "explanation", "application", "depth", "transfer"] as const;
export type AssessmentLevel = (typeof ASSESSMENT_LEVELS)[number];
export type KnowledgePointStatus = "correct" | "partial" | "missing";
export interface KnowledgePointResult { point: string; status: KnowledgePointStatus; evidence: string; feedback: string; partId?: string; }
export interface StructuredQuestionPart { id: string; label: string; prompt: string; knowledgePoints: string[]; rubric: string[]; }
export interface RecallEvaluation { overallCoverage: number; knowledgePointResults: KnowledgePointResult[]; missingConcepts: string[]; mistakes: string[]; strengths: string[]; feedback: string; suggestedRecallType: QuestionType; evaluatorVersion: string; }
