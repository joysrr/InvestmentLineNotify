import { setActivePinia, createPinia } from "pinia";
import { describe, expect, it, beforeEach } from "vitest";
import { useNavigationStore } from "@/stores/navigationStore";

describe("Navigation Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("remembers sub-tab selection for radar view", () => {
    const store = useNavigationStore();
    expect(store.radarSubTab).toBe("overview");
    store.setRadarSubTab("technical");
    expect(store.radarSubTab).toBe("technical");
  });

  it("remembers sub-tab selection for simulator view", () => {
    const store = useNavigationStore();
    expect(store.simulatorSubTab).toBe("forward");
    store.setSimulatorSubTab("reverse");
    expect(store.simulatorSubTab).toBe("reverse");
  });
});
