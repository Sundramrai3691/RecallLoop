import { Types } from "mongoose";
import { Concept } from "../../models/Concept.js";
import { getEvaluator } from "../evaluator/index.js";

export async function createConceptsForSession(input: {
  studySessionId: string;
  title: string;
  rawMaterial?: string;
}) {
  const evaluator = getEvaluator();
  const extracted = await evaluator.extractConcepts({
    title: input.title,
    rawMaterial: input.rawMaterial,
  });

  const docs = await Concept.insertMany(
    extracted.map((c) => ({
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

export async function listConceptsForSession(studySessionId: string) {
  return Concept.find({ studySessionId }).sort({ createdAt: 1 });
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
