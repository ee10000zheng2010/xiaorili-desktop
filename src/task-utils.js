const pad = (n) => String(n).padStart(2, "0");

export const key = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => key(new Date());

export const completionDate = (task) => {
  if (!task || !task.done) return null;
  const stamp = task.doneAt || task.updatedAt;
  if (stamp) {
    const d = new Date(stamp);
    if (!Number.isNaN(d.getTime())) return key(d);
  }
  return task.endDate || task.date || null;
};

export const effectiveEnd = (task, today = todayKey()) => {
  if (!task) return "";
  const base = task.endDate || task.date || "";
  if (!base || task.cancelled) return base;
  const end = task.done
    ? completionDate(task) || base
    : today > base
      ? today
      : base;
  return end > base ? end : base;
};

export const inRange = (task, day, today = todayKey()) => {
  if (!task || !task.date) return false;
  const end = effectiveEnd(task, today);
  return task.date <= day && end >= day;
};

export const overlaps = (task, start, end, today = todayKey()) => {
  if (!task || !task.date) return false;
  const taskEnd = effectiveEnd(task, today);
  return task.date <= end && taskEnd >= start;
};

export const carryoverDays = (task, day, today = todayKey()) => {
  if (!task || task.done || task.cancelled || !task.endDate || !day) return 0;
  if (day <= task.endDate) return 0;
  const from = new Date(`${task.endDate}T00:00:00`);
  const to = new Date(`${day}T00:00:00`);
  const days = Math.round((to - from) / 86400000);
  return days > 0 ? days : 0;
};
