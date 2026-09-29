import { Types } from "mongoose";
import { Concept } from "../../models/Concept.js";
import { AppError } from "../../utils/errors.js";
import { getEvaluator } from "../evaluator/index.js";
import { extractedConceptSchema } from "../evaluator/schemas.js";

export async function createConceptsForSession(input: {
  studySessionId: string;
  title: string;
  rawMaterial?: string;
  userId?: string;
}) {
  const evaluator = getEvaluator();
  const extracted = await evaluator.extractConcepts({
    title: input.title,
    rawMaterial: input.rawMaterial,
  });

  const validated = extracted.map((concept, index) => {
    const parsed = extractedConceptSchema.safeParse(concept);
    if (!parsed.success) {
      throw new AppError(
        `Extracted concept ${index + 1} failed validation and was not stored`,
        502,
        "INVALID_AI_JSON",
      );
    }
    return parsed.data;
  });

  if (validated.length === 0) {
    throw new AppError("No valid concepts were extracted", 502, "INVALID_AI_JSON");
  }

  const docs = await Concept.insertMany(
    validated.map((c) => ({
      userId: input.userId ?? "local-user",
      studySessionId: new Types.ObjectId(input.studySessionId),
      name: c.name.trim(),
      description: c.description.trim(),
      requiredKnowledgePoints: c.requiredKnowledgePoints.map((p) => p.trim()).filter(Boolean),
      difficulty: c.difficulty ?? 3,
      mastery: 0,
    })),
  );

  return docs;
}

export async function listConceptsForSession(studySessionId: string, userId?: string) {
  return Concept.find({ studySessionId, ...(userId ? { userId } : {}) }).sort({ createdAt: 1 });
}

export async function getConceptById(id: string) {
  return Concept.findById(id);
}

export async function listConcepts() {
  return Concept.find().sort({ updatedAt: -1 }).limit(200);
}

export async function updateConceptMastery(conceptId: string, coverage: number) {
  const existing = await Concept.findById(conceptId);
  if (!existing) return null;
  const previous = existing.mastery ?? 0;
  const mastery = Number((previous * 0.4 + coverage * 0.6).toFixed(4));
  existing.mastery = mastery;
  await existing.save();
  return existing;
}
