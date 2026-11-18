import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cssPath = join(__dirname, "..", "shared-styles.css");
const css = readFileSync(cssPath, "utf-8");

describe("P2 Fade-up motion design", () => {
  it("T-05: .fade-up CSS class exists with translateY + opacity keyframes", () => {
    expect(css).toContain(".fade-up");
    expect(css).toContain("transform: translateY(20px)");
    expect(css).toContain("opacity: 0");
    expect(css).toContain("opacity: 1");
    expect(css).toContain("var(--iln-ease-standard)");
    expect(css).toContain("var(--iln-duration-slow)");
  });

  it("T-05: .fade-up uses --iln-duration-slow and --iln-ease-standard design tokens", () => {
    expect(css).toContain("var(--iln-duration-slow)");
    expect(css).toContain("var(--iln-ease-standard)");
  });

  it("T-05: stagger delay classes exist (50–100ms)", () => {
    expect(css).toContain(".fade-up--stagger-1");
    expect(css).toContain("50ms");
    expect(css).toContain(".fade-up--stagger-2");
    expect(css).toContain("100ms");
  });

  it("T-06: button :active micro-feedback exists", () => {
    expect(css).toContain("button:active");
    expect(css).toContain("transform: scale(");
    expect(css).toContain("150ms");
  });

  it("T-06: card :hover micro-feedback exists", () => {
    expect(css).toContain(".iln-card:hover");
    expect(css).toContain("transform: translateY(");
    expect(css).toContain("var(--iln-shadow-2)");
  });
});
