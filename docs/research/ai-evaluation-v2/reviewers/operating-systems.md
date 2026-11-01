# Blind evaluator benchmark review — Operating Systems

Review each case without consulting the provisional label or author rationale. Return completed annotations through the documented import utility. Do not edit case content or add reviewer names/emails to a shared report; use an anonymized reviewer code.

## eval-v1-os-01

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can explain how preemption and scheduling policy affect latency, fairness, and throughput.
- Point IDs: 84e9d627-468b-4759-8004-5eab1145e1b5
- Source revision: 84d3b307-7a04-41eb-984a-69a7bec6b5c3 (revision 1)
- Content hash: `199a345e18a169e4885ac4a8ce67fd615d8eedee3bd31ea07be17d6906cd8f4a`
- Item slug/type: sde-os-scheduling-tradeoffs-verification / short_explanation
- Provenance: {"title":"xv6: a simple, Unix-like teaching operating system","url":"https://pdos.csail.mit.edu/6.828/2017/xv6/book-rev9.pdf","publisher":"MIT PDOS","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Explain preemption and scheduling policy in a new case**

Use the stated system behavior; call out assumptions that affect the conclusion.

A new implementation changes one constraint: An interactive service shares CPUs with long-running batch work and users report delayed responses. Explain which part of the original rule still applies and what must be checked before relying on it.

### Reference-answer contract

Preemption lets the scheduler regain the CPU from a running task; policy and time allocation trade off responsiveness, fairness, context-switch overhead, and throughput rather than maximizing all of them simultaneously. A complete answer explicitly connects this principle to the changed constraint and identifies any assumption that would alter the result.

### Rubric

```json
[
  {
    "id": "core-reasoning",
    "label": "Core technical reasoning",
    "weight": 1,
    "fullCredit": "States the governing principle and applies it correctly to the stated conditions.",
    "insufficient": "Relies on a misconception or gives an answer unsupported by the stated conditions.",
    "partialCredit": "Identifies part of the principle but misses an important condition or consequence."
  }
]
```

### Synthetic learner response

> Preemption lets the scheduler regain the CPU from a running task; policy and time allocation trade off responsiveness, fairness, context-switch overhead, and throughput rather than maximizing all of them simultaneously. A complete answer explicitly connects this principle to the changed constraint and identifies any assumption that would alter the result.

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

---

## eval-v1-os-02

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can explain how preemption and scheduling policy affect latency, fairness, and throughput.
- Point IDs: 84e9d627-468b-4759-8004-5eab1145e1b5
- Source revision: 132194e7-327f-456d-b907-b561458a835f (revision 1)
- Content hash: `91273aa94da74177cd3476ebb055a81a8ef17541087da43d1ad6f99a60177b68`
- Item slug/type: sde-os-scheduling-tradeoffs-recall-3 / rapid_recall
- Provenance: {"title":"xv6: a simple, Unix-like teaching operating system","url":"https://pdos.csail.mit.edu/6.828/2017/xv6/book-rev9.pdf","publisher":"MIT PDOS","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall preemption and scheduling policy**

An interactive service shares CPUs with long-running batch work and users report delayed responses.

Apply preemption and scheduling policy to this case: An interactive service shares CPUs with long-running batch work and users report delayed responses. What should the engineer expect, and why?

### Reference-answer contract

Preemption lets the scheduler regain the CPU from a running task; policy and time allocation trade off responsiveness, fairness, context-switch overhead, and throughput rather than maximizing all of them simultaneously. In the stated case, this means the design or diagnosis must account for the described constraint.

### Rubric

```json
[
  {
    "id": "core-reasoning",
    "label": "Core technical reasoning",
    "weight": 1,
    "fullCredit": "States the governing principle and applies it correctly to the stated conditions.",
    "insufficient": "Relies on a misconception or gives an answer unsupported by the stated conditions.",
    "partialCredit": "Identifies part of the principle but misses an important condition or consequence."
  }
]
```

### Synthetic learner response

> Preemption lets the scheduler regain the CPU from a running task; policy and time allocation trade off responsiveness, fairness, context-switch overhead, and throughput.

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

---

## eval-v1-os-03

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can explain how preemption and scheduling policy affect latency, fairness, and throughput.
- Point IDs: 84e9d627-468b-4759-8004-5eab1145e1b5
- Source revision: b717ac3d-bbb1-4779-9ef2-580584e75060 (revision 1)
- Content hash: `9fe2c69594a405230d69b6d0232d1a52ba39094cb3df3d1cbaee8a4b583dd65f`
- Item slug/type: sde-os-scheduling-tradeoffs-recall-1 / rapid_recall
- Provenance: {"title":"xv6: a simple, Unix-like teaching operating system","url":"https://pdos.csail.mit.edu/6.828/2017/xv6/book-rev9.pdf","publisher":"MIT PDOS","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall preemption and scheduling policy**

State the central rule for preemption and scheduling policy and one condition that affects whether it holds.

### Reference-answer contract

Preemption lets the scheduler regain the CPU from a running task; policy and time allocation trade off responsiveness, fairness, context-switch overhead, and throughput rather than maximizing all of them simultaneously.

### Rubric

```json
[
  {
    "id": "core-reasoning",
    "label": "Core technical reasoning",
    "weight": 1,
    "fullCredit": "States the governing principle and applies it correctly to the stated conditions.",
    "insufficient": "Relies on a misconception or gives an answer unsupported by the stated conditions.",
    "partialCredit": "Identifies part of the principle but misses an important condition or consequence."
  }
]
```

### Synthetic learner response

> A preemptive scheduler guarantees every task finishes quickly.

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

---

## eval-v1-os-04

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can explain how preemption and scheduling policy affect latency, fairness, and throughput.
- Point IDs: 84e9d627-468b-4759-8004-5eab1145e1b5
- Source revision: f8ce4f47-1cb0-421d-958b-abbc7989c747 (revision 1)
- Content hash: `f4edae245a4832086c9c7e921ec32f30e44375a0892c7a76fc25d2cce7b5ce60`
- Item slug/type: sde-os-scheduling-tradeoffs-recall-2 / rapid_recall
- Provenance: {"title":"xv6: a simple, Unix-like teaching operating system","url":"https://pdos.csail.mit.edu/6.828/2017/xv6/book-rev9.pdf","publisher":"MIT PDOS","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall preemption and scheduling policy**

An engineer claims: “More frequent context switching always increases useful throughput.” Correct the claim using preemption and scheduling policy.

### Reference-answer contract

That claim is incorrect. Preemption lets the scheduler regain the CPU from a running task; policy and time allocation trade off responsiveness, fairness, context-switch overhead, and throughput rather than maximizing all of them simultaneously.

### Rubric

```json
[
  {
    "id": "core-reasoning",
    "label": "Core technical reasoning",
    "weight": 1,
    "fullCredit": "States the governing principle and applies it correctly to the stated conditions.",
    "insufficient": "Relies on a misconception or gives an answer unsupported by the stated conditions.",
    "partialCredit": "Identifies part of the principle but misses an important condition or consequence."
  }
]
```

### Synthetic learner response

> A preemptive scheduler guarantees every task finishes quickly.

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

---

## eval-v1-os-05

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can distinguish process isolation from threads sharing an address space and resources.
- Point IDs: fdbd9a40-0f2d-49b4-84fc-965a11a7ca30
- Source revision: 4525ca22-43b3-4376-b15f-9787bc0143ac (revision 2)
- Content hash: `e4034f9ef68d061b9caa9360d553b7625511d8fa1b4c609504fcfaf76d287331`
- Item slug/type: sde-os-process-thread-isolation-recall-2 / rapid_recall
- Provenance: {"title":"Operating Systems: Three Easy Pieces, Chapters 4 and 26","url":"https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf","publisher":"Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau","accessedOn":"2026-10-28T18:30:00.000Z"}

### Question

**Recall process isolation versus threads**

An engineer claims: “Separate processes always share mutable heap objects directly.” Correct the claim using process isolation versus threads.

### Reference-answer contract

That claim is incorrect. In the stated OS model, separate processes normally have separate virtual address spaces, while threads in one process share that address space and can access common data; each thread retains private execution state such as registers and a stack.

### Rubric

```json
[
  {
    "id": "core-reasoning",
    "label": "Core technical reasoning",
    "weight": 1,
    "fullCredit": "States the governing principle and applies it correctly to the stated conditions.",
    "insufficient": "Relies on a misconception or gives an answer unsupported by the stated conditions.",
    "partialCredit": "Identifies part of the principle but misses an important condition or consequence."
  }
]
```

### Synthetic learner response

> It depends on the workload and the trade-offs. The implementation should be efficient and reliable.

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

---

## eval-v1-os-06

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can distinguish process isolation from threads sharing an address space and resources.
- Point IDs: fdbd9a40-0f2d-49b4-84fc-965a11a7ca30
- Source revision: 8aede88f-c65d-4a47-955c-caea20f42c68 (revision 2)
- Content hash: `19f333d6ca404b10a34c78f99334dd4c680b546354d250f52e70e77000919a3b`
- Item slug/type: sde-os-process-thread-isolation-verification / short_explanation
- Provenance: {"title":"Operating Systems: Three Easy Pieces, Chapters 4 and 26","url":"https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf","publisher":"Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau","accessedOn":"2026-10-28T18:30:00.000Z"}

### Question

**Explain process isolation versus threads in a new case**

Use the stated system behavior; call out assumptions that affect the conclusion.

A service keeps a large read-only model in memory and runs CPU-heavy jobs. Explain when a thread pool can share the model directly, what isolation a process pool provides, and what must be designed if separate processes also need shared data.

### Reference-answer contract

Threads in one process share an address space and can use the model directly, but a faulty thread can corrupt process memory. Separate processes normally isolate address spaces; sharing the model then needs an explicit mechanism such as read-only shared memory or loading a copy, with corresponding setup and memory costs.

### Rubric

```json
[
  {
    "id": "process-thread-transfer",
    "label": "Compare sharing and isolation",
    "weight": 1,
    "fullCredit": "States that threads share one process address space while processes normally have separate address spaces, explains the sharing/isolation consequence, and identifies an explicit sharing mechanism when separate processes must share the model.",
    "insufficient": "Claims threads are isolated by default or separate processes share an address space automatically.",
    "partialCredit": "Correctly distinguishes shared thread memory from process isolation but omits a practical consequence or explicit sharing mechanism."
  }
]
```

### Synthetic learner response

> Threads in one process share an address space and can use the model directly, but a faulty thread can corrupt process memory. Separate processes normally isolate address spaces; sharing the model then needs an explicit mechanism such as read-only shared memory or loading a copy, with corresponding setup and memory costs. However, the opposite is always true in every case.

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

---

## eval-v1-os-07

- Domain: Operating Systems
- Canonical concept: Processes, threads, and scheduling (d958799a-b864-43a1-bec7-aac5f638c8b7)
- Knowledge point: Can distinguish process isolation from threads sharing an address space and resources.
- Point IDs: fdbd9a40-0f2d-49b4-84fc-965a11a7ca30
- Source revision: 6a7ad48a-5676-40e3-9aa1-838046b82d66 (revision 2)
- Content hash: `d545a38fd32bc6d0b16b94478c932757ea746214f792f77efa61d474a84aa213`
- Item slug/type: sde-os-process-thread-isolation-recall-3 / rapid_recall
- Provenance: {"title":"Operating Systems: Three Easy Pieces, Chapters 4 and 26","url":"https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf","publisher":"Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau","accessedOn":"2026-10-28T18:30:00.000Z"}

### Question

**Recall process isolation versus threads**

Two worker threads in one process update a shared in-memory cache. Compare that arrangement with separate worker processes when memory isolation is required.

Apply process isolation versus threads to this case: Two worker threads in one process update a shared in-memory cache. Compare that arrangement with separate worker processes when memory isolation is required. What should the engineer expect, and why?

### Reference-answer contract

In the stated OS model, separate processes normally have separate virtual address spaces, while threads in one process share that address space and can access common data; each thread retains private execution state such as registers and a stack. In the stated case, this means the design or diagnosis must account for the described constraint.

### Rubric

```json
[
  {
    "id": "core-reasoning",
    "label": "Core technical reasoning",
    "weight": 1,
    "fullCredit": "States the governing principle and applies it correctly to the stated conditions.",
    "insufficient": "Relies on a misconception or gives an answer unsupported by the stated conditions.",
    "partialCredit": "Identifies part of the principle but misses an important condition or consequence."
  }
]
```

### Synthetic learner response

> 

### Independent annotation

- Reviewer code:
- Domain expertise:
- Question validity (valid / ambiguous / incorrect):
- Canonical mapping validity (valid / invalid):
- Reference answer validity (valid / incomplete / incorrect):
- Rubric completeness (complete / incomplete / incorrect):
- Classification (correct / partial / incorrect / unscorable):
- Technical explanation:
- Essential missing concepts:
- Confidence (high / medium / low):
- Review timestamp (ISO 8601):
- Suggested correction (optional):

