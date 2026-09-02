import { defineStore } from "pinia";
import { ref } from "vue";

export const useNavigationStore = defineStore("navigation", () => {
  const radarSubTab = ref("overview");
  const simulatorSubTab = ref("forward");

  const setRadarSubTab = (tab) => {
    radarSubTab.value = tab;
  };

  const setSimulatorSubTab = (tab) => {
    simulatorSubTab.value = tab;
  };

  return {
    radarSubTab,
    simulatorSubTab,
    setRadarSubTab,
    setSimulatorSubTab,
  };
});
