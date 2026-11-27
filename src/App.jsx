import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header.jsx';
import { PomodoroTimer, formatTimerMMSS } from './components/PomodoroTimer.jsx';
import { TaskList } from './components/TaskList.jsx';
import { AmbientMixer } from './components/AmbientMixer.jsx';
import { HabitHeatmap } from './components/HabitHeatmap.jsx';
import { WeeklyChart } from './components/WeeklyChart.jsx';
import { ZenOverlay } from './components/ZenOverlay.jsx';
import { BackupModal } from './components/BackupModal.jsx';
import { ambientEngine } from './utils/ambientEngine.js';
import {
  DEFAULT_HABITS,
  DEFAULT_MIXER_STATE,
  DEFAULT_TASKS,
  DEFAULT_TIMER_SETTINGS,
  STORAGE_KEYS,
  TIMER_PRESETS,
  createDemoHistory,
  getDateKey,
  loadJSON,
  saveJSON,
} from './utils/storage.js';

function getPhaseMinutes(settings, mode) {
  if (mode === 'shortBreak') return settings.shortBreakMinutes || 5;
  if (mode === 'longBreak') return settings.longBreakMinutes || 15;
  return settings.focusMinutes || 25;
}

export default function App() {
  // Theme
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  // Persistent States
  const [timerSettings, setTimerSettings] = useState(() =>
    loadJSON(STORAGE_KEYS.TIMER_SETTINGS, DEFAULT_TIMER_SETTINGS)
  );
  const [tasks, setTasks] = useState(() =>
    loadJSON(STORAGE_KEYS.TASKS, DEFAULT_TASKS)
  );
  const [activeTaskId, setActiveTaskId] = useState(() =>
    loadJSON(STORAGE_KEYS.ACTIVE_TASK_ID, DEFAULT_TASKS[0]?.id || null)
  );
  const [habits, setHabits] = useState(() =>
    loadJSON(STORAGE_KEYS.HABITS, DEFAULT_HABITS)
  );
  const [habitLogs, setHabitLogs] = useState(() =>
    loadJSON(STORAGE_KEYS.HABIT_LOGS, {})
  );
  const [focusLogs, setFocusLogs] = useState(() =>
    loadJSON(STORAGE_KEYS.FOCUS_LOGS, {})
  );
  const [mixerState, setMixerState] = useState(() =>
    loadJSON(STORAGE_KEYS.MIXER_STATE, DEFAULT_MIXER_STATE)
  );

  // Timer Runtime State
  const [mode, setMode] = useState('focus'); // focus | shortBreak | longBreak
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCycles, setCompletedFocusCycles] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    () => getPhaseMinutes(loadJSON(STORAGE_KEYS.TIMER_SETTINGS, DEFAULT_TIMER_SETTINGS), 'focus') * 60
  );

  // UI & PWA State
  const [isZen, setIsZen] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] = useState(null);
  const [toast, setToast] = useState(null);

  const endTimestampRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3400);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D1015' : '#F6F6F3');
  }, [theme]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.TIMER_SETTINGS, timerSettings);
  }, [timerSettings]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.TASKS, tasks);
  }, [tasks]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.ACTIVE_TASK_ID, activeTaskId);
  }, [activeTaskId]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.HABITS, habits);
  }, [habits]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.HABIT_LOGS, habitLogs);
  }, [habitLogs]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.FOCUS_LOGS, focusLogs);
  }, [focusLogs]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.MIXER_STATE, mixerState);
  }, [mixerState]);

  // Mode accent CSS variables
  useEffect(() => {
    const root = document.documentElement.style;
    if (mode === 'shortBreak') {
      root.setProperty('--accent', 'var(--accent-short)');
      root.setProperty('--accent-soft', 'var(--accent-short-soft)');
    } else if (mode === 'longBreak') {
      root.setProperty('--accent', 'var(--accent-long)');
      root.setProperty('--accent-soft', 'var(--accent-long-soft)');
    } else {
      root.setProperty('--accent', 'var(--accent-focus)');
      root.setProperty('--accent-soft', 'var(--accent-focus-soft)');
    }
  }, [mode]);

  // Network & PWA Install Listeners
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  // Unlock saved active ambient channels on first user gesture
  useEffect(() => {
    const hasActive = Object.values(mixerState.channels).some((c) => c.active);
    if (!hasActive) return;

    const unlock = () => {
      ambientEngine.setMaster(mixerState.masterVolume, mixerState.muted);
      Object.entries(mixerState.channels).forEach(([id, cfg]) => {
        if (cfg.active) ambientEngine.syncChannel(id, true, cfg.volume);
      });
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // Run once on mount for persisted channels
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record completed focus minutes into today's log & active task
  const recordFocusSession = useCallback(
    (minutesLogged) => {
      const mins = Math.max(1, Math.round(minutesLogged));
      const todayKey = getDateKey(new Date());

      setFocusLogs((prev) => {
        const cur = prev[todayKey] || { minutes: 0, sessions: 0 };
        return {
          ...prev,
          [todayKey]: {
            minutes: cur.minutes + mins,
            sessions: cur.sessions + 1,
          },
        };
      });

      if (activeTaskId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeTaskId
              ? { ...t, completedPomodoros: t.completedPomodoros + 1 }
              : t
          )
        );
      }
    },
    [activeTaskId]
  );

  // Handle phase completion
  const finishCurrentPhase = useCallback(
    (completedNaturally = true, overrideMinutes = null) => {
      if (timerSettings.soundEnabled && completedNaturally) {
        ambientEngine.playCompletionChime(mode);
      }

      if (mode === 'focus') {
        const mins =
          overrideMinutes !== null
            ? overrideMinutes
            : getPhaseMinutes(timerSettings, 'focus');
        if (completedNaturally || overrideMinutes !== null) {
          recordFocusSession(mins);
        }

        const nextCycles = completedFocusCycles + 1;
        setCompletedFocusCycles(nextCycles);
        const interval = Math.max(2, timerSettings.longBreakInterval || 4);
        const nextMode = nextCycles % interval === 0 ? 'longBreak' : 'shortBreak';
        const nextSecs = getPhaseMinutes(timerSettings, nextMode) * 60;

        setMode(nextMode);
        setSecondsLeft(nextSecs);

        if (timerSettings.autoStartBreak && completedNaturally) {
          endTimestampRef.current = Date.now() + nextSecs * 1000;
          setIsRunning(true);
        } else {
          endTimestampRef.current = null;
          setIsRunning(false);
        }

        if (completedNaturally || overrideMinutes !== null) {
          showToast(`Sesi fokus selesai! +${mins} menit tercatat.`);
        }
      } else {
        const nextSecs = getPhaseMinutes(timerSettings, 'focus') * 60;
        setMode('focus');
        setSecondsLeft(nextSecs);

        if (timerSettings.autoStartFocus && completedNaturally) {
          endTimestampRef.current = Date.now() + nextSecs * 1000;
          setIsRunning(true);
        } else {
          endTimestampRef.current = null;
          setIsRunning(false);
        }

        if (completedNaturally) {
          showToast('Istirahat selesai — siap kembali fokus!');
        }
      }
    },
    [
      mode,
      timerSettings,
      completedFocusCycles,
      recordFocusSession,
      showToast,
    ]
  );

  // Drift-free timer tick
  useEffect(() => {
    if (!isRunning) {
      document.title = 'FokusKu — Workspace Fokus Minimalis';
      return;
    }

    if (!endTimestampRef.current) {
      endTimestampRef.current = Date.now() + secondsLeft * 1000;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endTimestampRef.current - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      document.title = `${formatTimerMMSS(remaining)} · FokusKu`;

      if (remaining <= 0) {
        endTimestampRef.current = null;
        finishCurrentPhase(true);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isRunning, finishCurrentPhase, secondsLeft]);

  // Zen mode Fullscreen API sync
  const enterZen = useCallback(() => {
    setIsZen(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const exitZen = useCallback(() => {
    setIsZen(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isZen) {
        // Keep Zen overlay usable even if native fullscreen was exited via browser ESC,
        // or close cleanly if user pressed ESC.
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isZen]);

  // Timer actions
  const handleToggleRun = useCallback(() => {
    ambientEngine.ensureContext();
    if (isRunning) {
      endTimestampRef.current = null;
      setIsRunning(false);
    } else {
      endTimestampRef.current = Date.now() + secondsLeft * 1000;
      setIsRunning(true);
    }
  }, [isRunning, secondsLeft]);

  const handleReset = useCallback(() => {
    endTimestampRef.current = null;
    setIsRunning(false);
    setSecondsLeft(getPhaseMinutes(timerSettings, mode) * 60);
  }, [timerSettings, mode]);

  const handleSwitchMode = useCallback(
    (nextMode) => {
      endTimestampRef.current = null;
      setIsRunning(false);
      setMode(nextMode);
      setSecondsLeft(getPhaseMinutes(timerSettings, nextMode) * 60);
    },
    [timerSettings]
  );

  const handleSelectPreset = useCallback(
    (presetKey) => {
      const preset = TIMER_PRESETS[presetKey];
      const nextSettings = preset
        ? {
            ...timerSettings,
            preset: presetKey,
            focusMinutes: preset.focusMinutes,
            shortBreakMinutes: preset.shortBreakMinutes,
            longBreakMinutes: preset.longBreakMinutes,
          }
        : { ...timerSettings, preset: 'custom' };

      setTimerSettings(nextSettings);
      if (!isRunning) {
        setSecondsLeft(getPhaseMinutes(nextSettings, mode) * 60);
      }
    },
    [timerSettings, isRunning, mode]
  );

  const handleUpdateSettings = useCallback(
    (nextSettings) => {
      setTimerSettings(nextSettings);
      if (!isRunning) {
        setSecondsLeft(getPhaseMinutes(nextSettings, mode) * 60);
      }
    },
    [isRunning, mode]
  );

  const handleCompleteEarly = useCallback(() => {
    const total = getPhaseMinutes(timerSettings, mode) * 60;
    const elapsedMins = Math.max(1, Math.round((total - secondsLeft) / 60));
    endTimestampRef.current = null;
    finishCurrentPhase(false, elapsedMins);
  }, [timerSettings, mode, secondsLeft, finishCurrentPhase]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleRun();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 'z' || e.key === 'Z') {
        if (isZen) exitZen();
        else enterZen();
      } else if (e.key === 'Escape' && isZen) {
        exitZen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleRun, handleReset, isZen, enterZen, exitZen]);

  // Task handlers
  const handleAddTask = (title, estimatedPomodoros) => {
    const newTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      completed: false,
      estimatedPomodoros,
      completedPomodoros: 0,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
    if (!activeTaskId) setActiveTaskId(newTask.id);
  };

  const handleToggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  // Ambient mixer handlers
  const handleToggleChannel = (id) => {
    setMixerState((prev) => {
      const cur = prev.channels[id] || { active: false, volume: 0.5 };
      const nextActive = !cur.active;
      ambientEngine.setMaster(prev.masterVolume, prev.muted);
      ambientEngine.syncChannel(id, nextActive, cur.volume);
      return {
        ...prev,
        channels: {
          ...prev.channels,
          [id]: { ...cur, active: nextActive },
        },
      };
    });
  };

  const handleChangeChannelVolume = (id, volume) => {
    setMixerState((prev) => {
      const cur = prev.channels[id] || { active: false, volume: 0.5 };
      const shouldActivate = volume > 0 ? cur.active : false;
      ambientEngine.setMaster(prev.masterVolume, prev.muted);
      ambientEngine.syncChannel(id, shouldActivate, volume);
      return {
        ...prev,
        channels: {
          ...prev.channels,
          [id]: { active: shouldActivate, volume },
        },
      };
    });
  };

  const handleChangeMasterVolume = (masterVolume) => {
    setMixerState((prev) => {
      ambientEngine.setMaster(masterVolume, prev.muted);
      return { ...prev, masterVolume };
    });
  };

  const handleToggleMute = () => {
    setMixerState((prev) => {
      const nextMuted = !prev.muted;
      ambientEngine.setMaster(prev.masterVolume, nextMuted);
      return { ...prev, muted: nextMuted };
    });
  };

  const handleApplySoundPreset = (presetChannels) => {
    setMixerState((prev) => {
      ambientEngine.setMaster(prev.masterVolume, false);
      const nextChannels = { ...prev.channels };
      Object.entries(presetChannels).forEach(([id, vol]) => {
        const active = vol > 0;
        const nextVol = active ? vol : nextChannels[id]?.volume || 0.5;
        nextChannels[id] = { active, volume: nextVol };
        ambientEngine.syncChannel(id, active, nextVol);
      });
      return { ...prev, muted: false, channels: nextChannels };
    });
  };

  const handleStopAllAmbient = () => {
    ambientEngine.stopAll();
    setMixerState((prev) => {
      const nextChannels = {};
      Object.entries(prev.channels).forEach(([id, cfg]) => {
        nextChannels[id] = { ...cfg, active: false };
      });
      return { ...prev, channels: nextChannels };
    });
  };

  // Habit handlers
  const handleToggleHabitToday = (habitId) => {
    const todayKey = getDateKey(new Date());
    setHabitLogs((prev) => {
      const cur = Array.isArray(prev[todayKey]) ? prev[todayKey] : [];
      const exists = cur.includes(habitId);
      const next = exists
        ? cur.filter((id) => id !== habitId)
        : [...cur, habitId];
      return { ...prev, [todayKey]: next };
    });
  };

  const handleAddHabit = (name) => {
    const icons = ['✨', '📖', '🧠', '💧', '🏃', '🌿'];
    const icon = icons[habits.length % icons.length];
    setHabits((prev) => [
      ...prev,
      { id: `habit-${Date.now()}`, name, icon },
    ]);
  };

  const handleDeleteHabit = (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  // Demo & Backup handlers
  const handleLoadDemo = () => {
    const demo = createDemoHistory(habits);
    setFocusLogs(demo.focusLogs);
    setHabitLogs(demo.habitLogs);
    showToast('Data demo 24 minggu dimuat!');
  };

  const handleClearHistory = () => {
    setFocusLogs({});
    setHabitLogs({});
    showToast('Riwayat fokus & habit dibersihkan.');
  };

  const handleImportData = (data) => {
    if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme);
    if (data.timerSettings) setTimerSettings(data.timerSettings);
    if (Array.isArray(data.tasks)) setTasks(data.tasks);
    if (data.activeTaskId !== undefined) setActiveTaskId(data.activeTaskId);
    if (Array.isArray(data.habits)) setHabits(data.habits);
    if (data.habitLogs) setHabitLogs(data.habitLogs);
    if (data.focusLogs) setFocusLogs(data.focusLogs);
    if (data.mixerState) setMixerState(data.mixerState);
    showToast('Backup JSON berhasil diimpor!');
  };

  const handleInstallPWA = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res?.outcome === 'accepted') {
      setInstallPrompt(null);
      showToast('FokusKu berhasil dipasang!');
    }
  };

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) || null,
    [tasks, activeTaskId]
  );

  const totalPhaseSeconds = getPhaseMinutes(timerSettings, mode) * 60;

  return (
    <div className="app-shell">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onEnterZen={enterZen}
        isOnline={isOnline}
        canInstall={Boolean(installPrompt)}
        onInstall={handleInstallPWA}
        onOpenBackup={() => setShowBackup(true)}
      />

      <main className="workspace-grid">
        <div className="column-stack">
          <PomodoroTimer
            mode={mode}
            secondsLeft={secondsLeft}
            totalSeconds={totalPhaseSeconds}
            isRunning={isRunning}
            completedFocusCycles={completedFocusCycles}
            settings={timerSettings}
            activeTask={activeTask}
            onSwitchMode={handleSwitchMode}
            onSelectPreset={handleSelectPreset}
            onUpdateSettings={handleUpdateSettings}
            onToggleRun={handleToggleRun}
            onReset={handleReset}
            onSkip={() => finishCurrentPhase(false)}
            onCompleteEarly={handleCompleteEarly}
          />

          <TaskList
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSelectTask={setActiveTaskId}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onReorderTasks={setTasks}
            onClearCompleted={handleClearCompleted}
          />
        </div>

        <div className="column-stack">
          <AmbientMixer
            mixerState={mixerState}
            onToggleChannel={handleToggleChannel}
            onChangeChannelVolume={handleChangeChannelVolume}
            onChangeMasterVolume={handleChangeMasterVolume}
            onToggleMute={handleToggleMute}
            onApplyPreset={handleApplySoundPreset}
            onStopAll={handleStopAllAmbient}
          />

          <div className="stats-row">
            <HabitHeatmap
              habits={habits}
              habitLogs={habitLogs}
              focusLogs={focusLogs}
              onToggleHabitToday={handleToggleHabitToday}
              onAddHabit={handleAddHabit}
              onDeleteHabit={handleDeleteHabit}
              onLoadDemo={handleLoadDemo}
            />

            <WeeklyChart focusLogs={focusLogs} theme={theme} />
          </div>
        </div>
      </main>

      {isZen && (
        <ZenOverlay
          mode={mode}
          secondsLeft={secondsLeft}
          isRunning={isRunning}
          activeTask={activeTask}
          mixerState={mixerState}
          theme={theme}
          onToggleRun={handleToggleRun}
          onReset={handleReset}
          onSkip={() => finishCurrentPhase(false)}
          onToggleChannel={handleToggleChannel}
          onToggleTheme={() =>
            setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
          }
          onExitZen={exitZen}
        />
      )}

      {showBackup && (
        <BackupModal
          onClose={() => setShowBackup(false)}
          onImportData={handleImportData}
          onLoadDemo={handleLoadDemo}
          onClearHistory={handleClearHistory}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
