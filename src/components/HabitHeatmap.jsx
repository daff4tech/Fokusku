import React, { useMemo, useState } from 'react';
import { Check, Flame, Plus, Sparkles, X } from 'lucide-react';
import {
  buildHeatmapGrid,
  computeStreaks,
  formatDateID,
  formatMinutesID,
} from '../utils/stats.js';
import { getDateKey } from '../utils/storage.js';

export function HabitHeatmap({
  habits,
  habitLogs,
  focusLogs,
  onToggleHabitToday,
  onAddHabit,
  onDeleteHabit,
  onLoadDemo,
}) {
  const [newHabitName, setNewHabitName] = useState('');
  const [hoveredCell, setHoveredCell] = useState(null);

  const todayKey = getDateKey(new Date());
  const todayHabits = Array.isArray(habitLogs[todayKey])
    ? habitLogs[todayKey]
    : [];

  const { columns, monthLabels } = useMemo(
    () => buildHeatmapGrid(focusLogs, habitLogs, 24),
    [focusLogs, habitLogs]
  );

  const streaks = useMemo(
    () => computeStreaks(focusLogs, habitLogs),
    [focusLogs, habitLogs]
  );

  const handleAddHabit = (e) => {
    e.preventDefault();
    const trimmed = newHabitName.trim();
    if (!trimmed) return;
    onAddHabit(trimmed);
    setNewHabitName('');
  };

  // Build month label row aligned to 24 week columns
  const monthByCol = new Map(monthLabels.map((m) => [m.weekIndex, m.label]));

  return (
    <section className="card" aria-label="Habit Tracker dan Heatmap Konsistensi">
      <div className="card-header">
        <h2 className="card-title">
          <Flame size={17} style={{ color: 'var(--accent)' }} />
          <span>Habit & Heatmap Konsistensi</span>
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {streaks.totalMinutes === 0 && (
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={onLoadDemo}
              title="Isi contoh riwayat 24 minggu untuk melihat grafik & heatmap"
            >
              <Sparkles size={13} />
              <span>Muat Data Demo</span>
            </button>
          )}
          <span className="card-subtitle">
            {todayHabits.length}/{habits.length} habit hari ini
          </span>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-box">
          <div className="kpi-label">Fokus Hari Ini</div>
          <div className="kpi-value">
            {formatMinutesID(streaks.todayMinutes)}
          </div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Streak Aktif</div>
          <div className="kpi-value">{streaks.currentStreak} hari</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Terpanjang</div>
          <div className="kpi-value">{streaks.longestStreak} hari</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Total Fokus</div>
          <div className="kpi-value">
            {formatMinutesID(streaks.totalMinutes)}
          </div>
        </div>
      </div>

      {/* Daily Habit Checklist */}
      <form className="habit-add-row" onSubmit={handleAddHabit}>
        <input
          type="text"
          className="input"
          placeholder="Tambah habit harian (mis: Baca buku 20 menit)..."
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          maxLength={60}
          aria-label="Nama habit baru"
        />
        <button type="submit" className="btn btn-sm" aria-label="Tambah habit">
          <Plus size={15} />
          <span>Tambah</span>
        </button>
      </form>

      <div className="habit-chips">
        {habits.map((habit) => {
          const done = todayHabits.includes(habit.id);
          return (
            <div key={habit.id} className={`habit-chip ${done ? 'done' : ''}`}>
              <button
                type="button"
                onClick={() => onToggleHabitToday(habit.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                  fontWeight: 'inherit',
                  fontSize: 'inherit',
                }}
                aria-pressed={done}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 99,
                    border: '1.5px solid currentColor',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done ? 'var(--accent)' : 'transparent',
                    color: done ? '#fff' : 'inherit',
                    borderColor: done ? 'var(--accent)' : 'var(--border-strong)',
                  }}
                >
                  {done && <Check size={10} strokeWidth={3} />}
                </span>
                <span>{habit.icon || '✨'}</span>
                <span>{habit.name}</span>
              </button>
              <button
                type="button"
                className="habit-chip-del"
                onClick={() => onDeleteHabit(habit.id)}
                title={`Hapus habit ${habit.name}`}
                aria-label={`Hapus habit ${habit.name}`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* GitHub Contribution Heatmap */}
      <div className="heatmap-wrap">
        <div className="heatmap-inner">
          <div className="heatmap-months" aria-hidden="true">
            {columns.map((_, idx) => (
              <span key={idx}>{monthByCol.get(idx) || ''}</span>
            ))}
          </div>

          <div className="heatmap-body">
            <div className="heatmap-days-col" aria-hidden="true">
              <span>Sen</span>
              <span />
              <span>Rab</span>
              <span />
              <span>Jum</span>
              <span />
              <span />
            </div>

            <div className="heatmap-grid" role="grid" aria-label="Grafik kontribusi 24 minggu">
              {columns.map((week, wIdx) => (
                <div key={wIdx} className="heatmap-week">
                  {week.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={cell.isFuture}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onFocus={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={[
                        'heatmap-cell',
                        cell.isFuture ? 'future' : `lvl-${cell.level}`,
                        cell.isToday ? 'today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label={
                        cell.isFuture
                          ? undefined
                          : `${formatDateID(cell.key)}: ${cell.focusMinutes} menit fokus, ${cell.habitsDone} habit`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="heatmap-footer">
        <div className="heatmap-tooltip">
          {hoveredCell ? (
            <span>
              <strong>{formatDateID(hoveredCell.key)}</strong> —{' '}
              {formatMinutesID(hoveredCell.focusMinutes)} ({hoveredCell.sessions}{' '}
              sesi) · {hoveredCell.habitsDone} habit selesai
            </span>
          ) : (
            <span>Arahkan kursor ke kotak untuk detail harian (24 minggu)</span>
          )}
        </div>

        <div className="heatmap-legend" aria-label="Legenda intensitas">
          <span>Kurang</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span key={lvl} className={`heatmap-cell lvl-${lvl}`} />
          ))}
          <span>Banyak</span>
        </div>
      </div>
    </section>
  );
}
