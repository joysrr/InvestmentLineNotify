import Fastify from "fastify";

const fastify = Fastify({ logger: true });

fastify.get("/health", async () => {
  return { status: "barebones-ok", ts: Date.now() };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("🚀 Barebones server listening on 3000");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
