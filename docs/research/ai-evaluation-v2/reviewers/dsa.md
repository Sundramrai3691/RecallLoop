# Blind evaluator benchmark review — Data Structures and Algorithms

Review each case without consulting the provisional label or author rationale. Return completed annotations through the documented import utility. Do not edit case content or add reviewer names/emails to a shared report; use an anonymized reviewer code.

## eval-v1-dsa-01

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can choose between array scanning and hash lookup from operation mix and expected complexity.
- Point IDs: 3b2be54e-e9ae-4477-9e43-bbf9dce91262
- Source revision: 6c859a32-8da7-4a13-bec5-b811094e68a0 (revision 1)
- Content hash: `aa19b50ac97685a120135cab1d8d5a7978e7ea18e270634e4e05f764f8f475bd`
- Item slug/type: sde-dsa-array-hash-operation-mix-verification / short_explanation
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Explain array scanning versus hash lookup in a new case**

Use the stated system behavior; call out assumptions that affect the conclusion.

A new implementation changes one constraint: A service repeatedly checks membership in a large, changing set and does not need sorted iteration. Explain which part of the original rule still applies and what must be checked before relying on it.

### Reference-answer contract

A hash table usually gives expected constant-time lookup when hashes are well distributed, while a scan is linear and an array preserves order and compact sequential access. A complete answer explicitly connects this principle to the changed constraint and identifies any assumption that would alter the result.

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

> A hash table usually gives expected constant-time lookup when hashes are well distributed, while a scan is linear and an array preserves order and compact sequential access. A complete answer explicitly connects this principle to the changed constraint and identifies any assumption that would alter the result.

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

## eval-v1-dsa-02

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can choose between array scanning and hash lookup from operation mix and expected complexity.
- Point IDs: 3b2be54e-e9ae-4477-9e43-bbf9dce91262
- Source revision: 31beafca-8098-4773-8a7e-4a1a24d43ce0 (revision 1)
- Content hash: `0f986392e2daf6c5d9acc39e387bfe5686be0dd3c9a91af3720fb3537a4b3186`
- Item slug/type: sde-dsa-array-hash-operation-mix-recall-1 / rapid_recall
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall array scanning versus hash lookup**

State the central rule for array scanning versus hash lookup and one condition that affects whether it holds.

### Reference-answer contract

A hash table usually gives expected constant-time lookup when hashes are well distributed, while a scan is linear and an array preserves order and compact sequential access.

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

> A hash table usually gives expected constant-time lookup when hashes are well distributed.

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

## eval-v1-dsa-03

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can choose between array scanning and hash lookup from operation mix and expected complexity.
- Point IDs: 3b2be54e-e9ae-4477-9e43-bbf9dce91262
- Source revision: 837a6323-d63c-4e43-9b30-fc8916dbbb72 (revision 1)
- Content hash: `9c724b4d19deb58711ae634708d24e8314c4a6568a30a1cae29c5b1f7d5b70de`
- Item slug/type: sde-dsa-array-hash-operation-mix-recall-3 / rapid_recall
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall array scanning versus hash lookup**

A service repeatedly checks membership in a large, changing set and does not need sorted iteration.

Apply array scanning versus hash lookup to this case: A service repeatedly checks membership in a large, changing set and does not need sorted iteration. What should the engineer expect, and why?

### Reference-answer contract

A hash table usually gives expected constant-time lookup when hashes are well distributed, while a scan is linear and an array preserves order and compact sequential access. In the stated case, this means the design or diagnosis must account for the described constraint.

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

> Hash lookup is worst-case constant time for every key distribution.

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

## eval-v1-dsa-04

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can choose between array scanning and hash lookup from operation mix and expected complexity.
- Point IDs: 3b2be54e-e9ae-4477-9e43-bbf9dce91262
- Source revision: 8e56335c-14cf-4914-a801-5a7072649d79 (revision 1)
- Content hash: `ae2ee9cdc1ed32ce385030e3663d0ec232a2f00a96161a77d5c23f34b6ff0d4f`
- Item slug/type: sde-dsa-array-hash-operation-mix-recall-2 / rapid_recall
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall array scanning versus hash lookup**

