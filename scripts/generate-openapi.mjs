#!/usr/bin/env node
/**
 * Generate OpenAPI Spec from Fastify Swagger
 * 執行方式: npm run openapi:generate
 * 產出: docs/api/openapi.json
 */

import { buildApp } from "../src/api/server.mjs";
import { writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = resolve(__dirname, "../docs/api/openapi.json");

async function generateOpenAPI() {
  console.log("🔧 Building Fastify app to extract OpenAPI spec...");
  
  const app = await buildApp({ logger: false });
  await app.ready();
  
  // 取得 OpenAPI spec
  const spec = app.swagger();
  
  if (!spec) {
    throw new Error("Swagger spec not available. Ensure @fastify/swagger is registered.");
  }
  
  // 寫入檔案
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(spec, null, 2));
  
  console.log(`✅ OpenAPI spec written to ${OUTPUT_PATH}`);
  console.log(`   Title: ${spec.info?.title}`);
  console.log(`   Version: ${spec.info?.version}`);
  console.log(`   Paths: ${Object.keys(spec.paths || {}).length}`);
  
  await app.close();
  return spec;
}

generateOpenAPI().catch((err) => {
  console.error("❌ Generation failed:", err.message);
  process.exit(1);
});