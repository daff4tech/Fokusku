import React from 'react';
import {
  Minimize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sun,
} from 'lucide-react';
import { AMBIENT_CHANNELS } from '../utils/ambientEngine.js';
import { formatTimerMMSS } from './PomodoroTimer.jsx';

const MODE_LABELS = {
  focus: 'Sesi Fokus',
  shortBreak: 'Istirahat Pendek',
  longBreak: 'Istirahat Panjang',
};

export function ZenOverlay({
  mode,
  secondsLeft,
  isRunning,
  activeTask,
  mixerState,
  theme,
  onToggleRun,
  onReset,
  onSkip,
  onToggleChannel,
  onToggleTheme,
  onExitZen,
}) {
  return (
    <div className="zen-overlay" role="dialog" aria-label="Mode Fullscreen Zen">
      <div className="zen-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/icons/icon.svg"
            alt=""
            style={{ width: 28, height: 28, borderRadius: 8 }}
          />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            FokusKu · Mode Zen
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="icon-btn square"
            onClick={onToggleTheme}
            aria-label="Ubah tema"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onExitZen}
            title="Keluar dari Mode Zen (Esc)"
          >
            <Minimize2 size={14} />
            <span>Keluar Zen</span>
          </button>
        </div>
      </div>

      <div className="zen-center">
        <div className="timer-phase-label" style={{ fontSize: '0.9rem' }}>
          {MODE_LABELS[mode]}
        </div>

        <div className="zen-digits">{formatTimerMMSS(secondsLeft)}</div>

        <div className="zen-task">
          {activeTask
            ? `Sedang fokus: ${activeTask.title}`
            : 'Bernapas tenang, fokus satu hal pada satu waktu.'}
        </div>

        <div className="timer-controls" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="icon-btn square"
            onClick={onReset}
            aria-label="Reset timer"
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            className="btn btn-primary timer-main-btn"
            onClick={onToggleRun}
          >
            {isRunning ? <Pause size={19} /> : <Play size={19} />}
            <span>{isRunning ? 'Jeda' : 'Mulai'}</span>
          </button>
          <button
            type="button"
            className="icon-btn square"
            onClick={onSkip}
            aria-label="Lewati fase"
          >
            <SkipForward size={17} />
          </button>
        </div>
      </div>

      <div className="zen-bottom">
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Ambient:
        </span>
        {AMBIENT_CHANNELS.map((ch) => {
          const active = mixerState.channels[ch.id]?.active;
          return (
            <button
              key={ch.id}
              type="button"
              className={`preset-pill ${active ? 'active' : ''}`}
              onClick={() => onToggleChannel(ch.id)}
            >
              {ch.emoji} {ch.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
