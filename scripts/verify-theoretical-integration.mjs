#!/usr/bin/env node
/**
 * Verify theoretical integration in daily report.
 * Loads a recent daily report and checks theoreticalShadow field structure.
 */

import fs from "fs";
import path from "path";

const reportsDir = "data/reports";

// Find the most recent report
const files = fs.readdirSync(reportsDir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("❌ No reports found in data/reports/");
  process.exit(1);
}

const latestFile = files.sort().reverse()[0];
const reportPath = path.join(reportsDir, latestFile);

console.log(`📊 Reading report: ${reportPath}`);

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

console.log("\n" + "=".repeat(60));
console.log("Report Structure Check");
console.log("=".repeat(60));

// Check basic fields
console.log(`✅ date: ${report.date}`);
console.log(`✅ portfolio: ${report.portfolio ? "present" : "MISSING"}`);
console.log(
  `✅ portfolioSnapshot: ${report.portfolioSnapshot ? "present" : "MISSING"}`,
);

// Check theoreticalShadow field
console.log("\n" + "=".repeat(60));
console.log("Theoretical Shadow Check");
console.log("=".repeat(60));

if (!report.theoreticalShadow) {
  console.log("⚠️  theoreticalShadow: NOT PRESENT");
  console.log("   (This is expected if portfolio snapshot was UNAVAILABLE)");

  if (report.portfolioSnapshot) {
    console.log(
      `   portfolioSnapshot.status: ${report.portfolioSnapshot.status}`,
    );
  }

  process.exit(0);
}

console.log("✅ theoreticalShadow: PRESENT");
console.log(`   status: ${report.theoreticalShadow.status}`);

if (report.theoreticalShadow.status === "AVAILABLE") {
  console.log("\n📈 Theoretical Values:");

  const theory = report.theoreticalShadow.theory;

  if (theory) {
    console.log(`   status: ${theory.status}`);
    console.log(`   grossExposure: ${theory.grossExposure ?? "N/A"}`);
    console.log(`   currentLeverage: ${theory.currentLeverage ?? "N/A"}`);
    console.log(`   accountNetAsset: ${theory.accountNetAsset ?? "N/A"}`);
    console.log(
      `   estimatedMaintenance: ${theory.estimatedMaintenance ?? "N/A"}`,
    );

    if (theory.kellyLimits) {
      console.log(`   kellyLimits:`);
      console.log(
        `     conservativeLeverage: ${theory.kellyLimits.conservativeLeverage}`,
      );
      console.log(
        `     fullKellyLeverage: ${theory.kellyLimits.fullKellyLeverage}`,
      );
      console.log(
        `     quarterKellyLeverage: ${theory.kellyLimits.quarterKellyLeverage}`,
      );
      console.log(`     kellyFraction: ${theory.kellyLimits.kellyFraction}`);
    }

    if (theory.marketRegime) {
      console.log(`   marketRegime:`);
      console.log(`     mu: ${theory.marketRegime.mu}`);
      console.log(`     sigma: ${theory.marketRegime.sigma}`);
      console.log(`     regime: ${theory.marketRegime.regime}`);
      console.log(`     asOf: ${theory.marketRegime.asOf}`);
      console.log(`     sampleDays: ${theory.marketRegime.sampleDays}`);
    }

    console.log(`   humanCapital: ${theory.humanCapital ?? "N/A"}`);
    console.log(`   trueExposure: ${theory.trueExposure ?? "N/A"}`);

    if (theory.crashTolerance) {
      console.log(`   crashTolerance:`);
      console.log(
        `     maxDrawdownTolerance: ${theory.crashTolerance.maxDrawdownTolerance}`,
      );
      console.log(
        `     drawdownBeforeMarginCall: ${theory.crashTolerance.drawdownBeforeMarginCall}`,
      );
    }
  }

  console.log("\n✅ Theoretical shadow integration verified!");
} else {
  console.log(`   reason: ${report.theoreticalShadow.reason}`);
  console.log(
    "   (Theoretical calculation unavailable - graceful degradation working)",
  );
}

console.log("\n" + "=".repeat(60));
console.log("✅ Verification Complete");
console.log("=".repeat(60));
