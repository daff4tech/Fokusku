export const STORAGE_KEYS = {
  THEME: 'fokusku_theme',
  TIMER_SETTINGS: 'fokusku_timer_settings',
  TASKS: 'fokusku_tasks',
  ACTIVE_TASK_ID: 'fokusku_active_task_id',
  HABITS: 'fokusku_habits',
  HABIT_LOGS: 'fokusku_habit_logs',
  FOCUS_LOGS: 'fokusku_focus_logs',
  MIXER_STATE: 'fokusku_mixer_state',
};

export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export const TIMER_PRESETS = {
  '25-5': {
    label: '25/5 Klasik',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
  },
  '50-10': {
    label: '50/10 Deep Work',
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
  },
};

export const DEFAULT_TIMER_SETTINGS = {
  preset: '25-5',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreak: false,
  autoStartFocus: false,
  soundEnabled: true,
  notificationsEnabled: false,
};

export const DEFAULT_TASKS = [
  {
    id: 'task-starter-1',
    title: 'Susun prioritas & target fokus hari ini',
    completed: false,
    estimatedPomodoros: 1,
    completedPomodoros: 0,
    createdAt: 1,
  },
  {
    id: 'task-starter-2',
    title: 'Sesi Deep Work: selesaikan tugas utama',
    completed: false,
    estimatedPomodoros: 3,
    completedPomodoros: 0,
    createdAt: 2,
  },
  {
    id: 'task-starter-3',
    title: 'Rapikan catatan & evaluasi harian',
    completed: false,
    estimatedPomodoros: 1,
    completedPomodoros: 0,
    createdAt: 3,
  },
];

export const DEFAULT_HABITS = [
  { id: 'habit-1', name: 'Deep work minimal 2 sesi', icon: '🎯' },
  { id: 'habit-2', name: 'Jauhkan HP saat timer jalan', icon: '📵' },
  { id: 'habit-3', name: 'Minum air & peregangan', icon: '💧' },
];

export const DEFAULT_MIXER_STATE = {
  masterVolume: 0.75,
  muted: false,
  channels: {
    rain: { active: false, volume: 0.6 },
    cafe: { active: false, volume: 0.45 },
    whitenoise: { active: false, volume: 0.35 },
    lofi: { active: false, volume: 0.55 },
  },
};

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function createDemoHistory(habits = DEFAULT_HABITS, baseDate = new Date()) {
  const focusLogs = {};
  const habitLogs = {};
  const habitIds = habits.map((h) => h.id);

  // Deterministic pseudo-random generator for clean, repeatable demo patterns
  let seed = 4219;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let offset = 167; offset >= 0; offset--) {
    const d = addDays(baseDate, -offset);
    const key = getDateKey(d);
    const dayOfWeek = d.getDay(); // 0 Sun .. 6 Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const recencyBoost = offset < 21 ? 0.22 : 0;
    const chance = (isWeekend ? 0.52 : 0.78) + recencyBoost;

    if (nextRand() < chance || offset === 0) {
      const sessions = offset === 0 ? 3 : Math.max(1, Math.floor(nextRand() * (isWeekend ? 4 : 6)) + 1);
      const minsPerSession = nextRand() > 0.4 ? 25 : 50;
      focusLogs[key] = {
        minutes: sessions * minsPerSession,
        sessions,
      };

      const checked = habitIds.filter(() => nextRand() > 0.28);
      if (checked.length > 0) {
        habitLogs[key] = checked;
      }
    }
  }

  return { focusLogs, habitLogs };
}

export function exportAllData() {
  return {
    app: 'FokusKu',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
      timerSettings: loadJSON(STORAGE_KEYS.TIMER_SETTINGS, DEFAULT_TIMER_SETTINGS),
      tasks: loadJSON(STORAGE_KEYS.TASKS, DEFAULT_TASKS),
      activeTaskId: loadJSON(STORAGE_KEYS.ACTIVE_TASK_ID, null),
      habits: loadJSON(STORAGE_KEYS.HABITS, DEFAULT_HABITS),
      habitLogs: loadJSON(STORAGE_KEYS.HABIT_LOGS, {}),
      focusLogs: loadJSON(STORAGE_KEYS.FOCUS_LOGS, {}),
      mixerState: loadJSON(STORAGE_KEYS.MIXER_STATE, DEFAULT_MIXER_STATE),
    },
  };
}
