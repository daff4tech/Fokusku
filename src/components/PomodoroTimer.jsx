import React, { useState } from 'react';
import {
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { TIMER_PRESETS } from '../utils/storage.js';

export function formatTimerMMSS(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const MODE_LABELS = {
  focus: 'Sesi Fokus',
  shortBreak: 'Istirahat Pendek',
  longBreak: 'Istirahat Panjang',
};

export function PomodoroTimer({
  mode,
  secondsLeft,
  totalSeconds,
  isRunning,
  completedFocusCycles,
  settings,
  activeTask,
  onSwitchMode,
  onSelectPreset,
  onUpdateSettings,
  onToggleRun,
  onReset,
  onSkip,
  onCompleteEarly,
}) {
  const [showCustom, setShowCustom] = useState(settings.preset === 'custom');

  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - secondsLeft / totalSeconds)) : 0;
  const dashOffset = circumference * (1 - progress);

  const elapsedSeconds = Math.max(0, totalSeconds - secondsLeft);
  const canLogEarly = mode === 'focus' && elapsedSeconds >= 60;

  const interval = Math.max(2, settings.longBreakInterval || 4);
  const cycleIndex = completedFocusCycles % interval;

  const handlePresetClick = (presetKey) => {
    if (presetKey === 'custom') {
      onSelectPreset('custom');
      setShowCustom(true);
    } else {
      onSelectPreset(presetKey);
      setShowCustom(false);
    }
  };

  const handleNumChange = (key, rawVal, min, max) => {
    const val = Math.max(min, Math.min(max, Number(rawVal) || min));
    onUpdateSettings({ ...settings, preset: 'custom', [key]: val });
  };

  return (
    <section className="card timer-card" aria-label="Timer Pomodoro">
      <div className="mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'focus'}
          className={`mode-tab ${mode === 'focus' ? 'active' : ''}`}
          onClick={() => onSwitchMode('focus')}
        >
          Fokus
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'shortBreak'}
          className={`mode-tab ${mode === 'shortBreak' ? 'active' : ''}`}
          onClick={() => onSwitchMode('shortBreak')}
        >
          Istirahat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'longBreak'}
          className={`mode-tab ${mode === 'longBreak' ? 'active' : ''}`}
          onClick={() => onSwitchMode('longBreak')}
        >
          Istirahat Panjang
        </button>
      </div>

      <div className="preset-row">
        {Object.entries(TIMER_PRESETS).map(([key, info]) => (
          <button
            key={key}
            type="button"
            className={`preset-pill ${settings.preset === key ? 'active' : ''}`}
            onClick={() => handlePresetClick(key)}
          >
            {info.label}
          </button>
        ))}
        <button
          type="button"
          className={`preset-pill ${settings.preset === 'custom' ? 'active' : ''}`}
          onClick={() => {
            if (settings.preset === 'custom') {
              setShowCustom((v) => !v);
            } else {
              handlePresetClick('custom');
            }
          }}
        >
          <SlidersHorizontal
            size={12}
            style={{ verticalAlign: '-1px', marginRight: 4 }}
          />
          Custom
        </button>
      </div>

      <div className="timer-visual">
        <svg className="timer-svg" viewBox="0 0 236 236" aria-hidden="true">
          <circle className="timer-track" cx="118" cy="118" r={radius} />
          <circle
            className="timer-progress"
            cx="118"
            cy="118"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="timer-center">
          <div className="timer-digits" data-testid="timer-digits">
            {formatTimerMMSS(secondsLeft)}
          </div>
          <div className="timer-phase-label">{MODE_LABELS[mode]}</div>
          <div
            className="cycle-dots"
            title={`Siklus fokus: ${cycleIndex}/${interval} menuju istirahat panjang`}
          >
            {Array.from({ length: interval }).map((_, idx) => (
              <span
                key={idx}
                className={`cycle-dot ${idx < cycleIndex ? 'filled' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="active-task-banner">
        <Target size={15} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        {activeTask ? (
          <>
            <span>Fokus pada:</span>
            <strong title={activeTask.title}>{activeTask.title}</strong>
          </>
        ) : (
          <span>Pilih task harian di bawah untuk dilacak</span>
        )}
      </div>

      <div className="timer-controls">
        <button
          type="button"
          className="icon-btn square"
          onClick={onReset}
          title="Reset Timer (Pintasan: R)"
          aria-label="Reset timer"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          className="btn btn-primary timer-main-btn"
          onClick={onToggleRun}
          title="Mulai / Jeda (Pintasan: Spasi)"
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          <span>{isRunning ? 'Jeda' : 'Mulai'}</span>
        </button>

        <button
          type="button"
          className="icon-btn square"
          onClick={onSkip}
          title="Lewati ke fase berikutnya"
          aria-label="Lewati fase"
        >
          <SkipForward size={16} />
        </button>
      </div>

      {canLogEarly && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCompleteEarly}
          >
            <CheckCircle2 size={14} />
            <span>
              Selesaikan & catat {Math.max(1, Math.round(elapsedSeconds / 60))} menit
            </span>
          </button>
        </div>
      )}

      {showCustom && (
        <div className="custom-settings-panel">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: '0.82rem' }}>Pengaturan Custom</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowCustom(false)}
            >
              Tutup
            </button>
          </div>

          <div className="settings-grid">
            <div className="field">
              <label htmlFor="cfg-focus">Fokus (menit)</label>
              <input
                id="cfg-focus"
                type="number"
                min={1}
                max={120}
                className="input"
                value={settings.focusMinutes}
                onChange={(e) =>
                  handleNumChange('focusMinutes', e.target.value, 1, 120)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cfg-short">Istirahat Pendek (m)</label>
              <input
                id="cfg-short"
                type="number"
                min={1}
                max={60}
                className="input"
                value={settings.shortBreakMinutes}
                onChange={(e) =>
                  handleNumChange('shortBreakMinutes', e.target.value, 1, 60)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cfg-long">Istirahat Panjang (m)</label>
              <input
                id="cfg-long"
                type="number"
                min={1}
                max={60}
                className="input"
                value={settings.longBreakMinutes}
                onChange={(e) =>
                  handleNumChange('longBreakMinutes', e.target.value, 1, 60)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cfg-interval">Interval Istirahat Pjg</label>
              <input
                id="cfg-interval"
                type="number"
                min={2}
                max={8}
                className="input"
                value={settings.longBreakInterval}
                onChange={(e) =>
                  handleNumChange('longBreakInterval', e.target.value, 2, 8)
                }
              />
            </div>
          </div>

          <label className="toggle-row">
            <span>Auto-mulai sesi istirahat</span>
            <input
              type="checkbox"
              checked={settings.autoStartBreak}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  autoStartBreak: e.target.checked,
                })
              }
            />
          </label>
          <label className="toggle-row">
            <span>Auto-mulai sesi fokus</span>
            <input
              type="checkbox"
              checked={settings.autoStartFocus}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  autoStartFocus: e.target.checked,
                })
              }
            />
          </label>
          <label className="toggle-row">
            <span>Bunyi bel saat selesai</span>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  soundEnabled: e.target.checked,
                })
              }
            />
          </label>
        </div>
      )}
    </section>
  );
}
