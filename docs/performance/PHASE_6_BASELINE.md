# Phase 6 Performance and Quality Baseline

> Final measurement date: 2026-08-17
> Branch: `phase-6`
> Final documentation commit: `720f281` (baseline artifact); E2E/latency update: `7c4c148`
> Raw baseline: `phase6-baseline.json`

## Baseline vs Final

| Metric                   | Initial baseline                                                   | Final measurement                                                  | Evidence                                          |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| Frontend tests           | 268 / 116.4s                                                       | 323 / 141.0s                                                       | `node scripts/phase6-baseline.mjs`                |
| Backend API tests        | 149 / 11.8s                                                        | 149 / 12.0s                                                        | `node scripts/phase6-baseline.mjs`                |
| Frontend coverage        | Statements 47.64%, Branches 24.31%, Functions 30.18%, Lines 51.22% | Statements 59.17%, Branches 41.69%, Functions 43.64%, Lines 62.62% | Full frontend coverage run                        |
| Backend coverage         | Branches 63.24%                                                    | Not remeasured in this final slice                                 | Existing backend blocker remains documented       |
| Frontend production lint | 0 errors / 75 warnings                                             | 0 errors / 0 warnings                                              | Production-source lint verification               |
| Frontend test lint       | 0 errors / 13 warnings                                             | 0 errors / 8 warnings                                              | `node scripts/phase6-baseline.mjs` includes `src` |
| Backend lint             | 0 errors / 219 warnings                                            | 0 errors / 219 warnings                                            | `node scripts/phase6-baseline.mjs`                |
| Frontend build           | JS gzip 638.27 kB, CSS gzip 63.09 kB                               | JS gzip 638.03 kB, CSS gzip 63.09 kB                               | `npm run build`                                   |
| E2E                      | 49/49 passed                                                       | 49/49 passed, workers=1                                            | `cd webapp && npx playwright test --workers=1`    |
| Dogfood                  | Stale, port 3001                                                   | API 10/10; pages 3/3; bugs 0                                       | `dogfood-output/report.md`                        |
| API health latency       | Not measured                                                       | avg 9.569ms, p95 14.589ms, max 15.010ms (30 samples)               | `GET http://127.0.0.1:3000/health`                |

## Phase 6 Gates

- Frontend global Branches >= 40%: **passed, 41.69%**.
- Core module Branches >= 70%: **passed for measured core slices**.
- Frontend production source: **0 warnings**.
- Frontend test warnings < 20: **8 warnings**.
- Dogfood Critical/High/Medium bugs: **0/0/0**.
- Frontend full tests: **323/323 passed**.
- Backend API tests: **149/149 passed**.

## Notes and Remaining Gaps

- Backend full-suite native segmentation fault remains an independent blocker; it is not hidden by this frontend quality phase.
- Generated Dogfood report and screenshots remain local and are not committed.
- E2E, Backend coverage, and API latency require a separate fresh run before claiming full Phase 6 closure.
- Existing build warnings about large chunks and a VueUse Rollup annotation are informational; build exit status was 0.

## Verification Commands

```bash
node scripts/phase6-baseline.mjs
cd webapp && npx vitest run
cd webapp && npx vitest run --coverage --coverage.reporter=text
cd webapp && npm run build
node webapp/scripts/dogfood-qa.mjs
```

## Rules

- Frontend and Backend coverage remain separate.
- Generated output and screenshots are not committed.
- Existing threshold failures are recorded, not hidden or weakened.
- Baseline documents contain only measured results or explicit `Not remeasured` gaps.
