import { addDays, getDateKey, parseDateKey } from './storage.js';

const MONTH_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const DAY_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function formatMinutesID(totalMinutes) {
  const mins = Math.round(totalMinutes || 0);
  if (mins < 60) return `${mins} menit`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} jam` : `${h}j ${m}m`;
}

export function formatDateID(dateKey) {
  const d = parseDateKey(dateKey);
  const day = DAY_SHORT_ID[d.getDay()];
  const month = MONTH_SHORT_ID[d.getMonth()];
  return `${day}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

export function getIntensityLevel(focusMinutes, habitsDone) {
  const score = (focusMinutes || 0) + (habitsDone || 0) * 20;
  if (score <= 0) return 0;
  if (score < 40) return 1;
  if (score < 90) return 2;
  if (score < 150) return 3;
  return 4;
}

/**
 * Builds a Monday-first GitHub-style contribution matrix.
 * Returns { columns, monthLabels } where columns is an array of 7-cell weeks.
 */
export function buildHeatmapGrid(
  focusLogs = {},
  habitLogs = {},
  weeks = 24,
  today = new Date()
) {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Monday-based weekday index: Mon=0 .. Sun=6
  const todayMonIdx = (todayMidnight.getDay() + 6) % 7;
  // End of grid is Sunday of the current week (cells after today marked future)
  const gridEnd = addDays(todayMidnight, 6 - todayMonIdx);
  const totalDays = weeks * 7;
  const gridStart = addDays(gridEnd, -(totalDays - 1));

  const columns = [];
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 0; w < weeks; w++) {
    const col = [];
    const weekFirstDate = addDays(gridStart, w * 7);
    const weekMonth = weekFirstDate.getMonth();

    // Place month label when a week starts a new month (or first column if gap allows)
    if (weekMonth !== lastMonth) {
      monthLabels.push({ weekIndex: w, label: MONTH_SHORT_ID[weekMonth] });
      lastMonth = weekMonth;
    }

    for (let r = 0; r < 7; r++) {
      const cellDate = addDays(gridStart, w * 7 + r);
      const isFuture = cellDate > todayMidnight;
      const key = getDateKey(cellDate);
      const focusEntry = focusLogs[key] || { minutes: 0, sessions: 0 };
      const habitsArr = Array.isArray(habitLogs[key]) ? habitLogs[key] : [];
      const level = isFuture
        ? -1
        : getIntensityLevel(focusEntry.minutes, habitsArr.length);

      col.push({
        key,
        date: cellDate,
        isFuture,
        isToday: key === getDateKey(todayMidnight),
        focusMinutes: focusEntry.minutes || 0,
        sessions: focusEntry.sessions || 0,
        habitsDone: habitsArr.length,
        level,
      });
    }
    columns.push(col);
  }

  return { columns, monthLabels };
}

export function computeStreaks(focusLogs = {}, habitLogs = {}, today = new Date()) {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const hasActivity = (key) => {
    const f = focusLogs[key];
    const h = habitLogs[key];
    return Boolean((f && f.minutes > 0) || (Array.isArray(h) && h.length > 0));
  };

  // Current streak: check today; if inactive today, start checking from yesterday
  let currentStreak = 0;
  let cursor = new Date(todayMidnight);
  if (!hasActivity(getDateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  while (hasActivity(getDateKey(cursor))) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Longest streak & totals across all recorded keys
  const allKeys = new Set([...Object.keys(focusLogs), ...Object.keys(habitLogs)]);
  const activeDates = Array.from(allKeys)
    .filter((k) => hasActivity(k))
    .sort();

  let longestStreak = 0;
  let run = 0;
  let prevDate = null;

  for (const key of activeDates) {
    const d = parseDateKey(key);
    if (prevDate) {
      const diffDays = Math.round((d - prevDate) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDate = d;
  }

  let totalMinutes = 0;
  let totalSessions = 0;
  for (const entry of Object.values(focusLogs)) {
    if (entry) {
      totalMinutes += entry.minutes || 0;
      totalSessions += entry.sessions || 0;
    }
  }

  const todayKey = getDateKey(todayMidnight);
  const todayMinutes = focusLogs[todayKey]?.minutes || 0;
  const todaySessions = focusLogs[todayKey]?.sessions || 0;

  return {
    currentStreak,
    longestStreak,
    totalMinutes,
    totalSessions,
    todayMinutes,
    todaySessions,
  };
}

export function buildWeeklyChartData(focusLogs = {}, today = new Date()) {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = [];
  let weeklyMinutes = 0;
  let weeklySessions = 0;

  for (let i = 6; i >= 0; i--) {
    const d = addDays(todayMidnight, -i);
    const key = getDateKey(d);
    const entry = focusLogs[key] || { minutes: 0, sessions: 0 };
    const minutes = entry.minutes || 0;
    const sessions = entry.sessions || 0;
    weeklyMinutes += minutes;
    weeklySessions += sessions;

    days.push({
      key,
      label: DAY_SHORT_ID[d.getDay()],
      fullDate: `${d.getDate()} ${MONTH_SHORT_ID[d.getMonth()]}`,
      minutes,
      hours: Number((minutes / 60).toFixed(2)),
      sessions,
      isToday: i === 0,
    });
  }

  return {
    days,
    weeklyMinutes,
    weeklySessions,
    dailyAverageMinutes: Math.round(weeklyMinutes / 7),
  };
}
