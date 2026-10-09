import {
  ApiError,
  type Concept,
  type DashboardData,
  type Goal,
  type GroundedRemediation,
  type LearnerSummary,
  type BaselineQuestion,
  type KnowledgeRole,
  type PlanTask,
  type RecallAttempt,
  type ReviewState,
  type Skill,
  type StudySession,
  type User,
  type ResourceRecommendation,
} from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("recallloop_token");
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const payload = body as { error?: string; code?: string } | null;
    throw new ApiError(
      payload?.error ?? "Request failed",
      res.status,
      payload?.code ?? "REQUEST_FAILED",
    );
  }

  return body as T;
}

export const api = {
  register(input: { name: string; email: string; password: string }) {
    return request<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: { email: string; password: string }) {
    return request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me() {
    return request<{ user: User }>("/api/auth/me");
  },

  listGoals() {
    return request<{ goals: Goal[] }>("/api/goals");
  },

  getGoal(id: string) {
    return request<{ goal: Goal }>(`/api/goals/${id}`);
  },

  createGoal(input: { title: string; description: string; goalType: string; targetDate?: string; weeklyTimeBudgetMinutes: number }) {
    return request<{ goal: Goal }>("/api/goals", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listSkills(goalId: string) {
    return request<{ skills: Skill[] }>(`/api/goals/${goalId}/skills`);
  },

  createSkill(goalId: string, input: { name: string; description: string; priority: number }) {
    return request<{ skill: Skill }>(`/api/goals/${goalId}/skills`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  generatePlan(goalId: string, availableMinutes?: number) {
    return request<{ tasks: PlanTask[] }>(`/api/goals/${goalId}/plan/generate`, {
      method: "POST",
      body: JSON.stringify({ availableMinutes }),
    });
  },

  todayPlan() {
    return request<{ plan: { id: string; goalId: string; status: string } | null; tasks: PlanTask[]; timeBudget: { availableMinutes: number; plannedMinutes: number; remainingMinutes: number } | null; backlog?: { carriedForwardCount: number; deferredCount: number } }>(
      "/api/plan/today",
    );
  },

  updatePlanTask(id: string, status: "planned" | "in_progress" | "completed" | "missed") {
    return request<{ task: { id: string; status: string } }>(`/api/plan/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  learnerSummary() {
    return request<LearnerSummary>("/api/learner/summary");
  },

  knowledgeRoles() {
    return request<{ roles: KnowledgeRole[] }>("/api/knowledge/roles");
  },

  createBaseline(input: { goalId: string; skillId: string; level: string; trustMe?: boolean }) {
    return request<{ baseline: { assessment: { id: string }; questions: BaselineQuestion[] } }>("/api/baseline", { method: "POST", body: JSON.stringify(input) });
  },

  getBaseline(id: string) {
    return request<{ baseline: { assessment: any; questions: BaselineQuestion[] } }>(`/api/baseline/${id}`);
  },

  submitBaselineQuestion(id: string, input: { questionId: string; answer: string; confidence: number }) {
    return request<{ baseline: { assessment: any; questions: BaselineQuestion[] } }>(`/api/baseline/${id}/submit`, { method: "POST", body: JSON.stringify(input) });
  },

  getStartingPoint(goalId: string) {
    return request<{ startingConcept: { id: string; name: string } | null; conceptsToSkip: any[]; conceptsToReview: any[]; resources: ResourceRecommendation[] }>(`/api/goals/${goalId}/starting-point`);
  },

  recommendedResources(conceptId?: string,availableMinutes=60,goalId?:string) {
    const params=new URLSearchParams({availableMinutes:String(availableMinutes),limit:"4"});if(conceptId)params.set("conceptId",conceptId);if(goalId)params.set("goalId",goalId);
    return request<{ resources: ResourceRecommendation[] }>(`/api/resources/recommendations?${params.toString()}`);
  },

  health() {
    return request<{ ok: boolean; mockLlm: boolean }>("/api/health");
  },

  dashboard() {
    return request<DashboardData>("/api/dashboard");
  },

  createStudySession(input: { title: string; rawMaterial?: string; sourceType?: string }) {
    return request<{ session: StudySession; concepts: Concept[] }>("/api/study-sessions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getStudySession(id: string) {
    return request<{
      session: StudySession;
      concepts: Concept[];
      pendingRecalls: RecallAttempt[];
    }>(`/api/study-sessions/${id}`);
  },

  completeStudySession(id: string) {
    return request<{ session: StudySession; concepts: Concept[]; recalls: RecallAttempt[] }>(
      `/api/study-sessions/${id}/complete`,
      { method: "POST" },
    );
  },

  getRecall(id: string) {
    return request<{
      recall: RecallAttempt;
      concept: { id: string; name: string; studySessionId: string; mastery: number; difficulty: number };
    }>(`/api/recalls/${id}`);
  },

  submitRecall(id: string, input: { answer?: string; answers?: Array<{partId:string;answer:string}>; selectedOptionId?: string; confidence: number }) {
    return request<{ recall: RecallAttempt; concept: Concept; review: ReviewState }>(
      `/api/recalls/${id}/submit`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  learningPack(conceptId:string,availableMinutes:number,goalId?:string){const params=new URLSearchParams({conceptId,availableMinutes:String(availableMinutes)});if(goalId)params.set("goalId",goalId);return request<{pack:{conceptId:string;conceptName:string;availableMinutes:number;estimatedTotalMinutes:number;remainingMinutes:number;items:Array<{kind:string;title:string;minutes:number;reason:string;url?:string}>}}>(`/api/resources/learning-pack?${params.toString()}`);},

  ingestGroundingSource(input:{title:string;text:string;sourceType:"text"|"markdown";reference?:string;provenance?:Record<string,unknown>}){return request<{source:{id:string;title:string;sourceType:string;reference:string;contentHash:string;processingStatus:string;processingError:string|null;chunkCount:number;duplicate:boolean}}>('/api/grounding/sources',{method:'POST',body:JSON.stringify(input)});},
  listGroundingSources(){return request<{sources:Array<{id:string;title:string;sourceType:string;reference:string;provenance:Record<string,unknown>;contentHash:string;processingStatus:string;processingError:string|null;createdAt:string;updatedAt:string;chunkCount:number}>}>('/api/grounding/sources');},
  createRemediation(attemptId:string){return request<{remediation:GroundedRemediation}>(`/api/remediations/from-attempt/${attemptId}`,{method:'POST'});},
  getRemediation(id:string){return request<{remediation:GroundedRemediation}>(`/api/remediations/${id}`);},
  verifyRemediation(id:string){return request<{remediationId:string;attempt:RecallAttempt}>(`/api/remediations/${id}/verify`,{method:'POST'});},

  getSettings() { return request<{ reviewMode: "automatic" | "confirm" | "manual" }>("/api/settings"); },
  updateSettings(reviewMode: "automatic" | "confirm" | "manual") { return request<{ reviewMode: "automatic" | "confirm" | "manual" }>("/api/settings",{ method:"PATCH",body:JSON.stringify({ reviewMode }) }); },
  confirmReviewDate(conceptId: string,dueAt: string) { return request<{ review: ReviewState }>(`/api/concepts/${conceptId}/review`,{method:"PATCH",body:JSON.stringify({dueAt})}); },

  revealRecallHint(id: string) {
    return request<{ hint: string; maxHintLevel: number }>(`/api/recalls/${id}/hints`, { method: "POST" });
  },

  createAssessment(conceptId: string, mode: "rapid_fire" | "deep_recall" | "mastery_check" | "practice") {
    return request<{ assessment: { id: string; mode: string; status: string; current: number; total: number }; questions: RecallAttempt[] }>("/api/assessments", { method: "POST", body: JSON.stringify({ conceptId, mode }) });
  },

  getAssessment(id: string) {
    return request<{ assessment: { id: string; conceptId: string; mode: string; status: string; current: number; total: number }; questions: RecallAttempt[]; result: null | { correct: number; total: number; dimensionScores: Record<string, number | null>; weakArea: string | null; recommendation: NonNullable<RecallAttempt["recommendation"]> | null } }>(`/api/assessments/${id}`);
  },

  getConcept(id: string) {
    return request<{ concept: Concept; review: ReviewState | null; dimensionScores: Record<string, number | null>; learnerState: null | { mastery:number|null; attemptCount:number; successRate:number|null; confidence:number|null; hintsUsed:number|null; mistakeCount:number; lastAttemptAt:string|null; nextReviewAt:string|null; dimensionScores:Record<string,number|null> } }>(`/api/concepts/${id}`);
  },
};
