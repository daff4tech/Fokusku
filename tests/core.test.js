import { describe, expect, it } from 'vitest';
import {
  addDays,
  createDemoHistory,
  DEFAULT_HABITS,
  getDateKey,
  parseDateKey,
} from '../src/utils/storage.js';
import {
  buildHeatmapGrid,
  buildWeeklyChartData,
  computeStreaks,
  formatMinutesID,
  getIntensityLevel,
} from '../src/utils/stats.js';

describe('Date & Storage Utilities', () => {
  it('formats and parses local YYYY-MM-DD keys accurately', () => {
    const d = new Date(2026, 10, 27); // Nov 27, 2026
    const key = getDateKey(d);
    expect(key).toBe('2026-11-27');

    const parsed = parseDateKey(key);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(10);
    expect(parsed.getDate()).toBe(27);

    const prev = addDays(d, -2);
    expect(getDateKey(prev)).toBe('2026-11-25');
  });

  it('creates repeatable demo history across 24 weeks', () => {
    const base = new Date(2026, 10, 27);
    const { focusLogs, habitLogs } = createDemoHistory(DEFAULT_HABITS, base);
    const focusKeys = Object.keys(focusLogs);
    expect(focusKeys.length).toBeGreaterThan(60);
    expect(focusLogs['2026-11-27'].minutes).toBeGreaterThan(0);
    expect(Object.keys(habitLogs).length).toBeGreaterThan(40);
  });
});

describe('Heatmap, Streaks & Weekly Stats', () => {
  it('maps focus minutes + habits to GitHub intensity levels 0..4', () => {
    expect(getIntensityLevel(0, 0)).toBe(0);
    expect(getIntensityLevel(25, 0)).toBe(1);
    expect(getIntensityLevel(50, 0)).toBe(2);
    expect(getIntensityLevel(75, 1)).toBe(3); // 75 + 20 = 95
    expect(getIntensityLevel(125, 2)).toBe(4); // 125 + 40 = 165
  });

  it('builds a 24-week Monday-first heatmap grid with future days marked', () => {
    const today = new Date(2026, 10, 27); // Friday
    const focusLogs = { '2026-11-27': { minutes: 50, sessions: 2 } };
    const habitLogs = { '2026-11-27': ['habit-1'] };

    const { columns, monthLabels } = buildHeatmapGrid(focusLogs, habitLogs, 24, today);
    expect(columns).toHaveLength(24);
    columns.forEach((week) => expect(week).toHaveLength(7));
    expect(monthLabels.length).toBeGreaterThanOrEqual(5);

    const lastWeek = columns[23];
    // Friday is index 4 (Mon=0..Sun=6), Sat (5) and Sun (6) are future
    expect(lastWeek[4].isToday).toBe(true);
    expect(lastWeek[4].focusMinutes).toBe(50);
    expect(lastWeek[4].habitsDone).toBe(1);
    expect(lastWeek[5].isFuture).toBe(true);
    expect(lastWeek[6].isFuture).toBe(true);
  });

  it('computes current streak, longest streak, and totals accurately', () => {
    const today = new Date(2026, 10, 27);
    const focusLogs = {
      '2026-11-20': { minutes: 25, sessions: 1 },
      '2026-11-21': { minutes: 25, sessions: 1 },
      '2026-11-22': { minutes: 50, sessions: 2 },
      '2026-11-23': { minutes: 25, sessions: 1 },
      '2026-11-25': { minutes: 25, sessions: 1 },
      '2026-11-26': { minutes: 50, sessions: 2 },
    };
    const habitLogs = {
      '2026-11-27': ['habit-1'], // active today via habit
    };

    const stats = computeStreaks(focusLogs, habitLogs, today);
    expect(stats.currentStreak).toBe(3); // 25, 26, 27
    expect(stats.longestStreak).toBe(4); // 20..23
    expect(stats.totalMinutes).toBe(200);
    expect(stats.totalSessions).toBe(8);
  });

  it('aggregates last 7 days for Chart.js weekly statistics', () => {
    const today = new Date(2026, 10, 27);
    const focusLogs = {
      '2026-11-27': { minutes: 90, sessions: 3 },
      '2026-11-25': { minutes: 50, sessions: 2 },
    };

    const weekly = buildWeeklyChartData(focusLogs, today);
    expect(weekly.days).toHaveLength(7);
    expect(weekly.weeklyMinutes).toBe(140);
    expect(weekly.weeklySessions).toBe(5);
    expect(weekly.dailyAverageMinutes).toBe(20);
    expect(weekly.days[6].isToday).toBe(true);
    expect(weekly.days[6].hours).toBe(1.5);
  });

  it('formats durations cleanly in Indonesian', () => {
    expect(formatMinutesID(45)).toBe('45 menit');
    expect(formatMinutesID(60)).toBe('1 jam');
    expect(formatMinutesID(95)).toBe('1j 35m');
  });
});
