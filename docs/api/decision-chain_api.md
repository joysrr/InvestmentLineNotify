# Decision Chain Responsibility Architecture Spec

## Scope Information

- **Scope**: M (Medium) - Refactoring a single massive function (`buildDecision`) into an extensible Chain of Responsibility pattern. No UI impact.
- **Affected Path**: `src/modules/strategy/strategyEngine.mjs` -> split into `src/modules/strategy/decision/chain.mjs` and rules.

## NOT in Scope

- **Domain Logic Overhaul**: We are not changing _what_ the rules do, just _how_ they are evaluated and ordered.
- **Data Source Changes**: We are assuming `ctx` and `strategy` payloads remain identical.

## What Already Exists

- `buildDecision` function handles all rules sequentially inside a 300+ line block.
- State evaluation logic is mature but tightly coupled. The existing pure functions for evaluating policies (e.g. `determineRegime`, `evaluateMarginLayer`) will be reused verbatim inside the new Rule classes.

## Engineering Review (Track A)

### A1. Architecture Pass

The refactoring transforms `buildDecision` into an evaluation engine that iterates over a prioritized list of `DecisionRule` objects.

**Rule Interface Definition:**

```typescript
interface DecisionRule {
  priority: number; // Lower number = higher priority (evaluated first)
  name: string; // Identifier for logging/debugging

  /**
   * Evaluates the rule.
   * @param ctx Read-only context containing market and portfolio data
   * @param strategy Read-only user strategy config
   * @param engineState Mutable state shared across rules (e.g., bypass flags, pre-calculated thresholds)
   * @returns {DecisionResult} if the rule forces an early return/decision.
   * @returns {null} if the rule delegates to the next in chain.
   */
  evaluate(ctx: Object, strategy: Object, engineState: Object): Object | null;
}
```

**Chain Runner Logic:**

```javascript
// Pseudocode inside buildDecision
export function buildDecision(
  ctx,
  strategy,
  grossLeverageResult,
  ma60Slope = null,
) {
  const engineState = {
    panicBypassActive: false,
    valuationGuardResult: null,
    regimeResult: null,
    adjustedMaxLeverage: null,
  };

  const rules = [
    new PreCalcValuationRule(), // Priority 0
    new TrendConfirmationRule(), // Priority 5
    new RegimePolicyRule(), // Priority 10
    new MarginLayerRule(), // Priority 20
    new PanicBypassFlagRule(), // Priority 25 (Sets flag in engineState)
    new LifecycleLeverageRule(), // Priority 30
    new GrossLeverageRule(), // Priority 40
    new ValuationGuardRule(), // Priority 50
    new EntryGateRule(), // Priority 60
    new StopLossRule(), // Priority 70
    new ConversionGuardRule(), // Priority 80
    new BalancerRule(), // Priority 90
    new ScoringDecisionRule(), // Priority 100
  ].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    const result = rule.evaluate(ctx, strategy, engineState);
    if (result !== null) {
      if (rule.name === "ScoringDecisionRule") {
        return applyBudgetSynergy(result, ctx, strategy);
      }
      return result;
    }
  }
}
```

### A3. Test Matrix Outline

Since the implementation is heavily decoupled, tests should focus on isolated rule logic and runner order.

```text
CODE PATHS                                            USER FLOWS
[+] Rule Evaluation Chain                             [+] Decision Pipeline
  ├── CRISIS Regime (Rule 10 triggers early return)     ├── No further rules evaluated (forced sell)
  ├── Margin Layer Threat (Rule 20 triggers)            ├── Bypass normal buying logic
  ├── Normal State (Propagates to Scoring)              ├── Regular DCA / Tactical Buy
```

- **Unit Tests**: Ensure each `DecisionRule.evaluate()` correctly returns a result or `null`.
- **Integration Tests**: Ensure `buildDecision` correctly assembles and aborts on the first truthy result.

### A4. Failure Mode Analysis

| Failure Scenario                                                         | Covered By Test Matrix | Error Handled                                                        | Silent Failure Risk                                        |
| ------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Rule modifies `ctx` or `strategy` unexpectedly causing downstream errors | No                     | Yes (Data is conceptually Read-Only, but mutation could occur in JS) | Moderate (EngineState should be the only mutable boundary) |
| A high-priority rule returns `null` improperly, leaking to normal logic  | Yes                    | Yes                                                                  | Low                                                        |
| Developer implements rule without `execute` method                       | No                     | Yes (Duck typing crash)                                              | Low (Instant throw)                                        |

### A5. Performance Pass

- **Memory/CPU**: Splitting sequential function calls into object method calls has microscopic overhead.
- **Sorting**: Priority sorting should ideally happen only once per application boot or be statically defined, as O(N log N) for 15 elements is fast but unnecessary during runtime loops.

## ASCII Architecture Diagram

```
[Strategy Context & Data Input]
           |
           v
+--------------------------+
|  Decision Chain Runner   |
| (Sort by rule.priority)  |
+--------------------------+
           |
           v
     +----------+
 P0  | Regime   | --(If CRISIS)--> [ FORCE SELL ]
     +----------+
           | (If CAUTIOUS/NORMAL)
           v
     +----------+
 P1  | Margin   | --(If Risk)--> [ REDUCE RISK ]
     +----------+
           | (If Safe)
           v
     +----------+
 P2  | Lifecycle| --(If Block)--> [ BLOCK LEVERAGE ]
     +----------+
           | (If Pass)
           v
          ...
           v
     +----------+
 P9  | Scoring  | --(Calculate)--> [ TACTICAL/DCA ]
     +----------+
```
