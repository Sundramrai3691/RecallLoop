import type { Concept } from "../types";

export function isUrlLikeTitle(value: string | null | undefined): boolean {
  return /(?:^|\s)(?:https?:\/\/|www\.)\S+/i.test(value?.trim() ?? "");
}

export function readableTitle(value: string | null | undefined, fallback: string): string {
  return !value || isUrlLikeTitle(value) ? fallback : value;
}

export function studySessionDisplayTitle(title: string, concepts: Concept[]): string {
  if (!isUrlLikeTitle(title)) return title;
  const mapped = concepts.find((concept) => concept.canonicalConceptId && !isUrlLikeTitle(concept.name));
  return mapped?.name ?? "Review recent study session";
}
