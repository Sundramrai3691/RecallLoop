export type ActionType = "recall" | "learn" | "practice" | "remediation" | "mastery_check" | "none";
export interface NextAction { actionType: ActionType; title: string; reason: string; estimatedMinutes: number; priority: number; }

export function recommendNextAction(input: {
  conceptName: string; mastery: number; latestCoverage: number; dimensions: Record<string,number|null>;
  consecutiveFailures: number; repeatedMissingPoint?: string|null; repeatedMissingCount?: number; goalRequired?: boolean;
}): NextAction {
  const { conceptName,mastery,latestCoverage,dimensions,consecutiveFailures,repeatedMissingPoint,repeatedMissingCount=0,goalRequired=false } = input;
  if (repeatedMissingPoint && repeatedMissingCount >= 2) return { actionType:"remediation",title:`Remediate · ${repeatedMissingPoint}`,reason:`You missed this knowledge point in ${repeatedMissingCount} previous attempts.`,estimatedMinutes:15,priority:95 };
  if (latestCoverage < .45 && consecutiveFailures >= 2) return { actionType:"remediation",title:`Rebuild the basics · ${conceptName}`,reason:`Recent recall coverage was ${Math.round(latestCoverage*100)}% across ${consecutiveFailures} low-coverage attempts.`,estimatedMinutes:15,priority:92 };
  if (latestCoverage < .55) return { actionType:"recall",title:`Recall · ${conceptName}`,reason:`Previous recall coverage was ${Math.round(latestCoverage*100)}%.`,estimatedMinutes:8,priority:82 };
  const recall=dimensions.recall ?? null;
  const application=dimensions.application;
  if (recall !== null && recall >= .65 && (application === null || application === undefined || recall-application >= .2)) return { actionType:"practice",title:`Apply · ${conceptName}`,reason:application == null ? `Recall performance is ${Math.round(recall*100)}%, and application evidence has not been recorded.` : `Application performance (${Math.round(application*100)}%) is weaker than recall (${Math.round(recall*100)}%).`,estimatedMinutes:20,priority:80 };
  const observed=Object.values(dimensions).filter((value):value is number=>value!==null);
  if (observed.length >= 3 && observed.every((value)=>value>=.8) && mastery>=.8) return { actionType:"mastery_check",title:`Mastery check · ${conceptName}`,reason:"Recent evidence is strong across the sampled dimensions; a broader check can confirm it.",estimatedMinutes:20,priority:45 };
  if (latestCoverage < .75) return { actionType:"learn",title:`Review · ${conceptName}`,reason:`Previous recall coverage was ${Math.round(latestCoverage*100)}%.`,estimatedMinutes:12,priority:65 };
  if (goalRequired) return { actionType:"practice",title:`Practice · ${conceptName}`,reason:"This concept is required by an active goal, and application evidence is not recorded yet.",estimatedMinutes:20,priority:60 };
  return { actionType:"none",title:"Done for now",reason:"Current evidence does not identify a higher-priority follow-up activity.",estimatedMinutes:0,priority:0 };
}
