const prefetched = new Set();

/**
 * 預取路由組件，於瀏覽器空檔期執行，避免阻塞首屏。
 *
 * @param {() => Promise<unknown>} loader 動態 import loader（與 router 內同一函式引用）
 */
export function prefetch(loader) {
  const key = loader.toString();
  if (prefetched.has(key)) return;
  prefetched.add(key);

  const runLoader = () => loader().catch(() => {});

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(runLoader);
  } else {
    setTimeout(runLoader, 1500);
  }
}
