import {
  ApiError,
  type Concept,
  type DashboardData,
  type Goal,
  type LearnerSummary,
  type PlanTask,
  type RecallAttempt,
  type ReviewState,
  type Skill,
  type StudySession,
  type User,
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

  generatePlan(goalId: string) {
    return request<{ tasks: PlanTask[] }>(`/api/goals/${goalId}/plan/generate`, {
      method: "POST",
    });
  },

  todayPlan() {
    return request<{ plan: { id: string; goalId: string; status: string } | null; tasks: PlanTask[] }>(
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

  submitRecall(id: string, input: { answer: string; confidence: number }) {
    return request<{ recall: RecallAttempt; concept: Concept; review: ReviewState }>(
      `/api/recalls/${id}/submit`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  getConcept(id: string) {
    return request<{ concept: Concept; review: ReviewState | null }>(`/api/concepts/${id}`);
  },
};
