/**
 * metricThresholds.js
 * 統一市場指標的顏色/等級判定邏輯。
 *
 * 設計原則：
 *  1. 每個指標只有一處閾值定義
 *  2. 回傳統一結構 { level, label, cls, subCls/textCls }，各 View 直接綁定
 *  3. level 為語意標籤（danger/warn/ok/neutral/info），對應 CSS class
 *
 * 使用範例：
 *   import { getVixLevel } from "@/utils/metricThresholds.js";
 *   const usVixCard = computed(() => getVixLevel(usVix.value, "us"));
 *   // → { level, label, cls, subCls }
 */

// ── 1. VIX ──
// 美股 CBOE VIX：<13.5 過度安逸、<20 平穩、<30 警戒、>=30 極度恐慌
// 台股 TAIEX VIX：無「過度安逸」級別，<20 平穩
export function getVixLevel(vix, market = "us") {
  const v = parseFloat(vix);
  if (isNaN(v)) {
    return { level: "neutral", label: "—", cls: "", subCls: "rc-sub--neutral" };
  }
  if (v >= 30) {
    return {
      level: "danger",
      label: "極度恐慌 🔥",
      cls: "card-danger",
      subCls: "rc-sub--danger",
    };
  }
  if (v >= 20) {
    return {
      level: "warn",
      label: "警戒 ⚠️",
      cls: "card-warn",
      subCls: "rc-sub--warn",
    };
  }
  if (market === "us" && v < 13.5) {
    return {
      level: "info",
      label: "過度安逸 ❄️",
      cls: "card-blue",
      subCls: "rc-sub--blue",
    };
  }
  return {
    level: "ok",
    label: "平穩 ✅",
    cls: "card-ok",
    subCls: "rc-sub--ok",
  };
}

// ── 2. CNN 恐懼貪婪 ──
export function getCnnLevel(score) {
  const v = parseFloat(score);
  if (isNaN(v)) {
    return { level: "neutral", label: "—", cls: "", subCls: "rc-sub--neutral" };
  }
  if (v <= 25) {
    return {
      level: "danger",
      label: "極度恐懼 😱",
      cls: "card-danger",
      subCls: "rc-sub--danger",
    };
  }
  if (v <= 45) {
    return {
      level: "warn",
      label: "恐懼 😰",
      cls: "card-warn",
      subCls: "rc-sub--warn",
    };
  }
  if (v >= 75) {
    return {
      level: "warn",
      label: "極度貪婪 🤑",
      cls: "card-warn",
      subCls: "rc-sub--warn",
    };
  }
  return {
    level: "ok",
    label: "中性 😐",
    cls: "card-ok",
    subCls: "rc-sub--ok",
  };
}

// ── 3. 融資維持率 ──
export function getMaintenanceLevel(ratio) {
  const v = parseFloat(ratio);
  if (isNaN(v)) {
    return { level: "neutral", label: "—", cls: "", textCls: "" };
  }
  if (v < 135) {
    return {
      level: "danger",
      label: "斷頭警戒 🔴",
      cls: "card-danger",
      textCls: "text-danger",
    };
  }
  if (v < 160) {
    return {
      level: "warn",
      label: "維持率偏低 ⚠️",
      cls: "card-warn",
      textCls: "text-warn",
    };
  }
  return { level: "ok", label: "安全 ✅", cls: "card-ok", textCls: "text-ok" };
}

// ── 4. 總槓桿 ──
export function getLeverageLevel(gl) {
  const v = parseFloat(gl);
  if (isNaN(v)) {
    return { level: "neutral", label: "—", cls: "", textCls: "" };
  }
  if (v >= 3.0) {
    return {
      level: "danger",
      label: "超過硬上限 🔴",
      cls: "card-danger",
      textCls: "text-danger",
    };
  }
  if (v >= 2.5) {
    return {
      level: "warn",
      label: "接近上限 ⚠️",
      cls: "card-warn",
      textCls: "text-warn",
    };
  }
  return { level: "ok", label: "正常 ✅", cls: "card-ok", textCls: "text-ok" };
}

// ── 5. PB 歷史分位數（PR） ──
export function getPrLevel(pr) {
  const v = parseFloat(pr);
  if (isNaN(v)) {
    return { level: "neutral", label: "—", cls: "", textCls: "" };
  }
  if (v >= 90) {
    return {
      level: "danger",
      label: "極度昂貴",
      cls: "card-danger",
      textCls: "text-danger",
    };
  }
  if (v >= 80) {
    return {
      level: "warn",
      label: "估值偏高",
      cls: "card-warn",
      textCls: "text-warn",
    };
  }
  if (v <= 25) {
    return {
      level: "ok",
      label: "極度便宜",
      cls: "card-ok",
      textCls: "text-ok",
    };
  }
  return { level: "neutral", label: "合理區間", cls: "", textCls: "" };
}
