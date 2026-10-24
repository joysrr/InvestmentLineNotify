import { describe, expect, it } from "vitest";

import { READ_ONLY_REPORT_VIEW_SCHEMA } from "../../api/schema/contract.mjs";

describe("READ_ONLY_REPORT_VIEW_SCHEMA", () => {
  it("defines the stable read-only metadata contract", () => {
    expect(READ_ONLY_REPORT_VIEW_SCHEMA.type).toBe("object");
    expect(READ_ONLY_REPORT_VIEW_SCHEMA.properties).toMatchObject({
      date: { type: "string" },
      dataAsOf: { type: ["object", "null"] },
      dataProvenance: { type: "array" },
      strategyHash: { type: ["string", "null"] },
      fixtureSource: { type: ["string", "null"] },
      theoreticalSnapshot: { type: "object" },
      availability: { type: "object" },
    });

    expect(READ_ONLY_REPORT_VIEW_SCHEMA.required).toEqual([
      "date",
      "dataAsOf",
      "dataProvenance",
      "strategyHash",
      "fixtureSource",
      "theoreticalSnapshot",
      "availability",
    ]);
  });
});
