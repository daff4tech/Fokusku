import React from 'react';
import { Headphones, Volume2, VolumeX } from 'lucide-react';
import { AMBIENT_CHANNELS } from '../utils/ambientEngine.js';

const SOUND_PRESETS = [
  {
    id: 'rain-lofi',
    label: 'Hujan & Lo-fi',
    channels: { rain: 0.55, lofi: 0.5, cafe: 0, whitenoise: 0 },
  },
  {
    id: 'cafe-rain',
    label: 'Kafe Hujan',
    channels: { cafe: 0.6, rain: 0.3, lofi: 0, whitenoise: 0 },
  },
  {
    id: 'deep-noise',
    label: 'Deep White Noise',
    channels: { whitenoise: 0.45, rain: 0.2, cafe: 0, lofi: 0 },
  },
];

export function AmbientMixer({
  mixerState,
  onToggleChannel,
  onChangeChannelVolume,
  onChangeMasterVolume,
  onToggleMute,
  onApplyPreset,
  onStopAll,
}) {
  const activeCount = Object.values(mixerState.channels).filter(
    (c) => c.active
  ).length;

  return (
    <section className="card" aria-label="Mixer Suara Ambient">
      <div className="card-header">
        <h2 className="card-title">
          <Headphones size={17} style={{ color: 'var(--accent)' }} />
          <span>Mixer Suara Ambient</span>
          {activeCount > 0 && !mixerState.muted && (
            <span className="eq-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="card-subtitle">
            {activeCount > 0 ? `${activeCount} aktif` : 'Web Audio Offline'}
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onStopAll}
            >
              Matikan
            </button>
          )}
        </div>
      </div>

      <div className="mixer-presets">
        {SOUND_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset-pill"
            onClick={() => onApplyPreset(preset.channels)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mixer-grid">
        {AMBIENT_CHANNELS.map((ch) => {
          const state = mixerState.channels[ch.id] || {
            active: false,
            volume: 0.5,
          };
          const pct = Math.round(state.volume * 100);

          return (
            <div
              key={ch.id}
              className={`channel-card ${state.active ? 'active' : ''}`}
            >
              <div className="channel-top">
                <div className="channel-info">
                  <span className="channel-emoji" aria-hidden="true">
                    {ch.emoji}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="channel-name">{ch.name}</div>
                    <div className="channel-desc">{ch.desc}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="channel-toggle"
                  onClick={() => onToggleChannel(ch.id)}
                  aria-pressed={state.active}
                >
                  {state.active ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) =>
                    onChangeChannelVolume(ch.id, Number(e.target.value) / 100)
                  }
                  className="range-slider"
                  aria-label={`Volume ${ch.name}`}
                />
                <span className="volume-pct">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="master-bar">
        <button
          type="button"
          className="icon-btn square"
          onClick={onToggleMute}
          aria-label={mixerState.muted ? 'Bunyikan master' : 'Bisukan master'}
          title={mixerState.muted ? 'Bunyikan' : 'Bisukan'}
        >
          {mixerState.muted || mixerState.masterVolume === 0 ? (
            <VolumeX size={15} />
          ) : (
            <Volume2 size={15} />
          )}
        </button>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Master
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(mixerState.masterVolume * 100)}
          onChange={(e) => onChangeMasterVolume(Number(e.target.value) / 100)}
          className="range-slider"
          aria-label="Volume Master"
        />
        <span className="volume-pct">
          {mixerState.muted ? '0%' : `${Math.round(mixerState.masterVolume * 100)}%`}
        </span>
      </div>
    </section>
  );
}
