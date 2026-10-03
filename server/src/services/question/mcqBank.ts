export interface BuiltinMcq {
  prompt: string;
  correct: string;
  distractors: [string,string,string];
  explanation: string;
}

const BANK: Array<{ matches: string[]; build: (concept: string, point: string,variant:number) => BuiltinMcq }> = [
  { matches: ["token bucket","burst capacity"], build: (_concept,_point,variant) => ([{
    prompt: "A client sends a short burst of requests and then becomes idle. Which token-bucket property determines the largest burst it can pass?",
    correct: "Bucket capacity sets how many tokens can accumulate and therefore bounds the burst.",
    distractors: ["Refill rate sets the burst size; capacity only controls the long-term average.","A fixed-window counter provides the same burst behavior for every request distribution.","The token count should reset after each accepted request."],
    explanation: "Capacity bounds accumulated burst tokens. Refill rate controls the sustained rate; fixed windows can allow boundary bursts.",
  },{
    prompt:"After a bucket is partly depleted, what controls how quickly it can accept later requests again?",
    correct:"The refill rate determines how quickly tokens return to the bucket.",
    distractors:["Bucket capacity determines the rate at which tokens return.","The requester's burst size refills tokens after each accepted request.","Fixed-window boundaries refill tokens continuously at the configured token rate."],
    explanation:"Refill rate replenishes tokens over time; capacity only limits the maximum stored tokens and burst size.",
  },{
    prompt:"A request arrives while a token bucket has no tokens. Which behavior is consistent with the limiter?",
    correct:"Reject or delay the request until a token is available, according to the configured policy.",
    distractors:["Always accept it because an empty bucket resets its capacity.","Increase the sustained refill rate for this request only.","Accept it and subtract a token from the next time window."],
    explanation:"Without an available token, the limiter rejects or delays according to policy; it does not create capacity or tokens.",
  },{
    prompt:"Which configuration change increases the maximum permitted short burst without changing long-term throughput?",
    correct:"Increase bucket capacity while keeping the refill rate unchanged.",
    distractors:["Increase refill rate while keeping bucket capacity unchanged.","Reduce bucket capacity and reset it at every fixed-window boundary.","Make the bucket local to each server so every instance adds burst capacity."],
    explanation:"Capacity controls maximum burst. Refill rate controls sustained throughput; per-instance buckets can multiply a distributed quota.",
  },{
    prompt:"Why can a fixed-window counter allow a larger burst near a window boundary than a token bucket?",
    correct:"Requests can cluster at the end and start of adjacent windows, each using a separate window allowance.",
    distractors:["A fixed window continuously stores unused requests as tokens across windows.","A token bucket resets its entire capacity at every clock boundary.","Fixed-window counters enforce each request's sustained rate more precisely than token refill."],
    explanation:"Fixed windows can permit boundary bursts across two adjacent allowances. A token bucket explicitly bounds accumulated burst capacity.",
  }] as BuiltinMcq[])[Math.abs(variant)%5] },
  { matches: ["distributed rate", "multiple service instances","coordination across service instances"], build: () => ({
    prompt: "Two API instances enforce one customer-wide request limit. What must they coordinate?",
    correct: "A shared or consistently partitioned counter/token state for that customer.",
    distractors: ["Independent per-process counters, because their limits add up to the customer-wide limit.","Only the configured refill rate; each instance can keep an unrelated token balance.","The load balancer's health-check interval, which acts as the shared request counter."],
    explanation: "Per-process state multiplies the effective quota. The instances need shared or consistently partitioned limiter state.",
  }) },
  { matches: ["consumer acknowledgement", "acknowledgement timing", "redelivery"], build: () => ({
    prompt: "A worker may crash while processing a message. When should it acknowledge the message for at-least-once delivery?",
    correct: "After the side effect has completed durably, so an earlier crash allows redelivery.",
    distractors: ["Before processing starts, so the broker can remove the message immediately.","At the same time the message is fetched, because fetch itself guarantees the side effect.","Only after a fixed timeout, regardless of whether processing succeeded."],
    explanation: "Acknowledging after durable processing lets the broker redeliver work after an earlier crash. Idempotency handles possible repeats.",
  }) },
  { matches: ["cache-aside", "cache aside"], build: () => ({
    prompt: "In cache-aside, what does an application normally do after a cache miss?",
    correct: "Read the source of truth, return the value, and populate the cache.",
    distractors: ["Invalidate the source record and retry the cache read.","Treat the miss as proof that the value does not exist in the source of truth.","Write a placeholder into the cache without reading the source."],
    explanation: "Cache-aside leaves cache lookup and population to the application; a miss falls back to the source of truth.",
  }) },
  { matches: ["dead letter", "repeatedly fail"], build: () => ({
    prompt: "A queue message repeatedly fails because its payload is invalid. What is the purpose of dead-letter handling?",
    correct: "Move or route the repeatedly failing message aside for inspection without blocking normal work.",
    distractors: ["Retry the message forever at the front of the queue until it succeeds.","Acknowledge the message before validation so it cannot be inspected later.","Increase the visibility timeout until the invalid payload becomes valid."],
    explanation: "Dead-letter handling isolates poison messages after bounded retries, preserving the main queue and enabling diagnosis.",
  }) },
];

export function findBuiltinMcq(conceptName: string, knowledgePoint: string,variant=0): BuiltinMcq | null {
  const haystack = `${conceptName} ${knowledgePoint}`.toLowerCase();
  return BANK.find((entry) => entry.matches.some((term) => haystack.includes(term)))?.build(conceptName,knowledgePoint,variant) ?? null;
}

export function hasBuiltinMcq(conceptName: string, knowledgePoints: string[]) {
  return knowledgePoints.some((point) => findBuiltinMcq(conceptName,point) !== null) || BANK.some((entry) => entry.matches.some((term) => conceptName.toLowerCase().includes(term)));
}
