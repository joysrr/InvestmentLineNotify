// Shared Langfuse v5 mock helpers for Vitest.
// Mirrors PHASE2_SPEC_V5.md §4 Mock 設計規格.
import { vi } from "vitest";

export const mockTracingV5 = {
  observe: vi.fn((fn) => fn),
  updateActiveObservation: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  getCurrentTraceId: vi.fn().mockReturnValue("test-trace-id"),
};

export const mockLangfuseClient = {
  prompts: {
    get: vi.fn().mockResolvedValue({
      version: 1,
      name: "test-prompt",
      prompt: [{ role: "system", content: "You are an AI assistant." }],
      config: {},
    }),
  },
  score: {
    create: vi.fn().mockResolvedValue(undefined),
  },
};

export const mockLangfuseExporter = {
  export: vi.fn(),
  shutdown: vi.fn(),
};

export function resetLangfuseMocks() {
  // tracing mocks
  mockTracingV5.observe.mockClear();
  mockTracingV5.observe.mockImplementation((fn) => fn);
  mockTracingV5.updateActiveObservation.mockClear();
  mockTracingV5.flush.mockClear();
  mockTracingV5.flush.mockResolvedValue(undefined);
  mockTracingV5.getCurrentTraceId.mockClear();
  mockTracingV5.getCurrentTraceId.mockReturnValue("test-trace-id");

  // client mocks
  mockLangfuseClient.prompts.get.mockClear();
  mockLangfuseClient.prompts.get.mockResolvedValue({
    version: 1,
    name: "test-prompt",
    prompt: [{ role: "system", content: "You are an AI assistant." }],
    config: {},
  });
  mockLangfuseClient.score.create.mockClear();
  mockLangfuseClient.score.create.mockResolvedValue(undefined);

  // exporter mocks
  mockLangfuseExporter.export.mockClear();
  mockLangfuseExporter.shutdown.mockClear();
}
