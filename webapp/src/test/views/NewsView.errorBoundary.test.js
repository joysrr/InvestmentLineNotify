import { createViewErrorBoundarySuite } from "@/test/utils/viewErrorBoundaryTestFactory.js";
import NewsView from "@/views/NewsView.vue";

createViewErrorBoundarySuite(NewsView, "NewsView");
