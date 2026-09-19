import { z } from "zod";
import { QUESTION_TYPES } from "../../models/RecallAttempt.js";

export const knowledgePointResultSchema = z.object({
  point: z.string().min(1),
  status: z.enum(["correct", "partial", "missing"]),
  evidence: z.string().default(""),
  feedback: z.string().default(""),
});

export const recallEvaluationSchema = z.object({
  overallCoverage: z.number().min(0).max(1),
  knowledgePointResults: z.array(knowledgePointResultSchema).min(1),
  missingConcepts: z.array(z.string()).default([]),
  mistakes: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  feedback: z.string().min(1),
  suggestedRecallType: z.enum(QUESTION_TYPES).default("explain"),
});

export const extractedConceptSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  requiredKnowledgePoints: z.array(z.string().min(1)).min(1),
  difficulty: z.number().min(1).max(5).optional(),
  parentName: z.string().optional(),
});

export const conceptExtractionSchema = z.object({
  concepts: z.array(extractedConceptSchema).min(1),
});

export type ParsedEvaluation = z.infer<typeof recallEvaluationSchema>;
export type ParsedConceptExtraction = z.infer<typeof conceptExtractionSchema>;