An engineer claims: “An array scan is always preferable because it uses less memory.” Correct the claim using array scanning versus hash lookup.

### Reference-answer contract

That claim is incorrect. A hash table usually gives expected constant-time lookup when hashes are well distributed, while a scan is linear and an array preserves order and compact sequential access.

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

> Hash lookup is worst-case constant time for every key distribution.

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

## eval-v1-dsa-05

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can explain collision handling, key equality, and expected-versus-worst-case hash lookup.
- Point IDs: 49508cd2-9e1b-4b8a-ab74-e809b2d11cfa
- Source revision: 67158d6b-1e2a-473b-b43a-3c867e25a06b (revision 1)
- Content hash: `852c09c8d5aa41ffaa18fb0ef121d1f49ce7b90562134311bf2373d6b2fa4d48`
- Item slug/type: sde-dsa-hash-collision-equality-recall-2 / rapid_recall
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall hash collisions and key equality**

An engineer claims: “Equal keys may produce unrelated hashes and still be found reliably.” Correct the claim using hash collisions and key equality.

### Reference-answer contract

That claim is incorrect. A collision is resolved by the table's collision strategy, and keys considered equal must have compatible hashes; expected lookup depends on distribution and load, while pathological collisions can degrade performance.

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

> A product team should communicate clearly, hire good engineers, and keep stakeholders informed.

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

## eval-v1-dsa-06

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can explain collision handling, key equality, and expected-versus-worst-case hash lookup.
- Point IDs: 49508cd2-9e1b-4b8a-ab74-e809b2d11cfa
- Source revision: 85ae4287-72d6-46f1-b7b3-075bd3b98acc (revision 1)
- Content hash: `133bb601143bd062018ee97ec7371ea35e3df0650829df6874abad87667a2c26`
- Item slug/type: sde-dsa-hash-collision-equality-verification / short_explanation
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Explain hash collisions and key equality in a new case**

Use the stated system behavior; call out assumptions that affect the conclusion.

A new implementation changes one constraint: Two distinct user keys map to the same bucket, while an equal key is reconstructed from a request. Explain which part of the original rule still applies and what must be checked before relying on it.

### Reference-answer contract

A collision is resolved by the table's collision strategy, and keys considered equal must have compatible hashes; expected lookup depends on distribution and load, while pathological collisions can degrade performance. A complete answer explicitly connects this principle to the changed constraint and identifies any assumption that would alter the result.

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

> It depends.

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

## eval-v1-dsa-07

- Domain: Data Structures and Algorithms
- Canonical concept: Array and hash lookup trade-offs (94a7f4ee-fbc0-42ac-b1ac-cdcd19003f9b)
- Knowledge point: Can explain collision handling, key equality, and expected-versus-worst-case hash lookup.
- Point IDs: 49508cd2-9e1b-4b8a-ab74-e809b2d11cfa
- Source revision: a9050f94-38fa-4070-a863-54532757a315 (revision 1)
- Content hash: `c2fea5cc1c28e407504b9b80dbfabbe232e5797e59551d9a2950df42f4ff3c56`
- Item slug/type: sde-dsa-hash-collision-equality-recall-1 / rapid_recall
- Provenance: {"title":"MIT OpenCourseWare 6.006: Introduction to Algorithms","url":"https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/","publisher":"Massachusetts Institute of Technology","accessedOn":"2026-10-18T18:30:00.000Z"}

### Question

**Recall hash collisions and key equality**

State the central rule for hash collisions and key equality and one condition that affects whether it holds.

### Reference-answer contract

A collision is resolved by the table's collision strategy, and keys considered equal must have compatible hashes; expected lookup depends on distribution and load, while pathological collisions can degrade performance.

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

> A collision is resolved by the table's collision strategy, and keys considered equal must have compatible hashes; expected lookup depends on distribution and load, while pathological collisions can degrade performance. However, the opposite is always true in every case.

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

