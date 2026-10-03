export function WhyThis({ reason }: { reason: string }) {
  if (!reason.trim()) return null;
  return <details className="why-this"><summary>Why this?</summary><p>{reason}</p></details>;
}
