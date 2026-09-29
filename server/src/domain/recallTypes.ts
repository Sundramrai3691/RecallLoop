export const QUESTION_TYPES = ["explain", "compare", "application", "coding"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type KnowledgePointStatus = "correct" | "partial" | "missing";
export interface KnowledgePointResult { point: string; status: KnowledgePointStatus; evidence: string; feedback: string; }
export interface RecallEvaluation { overallCoverage: number; knowledgePointResults: KnowledgePointResult[]; missingConcepts: string[]; mistakes: string[]; strengths: string[]; feedback: string; suggestedRecallType: QuestionType; evaluatorVersion: string; }
