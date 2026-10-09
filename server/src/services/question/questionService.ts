import type { AssessmentLevel, QuestionType } from "../../domain/recallTypes.js";
import type { StructuredQuestionPart } from "../../domain/recallTypes.js";
import { z } from "zod";
import { AppError } from "../../utils/errors.js";
import { deriveCoverage } from "../evaluator/validate.js";
import type { KnowledgePointResult } from "../../domain/recallTypes.js";
import { findBuiltinMcq } from "./mcqBank.js";
import type { PoolClient } from "pg";

export interface QuestionDraft {
  questionType: QuestionType;
  assessmentLevel: AssessmentLevel;
  difficulty: number;
  title: string;
  context: string;
  prompt: string;
  estimatedMinutes: number;
  source: "builtin";
  options: Array<{ id: string; text: string }> | null;
  correctOptionId: string | null;
  explanation: string;
  knowledgePoints: string[];
  parts: StructuredQuestionPart[] | null;
  hints: string[];
}

export function createStructuredParts(points: string[], conceptName: string): StructuredQuestionPart[] | null {
  const distinct = [...new Set(points.map((point) => point.trim()).filter(Boolean))];
  if (distinct.length < 2) return null;
  return distinct.map((point, index) => {
    const label = point.length <= 48 ? point : `${point.slice(0, 45).trimEnd()}…`;
    return {
      id: `part-${index + 1}`,
      label,
      prompt: `Explain this part of ${conceptName}: ${point}`,
      knowledgePoints: [point],
      rubric: [point],
    };
  });
}

export function mapStructuredAnswers(
  parts: StructuredQuestionPart[],
  submitted: unknown,
) {
  const parsed=z.array(z.object({partId:z.string().min(1).max(80),answer:z.string().max(20000)})).max(12).safeParse(submitted);
  if(!parsed.success)throw new AppError("Each answer needs a valid part ID and text.",400,"INVALID_PART_ANSWER");
  const known = new Set(parts.map((part) => part.id));
  const seen = new Set<string>();
  for (const item of parsed.data) {
    if (!known.has(item.partId)) throw new AppError("An answer refers to an unknown question part.",400,"UNKNOWN_ANSWER_PART");
    if (seen.has(item.partId)) throw new AppError("Each question part can only have one answer.",400,"DUPLICATE_ANSWER_PART");
    seen.add(item.partId);
  }
  return parts.map((part) => ({ partId: part.id, answer: parsed.data.find((item) => item.partId === part.id)?.answer.trim() ?? "" }));
}

export function validateQuestionParts(value: unknown, questionKnowledgePoints: string[]): StructuredQuestionPart[] | null {
  if (value == null) return null;
  const schema = z.array(z.object({ id:z.string().min(1).max(80),label:z.string().min(1).max(160),prompt:z.string().min(1).max(1000),knowledgePoints:z.array(z.string().min(1)).min(1),rubric:z.array(z.string().min(1)).min(1) })).min(2).max(12);
  const parsed=schema.safeParse(value);
  if (!parsed.success) throw new AppError("The stored question has invalid structured parts.",500,"INVALID_QUESTION_PARTS");
  const ids=new Set<string>();
  const usedPoints=new Set<string>();
  const available=new Set(questionKnowledgePoints.map((point)=>point.trim()));
  for(const part of parsed.data){
    if(ids.has(part.id)||new Set(part.knowledgePoints.map((point)=>point.trim())).size!==part.knowledgePoints.length||part.knowledgePoints.some((point)=>!available.has(point.trim())||usedPoints.has(point.trim()))){
      throw new AppError("The stored question references invalid parts or knowledge points.",500,"INVALID_QUESTION_PARTS");
    }
    ids.add(part.id);
    part.knowledgePoints.forEach((point)=>usedPoints.add(point.trim()));
  }
  return parsed.data;
}

