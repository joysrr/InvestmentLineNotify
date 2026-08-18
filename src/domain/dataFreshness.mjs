export function tradingDayGap(latestDate, reportDate, tradingDays) {
  const latestIndex = tradingDays.indexOf(latestDate);
  const reportIndex = tradingDays.indexOf(reportDate);
  if (latestIndex < 0 || reportIndex < 0) return null;
  return Math.max(0, reportIndex - latestIndex);
}

export function evaluateFreshness(
  latestDate,
  reportDate,
  tradingDays,
  staleAfterTradingDays = 3,
) {
  if (!latestDate) return { status: "unavailable", tradingDayGap: null };

  const gap = tradingDayGap(latestDate, reportDate, tradingDays);
  if (gap == null) return { status: "unavailable", tradingDayGap: null };
  if (gap >= staleAfterTradingDays) {
    return { status: "stale", tradingDayGap: gap };
  }
  return { status: "fresh", tradingDayGap: gap };
}

export function evaluateFreshnessFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([name, input]) => [
      name,
      evaluateFreshness(
        input.latestDate,
        input.reportDate,
        input.tradingDays,
        input.staleAfterTradingDays,
      ),
    ]),
  );
}

export function buildTechnicalFreshnessObservation({
  historyZ2 = [],
  history0050 = [],
  reportDate,
  staleAfterTradingDays = 3,
}) {
  const tradingDays = [
    ...new Set(
      [...historyZ2, ...history0050].map((item) => item?.date).filter(Boolean),
    ),
  ].sort();
  return {
    z2History: evaluateFreshness(
      historyZ2.at(-1)?.date ?? null,
      reportDate,
      tradingDays,
      staleAfterTradingDays,
    ),
    etf0050History: evaluateFreshness(
      history0050.at(-1)?.date ?? null,
      reportDate,
      tradingDays,
      staleAfterTradingDays,
    ),
  };
}

export function buildFreshnessGuardDecision({
  mode = "shadow",
  freshness = {},
  affectedSignals = [],
}) {
  const blockedSignals = Object.values(freshness).some(
    (value) => value.status !== "fresh",
  )
    ? [...new Set(affectedSignals)]
    : [];
  return {
    mode,
    wouldBlock: blockedSignals.length > 0,
    blockedSignals,
  };
}

export function applyFreshnessGuard(result, decision) {
  if (decision.mode !== "enforcement" || !decision.wouldBlock) return result;
  const signal = result?.signals?.signalDirection;
  if (!decision.blockedSignals.includes(signal)) return result;
  return {
    ...result,
    signals: {
      ...result.signals,
      rawSignal: signal,
      signalDirection: "hold",
      blockedByDataFreshness: true,
      blockedSignals: decision.blockedSignals,
    },
  };
}

export function resolveFreshnessConfig(config = {}) {
  return {
    mode:
      process.env.DATA_FRESHNESS_MODE === "enforcement"
        ? "enforcement"
        : "shadow",
    staleAfterTradingDays: Number(config.staleAfterTradingDays ?? 3),
    dependencies: config.dependencies ?? {
      technical: ["z2History", "etf0050History"],
      institutional: ["institutionalHistory"],
      valuation: ["valuation"],
      risk: ["marketMargin", "vix"],
    },
  };
}

export function appendFreshnessObservation(state = {}, observation = {}) {
  const samples = [...(state.samples ?? []), observation];
  if (samples.length < 10) return { ...state, samples };

  const wouldBlockCount = samples.filter((item) => item.wouldBlock).length;
  return {
    samples: [],
    archive: {
      sampleCount: samples.length,
      wouldBlockCount,
      falsePositiveRate: wouldBlockCount / samples.length,
      observations: samples,
    },
  };
}

export function freshnessMetadataMismatch(
  historyMetadata = {},
  replayDataAsOf = {},
) {
  const names = new Set([
    ...Object.keys(historyMetadata),
    ...Object.keys(replayDataAsOf),
  ]);
  return [...names].some(
    (name) =>
      historyMetadata[name]?.latestDate !== replayDataAsOf[name]?.latestDate,
  );
}
