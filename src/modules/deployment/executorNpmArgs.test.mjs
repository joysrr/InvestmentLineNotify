import { describe, expect, it } from "vitest";
import { buildNpmCiArgs } from "./executor.mjs";

describe("buildNpmCiArgs", () => {
  it("includes devDependencies required by the prepare hook", () => {
    expect(buildNpmCiArgs()).toEqual(["ci", "--include=dev"]);
  });
});