export async function evaluateStructuredParts(
  parts: StructuredQuestionPart[],
  answers: Array<{partId:string;answer:string}>,
  evaluatePart: (part:StructuredQuestionPart,answer:string)=>Promise<{knowledgePointResults:KnowledgePointResult[];feedback:string}>,
) {
  const evaluations=[];
  for(const part of parts){
    const answer=answers.find((item)=>item.partId===part.id)?.answer.trim()??"";
    if(!answer){
      evaluations.push({partId:part.id,feedback:`${part.label}: unanswered.`,results:part.knowledgePoints.map((point)=>({point,status:"missing" as const,evidence:"",feedback:"No answer was provided for this part.",partId:part.id}))});
    }else{
      const evaluated=await evaluatePart(part,answer);
      evaluations.push({partId:part.id,feedback:`${part.label}: ${evaluated.feedback}`,results:evaluated.knowledgePointResults.map((result)=>({...result,partId:part.id}))});
    }
  }
  const knowledgePointResults=evaluations.flatMap((part)=>part.results);
  return {knowledgePointResults,overallCoverage:deriveCoverage(knowledgePointResults),feedback:evaluations.map((part)=>part.feedback).join(" ")};
}

const LEVEL_TYPES: Record<AssessmentLevel, QuestionType> = {
  recognition: "mcq", recall: "rapid_recall", explanation: "short_explanation",
  application: "scenario", depth: "descriptive", transfer: "transfer",
};

export function selectAssessment(input: {
  mastery: number; previousCoverage?: number | null; recentFailures?: number;
  recentSuccesses?: number; recentTypes?: QuestionType[]; availableMinutes?: number;
}): { questionType: QuestionType; assessmentLevel: AssessmentLevel; difficulty: number; repetitionReason: string | null } {
  const { mastery, previousCoverage = null, recentFailures = 0, recentSuccesses = 0, recentTypes = [], availableMinutes = 10 } = input;
  let level: AssessmentLevel = mastery < 0.35 ? "recognition" : mastery < 0.55 ? "recall" : mastery < 0.72 ? "explanation" : mastery < 0.84 ? "application" : mastery < 0.93 ? "depth" : "transfer";
  if (recentFailures >= 2 || (previousCoverage !== null && previousCoverage < 0.5)) level = mastery < 0.25 ? "recognition" : "explanation";
  else if (recentSuccesses >= 2 && level !== "transfer") level = ({ recognition: "recall", recall: "explanation", explanation: "application", application: "depth", depth: "transfer" } as const)[level] ?? level;
  if (availableMinutes < 3 && level !== "recognition") level = "recall";
  let questionType = LEVEL_TYPES[level];
  if (recentTypes.slice(0, 2).includes(questionType)) {
    const alternate: Record<AssessmentLevel, AssessmentLevel> = { recognition: "recall", recall: "explanation", explanation: "application", application: "depth", depth: "transfer", transfer: "application" };
    level = alternate[level]; questionType = LEVEL_TYPES[level];
  }
  return { questionType, assessmentLevel: level, difficulty: Math.max(1, Math.min(5, Math.round(mastery * 4) + (recentFailures ? 1 : 2))), repetitionReason: null };
}

