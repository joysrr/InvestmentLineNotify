const pad = (n) => String(n).padStart(2, "0");

function toDate(time) {
  if (time == null) return null;
  const d = time instanceof Date ? time : new Date(time);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 完整日期時間：2026-11-12 14:30
 */
export function formatDateTime(time) {
  const d = toDate(time);
  if (!d) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 短日期：11/12
 */
export function formatShortDate(time) {
  const d = toDate(time);
  if (!d) return "—";
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * 相對時間：剛剛 / 3 分鐘前 / 2 小時前 / 5 天前 / 11/12
 */
export function formatRelative(time, now = Date.now()) {
  const d = toDate(time);
  if (!d) return "—";
  const diff = Math.max(0, now - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "剛剛";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return formatShortDate(d);
}

/**
 * 統一 _meta.lastRun / updatedAt / updated_at 取值
 * 回傳原始時間值（字串或數字），由呼叫端決定用哪個格式化函式
 */
export function resolveLastRun(meta) {
  if (!meta) return null;
  return meta.lastRun ?? meta.updatedAt ?? meta.updated_at ?? null;
}
