<template>
  <div class="view-container">
    <div class="view-header">
      <h2 class="view-title">新聞池</h2>
      <span class="view-subtitle" v-if="articles.length">共 {{ articles.length }} 則</span>
    </div>

    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>載入中...</p>
    </div>

    <div v-else-if="error" class="state-box state-error">
      <p>⚠️ {{ error }}</p>
      <button class="retry-btn" @click="load">重試</button>
    </div>

    <div v-else-if="articles.length === 0" class="state-box">
      <p>📭 目前新聞池為空</p>
    </div>

    <div v-else class="news-list">
      <div
        v-for="article in articles"
        :key="article.id"
        class="news-card"
        @click="openArticle(article.url)"
      >
        <div class="news-header">
          <span class="news-age" :class="ageBandClass(article.age_band)">
            {{ ageBandLabel(article.age_band) }}
          </span>
          <span class="news-region">{{ regionFlag(article._region) }}</span>
          <span class="news-source">{{ article.source }}</span>
          <span class="news-time">{{ formatDate(article.pubDate) }}</span>
        </div>
        <p class="news-title">{{ article.title }}</p>
        <p v-if="article.summary" class="news-summary">{{ article.summary }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchNews } from '../api/index.js'
import { useTelegram } from '../composables/useTelegram.js'

const articles = ref([])
const loading = ref(true)
const error = ref(null)

const { openLink } = useTelegram()

function openArticle(url) {
  openLink(url)
}

function ageBandClass(band) {
  if (band === 'fresh') return 'age-fresh'
  if (band === 'recent') return 'age-recent'
  return 'age-old'
}

function ageBandLabel(band) {
  if (band === 'fresh') return '🔴 最新'
  if (band === 'recent') return '🟡 近期'
  return '⚪ 舊聞'
}

function regionFlag(region) {
  if (region === 'TW') return '🇹🇼'
  if (region === 'US') return '🇺🇸'
  return '🌐'
}

function formatDate(pubDate) {
  try {
    return new Date(pubDate).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return pubDate
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await fetchNews()
    // /api/news 回傳物件，articles 在 data.articles
    const list = Array.isArray(data) ? data : (data?.articles ?? [])
    articles.value = list
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.view-container {
  padding: 16px;
  min-height: 100%;
}

.view-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.view-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}

.view-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

.news-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.news-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  active: opacity 0.8;
}

.news-card:active { opacity: 0.7; }

.news-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.news-age {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}

.age-fresh { background: #fdecea; color: #e84855; }
.age-recent { background: #fef9e7; color: #d4ac0d; }
.age-old { background: var(--tg-theme-hint-color, #eee); color: var(--tg-theme-hint-color, #999); opacity: 0.6; }

.news-region {
  font-size: 13px;
}

.news-source {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  flex: 1;
}

.news-time {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #aaa);
}

.news-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--tg-theme-text-color, #222);
  line-height: 1.45;
  margin-bottom: 4px;
}

.news-summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--tg-theme-hint-color, #999);
  font-size: 14px;
}

.state-error { color: #e84855; }

.retry-btn {
  padding: 8px 20px;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--tg-theme-hint-color, #ddd);
  border-top-color: var(--tg-theme-button-color, #2481cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