export function buildQuestion(conceptName: string, questionType: QuestionType, knowledgePoints: string[], difficulty = 2, variant = 0, wordingVariant = 0): QuestionDraft {
  const points = knowledgePoints.length ? knowledgePoints : [`Explain the main mechanism behind ${conceptName}`, `Describe when ${conceptName} is useful`, `Identify an important tradeoff of ${conceptName}`];
  const targetPoint = points[Math.abs(variant) % points.length];
  const lowerConcept=conceptName.toLowerCase();
  const mappedPoint=lowerConcept.includes("token bucket")?points.find((point)=>/burst|token|sustained rate/i.test(point)):
    lowerConcept.includes("distributed rate")?points.find((point)=>/coordination|instance|shared state|distributed/i.test(point)):
    lowerConcept.includes("consumer acknowledgement")?points.find((point)=>/acknowledg|redeliver|at-least-once/i.test(point)):
    lowerConcept.includes("cache-aside")?points.find((point)=>/cache.aside|cache miss|populate/i.test(point)):
    lowerConcept.includes("dead letter")?points.find((point)=>/dead letter|fail|retry/i.test(point)):undefined;
  const evaluatedPoint=mappedPoint ?? targetPoint;
  const byType: Partial<Record<QuestionType, { level: AssessmentLevel; prompt: string; title: string; minutes: number; context?: string }>> = {
    mcq: { level: "recognition", title: "Quick Check", minutes: 1, prompt: `Which statement best captures this key idea about ${conceptName}: ${targetPoint}?` },
    rapid_recall: { level: "recall", title: "Rapid Fire", minutes: 1, prompt: `In one or two sentences, explain this point about ${conceptName}: ${targetPoint}` },
    short_explanation: { level: "explanation", title: "Explain", minutes: 3, prompt: `Explain ${conceptName} from memory, including its central mechanism and when it is useful.` },
    explain: { level: "explanation", title: "Explain", minutes: 4, prompt: `Without looking at your notes, explain how ${conceptName} works from start to finish.` },
    descriptive: { level: "depth", title: "Deep Recall", minutes: 5, context: `Describe the key mechanism, the decisions involved, and the tradeoffs that matter when using ${conceptName}.`, prompt: `How would you reason through ${conceptName}? Explain the approach, important tradeoffs, and likely failure cases.` },
    comparison: { level: "explanation", title: "Compare", minutes: 4, prompt: `Compare ${conceptName} with a closely related approach. When would you choose each?` },
    compare: { level: "explanation", title: "Compare", minutes: 4, prompt: `Without notes, compare ${conceptName} to a closely related approach. When would you choose it?` },
    scenario: { level: "application", title: "Apply", minutes: 4, context: `A system needs to use ${conceptName} under realistic operating constraints.`, prompt: `How would you apply ${conceptName} to this situation? Explain your choice and one tradeoff.` },
    application: { level: "application", title: "Apply", minutes: 4, prompt: `Describe a concrete situation where you would apply ${conceptName}, and walk through the steps.` },
    coding: { level: "application", title: "Practice", minutes: 5, prompt: `Describe how you would implement ${conceptName}: data flow, failure cases, and key operations.` },
    transfer: { level: "transfer", title: "Transfer Challenge", minutes: 6, context: `Consider an unfamiliar product or system with different constraints from the examples you have seen.`, prompt: `How would you adapt the principles of ${conceptName} to a new context? State your assumptions and explain what would change.` },
  };
  const spec = byType[questionType] ?? byType.explain!;
  const curated = questionType === "mcq" ? findBuiltinMcq(conceptName,evaluatedPoint,variant) : null;
  const options = questionType === "mcq" ? [
    { id: "correct", text: curated?.correct ?? evaluatedPoint },
    { id: "a", text: curated?.distractors[0] ?? `This behavior is guaranteed even when the stated preconditions are absent.` },
    { id: "b", text: curated?.distractors[1] ?? `The mechanism has the opposite effect: ${evaluatedPoint}` },
    { id: "c", text: curated?.distractors[2] ?? `${conceptName} requires no tradeoffs or operational constraints.` },
  ] : null;
  const alternatePrompts: Partial<Record<QuestionType,string[]>> = {
    mcq: [spec.prompt,`Which option correctly describes the behavior for ${targetPoint}?`,`Choose the accurate statement about ${conceptName}: ${targetPoint}`],
    rapid_recall: [spec.prompt,`Give a brief recall of this ${conceptName} knowledge point: ${targetPoint}`,`State the key behavior from memory: ${targetPoint}`],
    short_explanation: [spec.prompt,`Explain ${conceptName} from memory. Include this required point: ${targetPoint}`,`Describe the mechanism of ${conceptName} and how it relates to ${targetPoint}.`],
    descriptive: [spec.prompt,`Reason through ${conceptName}: explain its mechanism, tradeoffs, and failure cases.`,`Give a deeper account of ${conceptName}, including decisions, tradeoffs, and failure cases.`],
    scenario: [spec.prompt,`A service must use ${conceptName} under real operating constraints. What would you do and why?`,`Apply ${conceptName} to a constrained system; explain your choice and tradeoff.`],
    transfer: [spec.prompt,`Transfer the principles of ${conceptName} to an unfamiliar system. State assumptions and explain the changes.`,`How would you adapt ${conceptName} to a different setting with new constraints?`],
  };
  const selectedPrompt = alternatePrompts[questionType]?.[Math.abs(wordingVariant) % (alternatePrompts[questionType]?.length ?? 1)] ?? spec.prompt;
  const mcqPrompt=curated?.prompt ?? null;
  const questionKnowledgePoints = options ? [evaluatedPoint] : points;
  const parts = questionType === "short_explanation" ? createStructuredParts(questionKnowledgePoints, conceptName) : null;
  return { questionType, assessmentLevel: spec.level, difficulty, title: spec.title, context: spec.context ?? "", prompt: parts ? "Answer each part separately." : mcqPrompt ?? selectedPrompt, estimatedMinutes: spec.minutes, source: "builtin", options, correctOptionId: options ? "correct" : null, explanation: options ? curated?.explanation ?? `The selected statement is the required knowledge point: ${evaluatedPoint}` : "", knowledgePoints: questionKnowledgePoints, parts, hints: ["Recall the key mechanism involved.", `Connect your answer to: ${evaluatedPoint}`, "Check the main tradeoff or a concrete use case." ] };
}

