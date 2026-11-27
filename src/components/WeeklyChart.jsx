import React, { useEffect, useMemo, useRef } from 'react';
import Chart from 'chart.js/auto';
import { BarChart3 } from 'lucide-react';
import { buildWeeklyChartData, formatMinutesID } from '../utils/stats.js';

export function WeeklyChart({ focusLogs, theme }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const weekly = useMemo(() => buildWeeklyChartData(focusLogs), [focusLogs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const styles = getComputedStyle(document.documentElement);
    const accent =
      styles.getPropertyValue('--accent-focus').trim() || '#0F766E';
    const textMuted =
      styles.getPropertyValue('--text-muted').trim() || '#71717A';
    const gridColor =
      styles.getPropertyValue('--border-subtle').trim() || '#E4E4DC';
    const surfaceBg =
      styles.getPropertyValue('--bg-surface').trim() || '#FFFFFF';
    const textPrimary =
      styles.getPropertyValue('--text-primary').trim() || '#18181B';

    const isDark = theme === 'dark';
    const barColors = weekly.days.map((d) =>
      d.isToday
        ? accent
        : isDark
          ? 'rgba(20, 184, 166, 0.45)'
          : 'rgba(15, 118, 110, 0.42)'
    );

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weekly.days.map((d) =>
          d.isToday ? `${d.label} (Hari ini)` : d.label
        ),
        datasets: [
          {
            label: 'Jam Fokus',
            data: weekly.days.map((d) => d.hours),
            backgroundColor: barColors,
            hoverBackgroundColor: accent,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 320,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: surfaceBg,
            titleColor: textPrimary,
            bodyColor: textPrimary,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const d = weekly.days[idx];
                return `${d.label}, ${d.fullDate}`;
              },
              label: (item) => {
                const d = weekly.days[item.dataIndex];
                return `${formatMinutesID(d.minutes)} · ${d.sessions} sesi`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            border: {
              display: false,
            },
            ticks: {
              color: textMuted,
              font: {
                size: 11,
                weight: '500',
              },
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 2,
            border: {
              display: false,
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textMuted,
              font: {
                size: 11,
              },
              callback: (val) => `${val}j`,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [weekly, theme]);

  return (
    <section className="card" aria-label="Statistik Jam Fokus Mingguan">
      <div className="card-header">
        <h2 className="card-title">
          <BarChart3 size={17} style={{ color: 'var(--accent)' }} />
          <span>Statistik Jam Fokus Mingguan</span>
        </h2>
        <span className="card-subtitle">
          Total: <strong>{formatMinutesID(weekly.weeklyMinutes)}</strong> ·
          Rata-rata: {formatMinutesID(weekly.dailyAverageMinutes)}/hari
        </span>
      </div>

      <div className="chart-container">
        <canvas ref={canvasRef} aria-label="Grafik batang jam fokus 7 hari terakhir" />
      </div>
    </section>
  );
}
