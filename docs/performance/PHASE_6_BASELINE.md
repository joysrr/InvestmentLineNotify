# Phase 6 Performance and Quality Baseline

> Date: 2026-08-17
> Branch: `phase-6`
> Anchor: `9156e8a`
> Raw data: `phase6-baseline.json`

## Baseline

| Area                 | Result                                                             |
| -------------------- | ------------------------------------------------------------------ |
| Frontend tests       | 268 passed / 116.4s                                                |
| Backend API tests    | 149 passed / 11.8s                                                 |
| Frontend coverage    | Statements 47.64%, Branches 24.31%, Functions 30.18%, Lines 51.22% |
| Backend coverage     | Branches 63.24%                                                    |
| Frontend source lint | 0 errors / 75 warnings                                             |
| Frontend test lint   | 0 errors / 13 warnings                                             |
| Backend source lint  | 0 errors / 219 warnings                                            |
| Frontend build       | Passed; JS gzip 638.27KB, CSS gzip 63.09KB                         |
| E2E                  | 49/49 passed                                                       |
| Dogfood              | Stale; existing report uses port 3001                              |

## Baseline Rules

- Frontend and Backend coverage stay separate.
- Generated output and test utilities are not production quality targets.
- Baseline collection must not create commits or start long-lived services.
- Dogfood must be rerun with current port 3000 and current endpoints.
- Existing threshold failures are recorded as baseline gaps, not hidden.

## Phase 6 Targets

- Global Frontend Branches >= 40%.
- Core module Branches >= 70%.
- Frontend production source: 0 warnings.
- Tests: fewer than 20 warnings.
- Dogfood Critical/High/Medium bugs: 0.
- Frontend and Backend full tests: 3 consecutive successful runs.
