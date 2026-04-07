import { createRouter, createWebHashHistory } from 'vue-router'
import ChartView from '../views/ChartView.vue'
import ReportsView from '../views/ReportsView.vue'
import NewsView from '../views/NewsView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: ChartView },
    { path: '/reports', component: ReportsView },
    { path: '/news', component: NewsView }
  ]
})
