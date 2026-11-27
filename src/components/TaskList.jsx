import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  ListTodo,
  Plus,
  Trash2,
} from 'lucide-react';

export function TaskList({
  tasks,
  activeTaskId,
  onSelectTask,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onReorderTasks,
  onClearCompleted,
}) {
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(2);
  const [filter, setFilter] = useState('all'); // all | active | done
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddTask(trimmed, estimate);
    setTitle('');
  };

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const fromIndex = tasks.findIndex((t) => t.id === sourceId);
    const toIndex = tasks.findIndex((t) => t.id === targetId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const next = [...tasks];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onReorderTasks(next);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const moveByOffset = (id, offset) => {
    const idx = tasks.findIndex((t) => t.id === id);
    const nextIdx = idx + offset;
    if (idx === -1 || nextIdx < 0 || nextIdx >= tasks.length) return;
    const next = [...tasks];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIdx, 0, moved);
    onReorderTasks(next);
  };

  const visibleTasks = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'done') return t.completed;
    return true;
  });

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <section className="card" aria-label="Daftar Task Harian">
      <div className="card-header">
        <h2 className="card-title">
          <ListTodo size={17} style={{ color: 'var(--accent)' }} />
          <span>Task Harian</span>
        </h2>
        <span className="card-subtitle">
          {completedCount}/{tasks.length} selesai · Seret untuk urutkan
        </span>
      </div>

      <form className="task-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="input"
          placeholder="Tambah task fokus baru..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          aria-label="Nama task baru"
        />
        <select
          className="input task-est-select"
          value={estimate}
          onChange={(e) => setEstimate(Number(e.target.value))}
          title="Estimasi sesi Pomodoro"
          aria-label="Estimasi sesi Pomodoro"
        >
          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
            <option key={n} value={n}>
              {n} sesi
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" aria-label="Tambah task">
          <Plus size={16} />
        </button>
      </form>

      <div className="task-filters">
        <div className="filter-pills">
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Semua ({tasks.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Aktif ({tasks.length - completedCount})
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Selesai ({completedCount})
          </button>
        </div>

        {completedCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClearCompleted}
          >
            Bersihkan selesai
          </button>
        )}
      </div>

      {visibleTasks.length === 0 ? (
        <div className="empty-state">
          {tasks.length === 0
            ? 'Belum ada task. Tambahkan target pertamamu di atas!'
            : 'Tidak ada task pada filter ini.'}
        </div>
      ) : (
        <ul className="task-list">
          {visibleTasks.map((task) => {
            const isActive = task.id === activeTaskId;
            const globalIdx = tasks.findIndex((t) => t.id === task.id);

            return (
              <li
                key={task.id}
                draggable={filter === 'all'}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDrop={(e) => handleDrop(e, task.id)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectTask(task.id)}
                className={[
                  'task-item',
                  task.completed ? 'completed' : '',
                  isActive ? 'active-task' : '',
                  draggedId === task.id ? 'dragging' : '',
                  dragOverId === task.id ? 'drag-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  className="drag-handle"
                  title="Seret untuk ubah prioritas"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical size={15} />
                </span>

                <button
                  type="button"
                  className={`task-check ${task.completed ? 'checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(task.id);
                  }}
                  aria-label={
                    task.completed
                      ? `Tandai ${task.title} belum selesai`
                      : `Tandai ${task.title} selesai`
                  }
                >
                  {task.completed && <Check size={12} strokeWidth={3} />}
                </button>

                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    {task.completedPomodoros}/{task.estimatedPomodoros} sesi
                    {isActive ? ' · Sedang dipilih' : ''}
                  </div>
                </div>

                <div
                  className="task-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="mini-icon-btn"
                    disabled={globalIdx === 0}
                    onClick={() => moveByOffset(task.id, -1)}
                    title="Geser ke atas"
                    aria-label="Geser ke atas"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="mini-icon-btn"
                    disabled={globalIdx === tasks.length - 1}
                    onClick={() => moveByOffset(task.id, 1)}
                    title="Geser ke bawah"
                    aria-label="Geser ke bawah"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="mini-icon-btn danger"
                    onClick={() => onDeleteTask(task.id)}
                    title="Hapus task"
                    aria-label="Hapus task"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
