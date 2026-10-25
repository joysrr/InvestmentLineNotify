import { loadReplayEvidenceList } from "../../modules/replay/replayEvidenceLoader.mjs";

export default async function replayEvidenceRoute(fastify) {
  fastify.get(
    "/replay-evidence",
    {
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