export function buildTargetedVerificationQuestion(conceptName:string,knowledgePoint:string,variant=0):QuestionDraft {
  const base=buildQuestion(conceptName,"short_explanation",[knowledgePoint],3,0,variant);
  const prompts=[
    `Without looking at the remediation, explain this point about ${conceptName}: ${knowledgePoint}`,
    `In your own words, state ${knowledgePoint} and explain why it matters for ${conceptName}.`,
    `Teach a new learner the idea captured by this point: ${knowledgePoint}.`,
    `Recall ${knowledgePoint} from memory and connect it to ${conceptName}.`,
    `What does ${knowledgePoint} mean in ${conceptName}? Answer from memory.`,
    `Describe ${knowledgePoint} clearly enough that someone could distinguish it from a related idea.`,
  ];
  return {...base,title:"Targeted Check",context:"Answer from memory without reopening the remediation.",prompt:prompts[variant%prompts.length],knowledgePoints:[knowledgePoint],parts:null,estimatedMinutes:3};
}

export function evidenceWeight(hintsUsed: number): number {
  return [1, 0.85, 0.7, 0.55][Math.max(0, Math.min(3, hintsUsed))];
}

export function nextHint(hints: string[], currentLevel: number): { level: number; hint: string } | null {
  if (currentLevel < 0 || currentLevel >= Math.min(hints.length, 3)) return null;
  return { level: currentLevel + 1, hint: hints[currentLevel] };
}

export function assessmentBlueprint(mode: "rapid_fire" | "deep_recall" | "mastery_check" | "practice"): QuestionType[] {
  if (mode === "rapid_fire") return ["mcq","rapid_recall","rapid_recall","rapid_recall","mcq"];
  if (mode === "deep_recall") return ["descriptive"];
  if (mode === "practice") return ["scenario"];
  return ["mcq","rapid_recall","short_explanation","scenario","descriptive","transfer"];
}

export function evaluateMcq(input: { selectedOptionId: string; correctOptionId: string; knowledgePoints: string[] }) {
  const correct = input.selectedOptionId === input.correctOptionId;
  return { correct, overallCoverage: correct ? 1 : 0, knowledgePointResults: input.knowledgePoints.map((point) => ({ point, status: correct ? "correct" as const : "missing" as const, evidence: correct ? input.selectedOptionId : "", feedback: correct ? "Correct selection." : "Review this knowledge point." })), missingConcepts: correct ? [] : input.knowledgePoints, mistakes: correct ? [] : ["Selected an incorrect option"], strengths: correct ? input.knowledgePoints : [] };
}

export async function upsertQuestion(client: PoolClient, conceptId: string, draft: QuestionDraft) {
  const result = await client.query<{ id: string }>(`INSERT INTO questions (concept_id,question_type,assessment_level,difficulty,title,context,prompt,estimated_minutes,source,options,correct_option_id,explanation,knowledge_points,hints,question_parts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (concept_id,question_type,prompt) DO UPDATE SET assessment_level=EXCLUDED.assessment_level,difficulty=EXCLUDED.difficulty,title=EXCLUDED.title,context=EXCLUDED.context,estimated_minutes=EXCLUDED.estimated_minutes,source=EXCLUDED.source,options=EXCLUDED.options,correct_option_id=EXCLUDED.correct_option_id,explanation=EXCLUDED.explanation,knowledge_points=EXCLUDED.knowledge_points,hints=EXCLUDED.hints,question_parts=EXCLUDED.question_parts,updated_at=now() RETURNING id`,[conceptId,draft.questionType,draft.assessmentLevel,draft.difficulty,draft.title,draft.context,draft.prompt,draft.estimatedMinutes,draft.source,draft.options ? JSON.stringify(draft.options) : null,draft.correctOptionId,draft.explanation,draft.knowledgePoints,draft.hints,draft.parts ? JSON.stringify(draft.parts) : null]);
  return result.rows[0].id;
}
