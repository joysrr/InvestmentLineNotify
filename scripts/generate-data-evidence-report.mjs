import path from "node:path";
import { runCli } from "../src/modules/verification/generateDataEvidenceReport.mjs";

runCli({ rootDir: path.resolve(new URL("..", import.meta.url).pathname) });
