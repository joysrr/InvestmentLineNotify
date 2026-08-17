import { describe, expect, it, vi } from "vitest";
import { fetchSnapshots } from "../api/index.js";
import { usePortfolioSnapshots } from "./usePortfolioSnapshots.js";

vi.mock("../api/index.js", () => ({
  fetchSnapshots: vi.fn(),
}));

describe("usePortfolioSnapshots", () => {
  it("loads snapshots and exposes the latest snapshot", async () => {
    fetchSnapshots.mockResolvedValue({
      snapshots: [{ date: "2026-08-17", value: 100 }],
      hasEncryption: true,
    });
    const state = usePortfolioSnapshots(1);

    await state.load();

    expect(fetchSnapshots).toHaveBeenCalledWith(1);
    expect(state.snapshots.value).toEqual([{ date: "2026-08-17", value: 100 }]);
    expect(state.latestSnapshot.value).toEqual({
      date: "2026-08-17",
      value: 100,
    });
    expect(state.hasEncryption.value).toBe(true);
    expect(state.loading.value).toBe(false);
    expect(state.error.value).toBe(null);
  });

  it("reports HTTP status errors", async () => {
    fetchSnapshots.mockRejectedValue({ status: 503 });
    const state = usePortfolioSnapshots();

    await state.load();

    expect(state.error.value).toBe("載入失敗 (503)，請稍後再試");
    expect(state.loading.value).toBe(false);
  });

  it("reports network errors without a status", async () => {
    fetchSnapshots.mockRejectedValue(new Error("offline"));
    const state = usePortfolioSnapshots();

    await state.load();

    expect(state.error.value).toBe("網路或伺服器異常，請稍後再試");
    expect(state.loading.value).toBe(false);
  });
});
