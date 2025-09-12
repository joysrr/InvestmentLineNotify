function getTaiwanDayOfWeek() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  return taiwanTime.getUTCDay();
}
function getTaiwanDate() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  return taiwanTime.getUTCDate();
}
function isQuarterEnd() {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 3600 * 1000);
  const month = taiwanTime.getUTCMonth() + 1;
  const date = taiwanTime.getUTCDate();
  if ([3,6,9,12].includes(month)) {
    const lastDay = new Date(taiwanTime.getUTCFullYear(), month, 0).getUTCDate();
    return date === lastDay;
  }
  return false;
}

module.exports = { getTaiwanDayOfWeek, getTaiwanDate, isQuarterEnd };
