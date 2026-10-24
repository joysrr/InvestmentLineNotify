import { describe, expect, it } from "vitest";
import { mapTheoreticalInputs } from "../../modules/strategy/theoreticalInputMapper.mjs";

describe("theoreticalInputMapper.mapTheoreticalInputs", () => {
  it("maps verified snapshot fields with provenance", () => {
    expect(
      mapTheoreticalInputs({
        snapshot: {
          date: "2026-10-23",
          qty0050: 1000,
          qtyZ2: 500,
          totalLoan: 200000,
          cash: 100000,
          price0050: 200,
          priceZ2: 80,
        },
        source: "replay-fixture",
        asOf: "2026-10-23T06:00:00Z",
      }),
    ).toEqual({
      status: "OK",
      inputs: {
        value0050: {
          value: 200000,
          source: "replay-fixture",
          asOf: "2026-10-23T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
        value00675L: {
          value: 40000,
          source: "replay-fixture",
          asOf: "2026-10-23T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
        totalDebt: {
          value: 200000,
          source: "replay-fixture",
          asOf: "2026-10-23T06:00:00Z",
          unit: "TWD",
          status: "VERIFIED",
        },
      },
    });
  });

  it("returns UNAVAILABLE when a required market price is missing", () => {
    expect(
      mapTheoreticalInputs({
        snapshot: {
          date: "2026-10-23",
          qty0050: 1000,
          qtyZ2: 500,
          totalLoan: 200000,
          cash: 100000,
          price0050: null,
          priceZ2: 80,
        },
        source: "replay-fixture",
        asOf: "2026-10-23T06:00:00Z",
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_PRICE",
      inputs: null,
    });
  });

  it("does not treat a missing loan as no debt", () => {
    expect(
      mapTheoreticalInputs({
        snapshot: {
          date: "2026-10-23",
          qty0050: 1000,
          qtyZ2: 500,
          totalLoan: null,
          cash: 100000,
          price0050: 200,
          priceZ2: 80,
        },
        source: "replay-fixture",
        asOf: "2026-10-23T06:00:00Z",
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_TOTAL_DEBT",
      inputs: null,
    });
  });

  it("returns UNAVAILABLE when provenance is incomplete", () => {
    expect(
      mapTheoreticalInputs({
        snapshot: {
          date: "2026-10-23",
          qty0050: 1000,
          qtyZ2: 500,
          totalLoan: 200000,
          cash: 100000,
          price0050: 200,
          priceZ2: 80,
        },
        source: null,
        asOf: "2026-10-23T06:00:00Z",
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "MISSING_PROVENANCE",
      inputs: null,
    });
  });

  it("returns UNAVAILABLE when a quantity is non-finite", () => {
    expect(
      mapTheoreticalInputs({
        snapshot: {
          date: "2026-10-23",
          qty0050: Number.NaN,
          qtyZ2: 500,
          totalLoan: 200000,
          cash: 100000,
          price0050: 200,
          priceZ2: 80,
        },
        source: "replay-fixture",
        asOf: "2026-10-23T06:00:00Z",
      }),
    ).toEqual({
      status: "UNAVAILABLE",
      reason: "INVALID_SNAPSHOT_NUMBER",
      inputs: null,
    });
  });
});
