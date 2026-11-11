import { defineStore } from "pinia";
import { ref } from "vue";

export const useNavigationStore = defineStore("navigation", () => {
  const radarSubTab = ref("overview");

  const setRadarSubTab = (tab) => {
    radarSubTab.value = tab;
  };

  return {
    radarSubTab,
    setRadarSubTab,
  };
});
