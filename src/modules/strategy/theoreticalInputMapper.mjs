/**
 * Maps an explicit portfolio snapshot to shadow-mode theory inputs.
 * Pure function: no file I/O, API calls, or strategy mutations.
 */

function createInput(value, { source, asOf, unit }) {
  return {
    value,
    source,
    asOf,
    unit,
    status: "VERIFIED",
  };
}

export function mapTheoreticalInputs({ snapshot, source, asOf }) {
  if (source == null || asOf == null) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
      inputs: null,
    };
  }

  if (snapshot.price0050 == null || snapshot.priceZ2 == null) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_PRICE",
      inputs: null,
    };
  }

  if (snapshot.totalLoan == null) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_TOTAL_DEBT",
      inputs: null,
    };
  }

  if (
    ![
      snapshot.qty0050,
      snapshot.qtyZ2,
      snapshot.price0050,
      snapshot.priceZ2,
      snapshot.totalLoan,
    ].every(Number.isFinite)
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "INVALID_SNAPSHOT_NUMBER",
      inputs: null,
    };
  }

  const value0050 = snapshot.qty0050 * snapshot.price0050;
  const value00675L = snapshot.qtyZ2 * snapshot.priceZ2;

  return {
    status: "OK",
    inputs: {
      value0050: createInput(value0050, { source, asOf, unit: "TWD" }),
      value00675L: createInput(value00675L, { source, asOf, unit: "TWD" }),
      totalDebt: createInput(snapshot.totalLoan, {
        source,
        asOf,
        unit: "TWD",
      }),
      ...(snapshot.accountNetAsset != null &&
      snapshot.accountNetAssetSource != null &&
      snapshot.accountNetAssetAsOf != null &&
      Number.isFinite(snapshot.accountNetAsset)
        ? {
            accountNetAsset: createInput(snapshot.accountNetAsset, {
              source: snapshot.accountNetAssetSource,
              asOf: snapshot.accountNetAssetAsOf,
              unit: "TWD",
            }),
          }
        : {}),
    },
  };
}
