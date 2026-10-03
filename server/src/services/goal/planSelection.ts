export interface PlanCandidate {
  taskType: string; priority: number; estimatedMinutes: number; sequenceOrder: number;
  recallAttemptId?: string | null; conceptId?: string | null; [key: string]: unknown;
}

export function fitTasksToBudget(candidates: PlanCandidate[], budget: number, goalId: string) {
  const ordered = [...candidates].sort((a,b) => a.sequenceOrder - b.sequenceOrder || b.priority - a.priority);
  const selected: Array<PlanCandidate & { goalId: string; sequenceOrder: number }> = [];
  const seen = new Set<string>(); let minutes = 0;
  for (const item of ordered) {
    const key = item.taskType === "recall" ? String(item.recallAttemptId ?? item.conceptId ?? "") : "";
    if (key && seen.has(key)) continue;
    if (minutes + item.estimatedMinutes > budget) continue;
    selected.push({ ...item, goalId, sequenceOrder: selected.length + 1 });
    minutes += item.estimatedMinutes;
    if (key) seen.add(key);
  }
  return { tasks: selected, plannedMinutes: minutes, remainingMinutes: Math.max(0,budget-minutes) };
}
