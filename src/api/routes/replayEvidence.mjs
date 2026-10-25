import { loadReplayEvidenceList } from "../../modules/replay/replayEvidenceLoader.mjs";
import { initDataGuard } from "../middleware/initDataGuard.mjs";

const isDev = process.env.NODE_ENV === "development";

export default async function replayEvidenceRoute(fastify) {
  fastify.get(
    "/api/replay-evidence",
    {
      preHandler: isDev ? undefined : initDataGuard,
      schema: {
        description: "List replay evidence files",
        tags: ["replay"],
        response: {
          200: {
            type: "object",
            properties: {
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  required: ["replayDate", "fixtureSource", "status"],
                  properties: {
                    schemaVersion: { type: "string" },
                    fixtureSource: { type: "string" },
                    replayDate: { type: "string" },
                    dataAsOf: { type: "object" },
                    dataProvenance: { type: "array" },
                    strategyHash: { type: "string" },
                    status: { type: "string" },
                    replayResultHash: { type: "string" },
                    replayMatches: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const evidence = await loadReplayEvidenceList();
      return { evidence };
    },
  );
}
