import {
  ApiError,
  type Concept,
  type DashboardData,
  type RecallAttempt,
  type ReviewState,
  type StudySession,
} from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
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
    return request<{ session: StudySession; concepts: Concept[] }>(`/api/study-sessions/${id}`);
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
