import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import ChartView from '../views/ChartView.vue'
import ReportsView from '../views/ReportsView.vue'
import NewsView from '../views/NewsView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',        redirect: '/dashboard' },
    { path: '/dashboard',        component: DashboardView },
    { path: '/chart',   component: ChartView },
    { path: '/reports', component: ReportsView },
    { path: '/news',    component: NewsView },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})
