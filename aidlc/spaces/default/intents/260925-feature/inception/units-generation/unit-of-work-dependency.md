# Unit of Work — Dependency Graph

> Topology for construction sequencing. Delivery Planning reads this graph to determine Bolt ordering.

## Dependency DAG (text)

```
u0-frontend (walking skeleton)
  |
  +---> u1-image-upload (needs u0 + u8)
  |         |
  |         +---> u2-ai-critique
  |                   |
  |                   +---> u3-low-confidence
  |                   |
  |                   +---> u4-critique-storage (needs u2 + u3 + u8)
  |                                 |
  |                                 +---> u5-history-storage
  |                                 |         |
  |                                 |         +---> u6-trend-calculation
  |                                 |                   |
  |                                 |         +---------+---> u7-tier-api (needs u6 + u9)
  |                                 |         |
  |                                 +---> u13-history-deletion (needs u4+u5+u8+u9)
  |
  +---> u8-authentication (no dependencies)
            |
            +---> u9-upload-limits
            |         |
            |         +---> u10-mock-payment
            |         |
            |         +---> u7-tier-api (needs u9 for tier status)
            |         |
            |         +---> u13-history-deletion (needs u9 for counter reset)
            |
            +---> u11-onboarding
                      |
                      +---> u12-data-policy
                      |
                      +---> (u13-history-deletion)
```

<!-- Text fallback: Directed acyclic graph. u0-frontend (walking skeleton) and u8-authentication have no dependencies. u0 enables u1; u8 enables u9, u11. u1 enables u2. u2 enables u3 and u4. u4 enables u5 and u13. u5 enables u6. u6 and u9 together enable u7. u9 enables u10. u11 enables u12. u13 depends on u4, u5, u8, u9. -->

---

## Dependency Matrix

| Unit | Depends on | Enables |
|---|---|---|
| u0-frontend | — | u1 |
| u8-authentication | — | u1, u9, u11 |
| u1-image-upload | u0, u8 | u2 |
| u9-upload-limits | u8 | u7, u10, u13 |
| u11-onboarding | u8 | u12 |
| u2-ai-critique | u1 | u3, u4 |
| u10-mock-payment | u9 | — |
| u12-data-policy | u8 | — |
| u3-low-confidence | u2 | u4 |
| u4-critique-storage | u2, u3, u8 | u5, u13 |
| u5-history-storage | u4 | u6, u13 |
| u6-trend-calculation | u5 | u7 |
| u7-tier-api | u6, u9 | — |
| u13-history-deletion | u4, u5, u6, u8, u9 | — |

---

## Parallelizable Groups

Units that can run in parallel (no dependency between them):

| Parallel Group | Units | Notes |
|---|---|---|
| Group 0 (Bolt 1 — Walking Skeleton) | u0-frontend, u8-authentication | No dependencies; start here |
| Group 1 | u1-image-upload, u9-upload-limits, u11-onboarding | All depend only on Group 0 units |
| Group 2 | u2-ai-critique, u10-mock-payment, u12-data-policy | Depend only on Group 1 units |
| Group 3 | u3-low-confidence, u4-critique-storage | Depend on u2 (and u8 for u4) |
| Group 4 | u5-history-storage | Depends on u4 |
| Group 5 | u6-trend-calculation, u13-history-deletion | u6 depends on u5; u13 depends on u4+u5+u8+u9 |
| Group 6 | u7-tier-api | Depends on u6 + u9 |

**For a solo developer, groups are sequential (no parallel execution). Delivery Planning converts this topology to a serial Bolt sequence.**

---

## Critical Path (Longest Dependency Chain)

`u0 → u1 → u2 → u3 → u4 → u5 → u6 → u7` (8 units in series)

The critical path goes through the full IngestionService + ProgressService chain. If any unit in this path is delayed, u7 (the core freemium value proposition) is delayed.
