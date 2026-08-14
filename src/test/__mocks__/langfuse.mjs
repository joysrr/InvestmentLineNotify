/**
 * langfuse mock - 避免測試環境載入真實 SDK 導致 worker exit crash
 *
 * 用途：當測試環境沒有 LANGFUSE_PUBLIC_KEY/SECRET_KEY 時，
 *       langfuse SDK 在 shutdown 時會 crash 造成 vitest Worker error。
 *
 * 真實 Langfuse 測試 (aiPrompt.test.mjs) 會在 beforeAll 偵測 key 缺失並 skip。
 */

const LangfuseMock = function () {
  return {
    score: () => Promise.resolve(undefined),
    flush: () => Promise.resolve(undefined),
    shutdown: () => Promise.resolve(undefined),
    shutdownAsync: () => Promise.resolve(undefined),
    getPrompt: () => Promise.resolve({ prompt: [], config: {} }),
  };
};

export const Langfuse = LangfuseMock;
export default { Langfuse: LangfuseMock };
