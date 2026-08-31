import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Download,
  ImagePlus,
  Inbox,
  ListChecks,
  LogOut,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import "./mobile.css";
import { inRange } from "./task-utils.js";

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const key = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const defaultTags = ["工作", "个人", "重要"];
const initial = [
  {
    id: 1,
    title: "整理本周项目资料",
    date: key(now),
    endDate: key(now),
    time: "10:00",
    tag: defaultTags[0],
    remind: true,
    repeat: "none",
    done: false,
  },
];
const weekNames = ["日", "一", "二", "三", "四", "五", "六"];
const read = (name, fallback) => {
  try {
    const value = localStorage.getItem(name);
    return value ? JSON.parse(value) : fallback;
  } catch {
    localStorage.removeItem(name);
    return fallback;
  }
};
const mergeTasks = (local = [], remote = []) => {
  const merged = new Map(remote.map((item) => [item.id, item]));
  local.forEach((item) => {
    const old = merged.get(item.id);
    if (!old || (item.updatedAt || 0) >= (old.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });
  return [...merged.values()];
};
const syncSnapshot = (tasks, tags, theme, background) => ({
  protocolVersion: 1,
  tasks,
  tags,
  theme,
  background,
});
const defaultForm = (date = key(now), tag = defaultTags[0]) => ({
  title: "",
  date,
  endDate: date,
  time: "09:00",
  tag,
  remind: true,
  repeat: "none",
});
const sortByTime = (list) =>
  [...list].sort((a, b) =>
    (a.time || "99:99").localeCompare(b.time || "99:99"),
  );

export default function MobileApp() {
  const [tab, setTab] = useState("today");
  const [tasks, setTasksState] = useState(() => read("workday-tasks", initial));
  const [tags, setTags] = useState(() => read("workday-tags", defaultTags));
  const [theme, setTheme] = useState(
    () => localStorage.getItem("workday-theme") || "sage",
  );
  const [background, setBackground] = useState(
    () => localStorage.getItem("workday-bg") || "",
  );
  const [account, setAccount] = useState(() => read("workday-account", null));
  const [selected, setSelected] = useState(key(now));
  const [cursor, setCursor] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [rangeView, setRangeView] = useState("month");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => defaultForm());
  const [newTag, setNewTag] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [syncStatus, setSyncStatus] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authChannel, setAuthChannel] = useState("email");
  const [authPhone, setAuthPhone] = useState("");
  const [authSmsCode, setAuthSmsCode] = useState("");
  const [smsNotice, setSmsNotice] = useState("");
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [resetCode, setResetCode] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [photo, setPhoto] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [draft, setDraft] = useState({ title: "", date: key(now), time: "09:00" });
  const [notice, setNotice] = useState("");
  const [serverUrl, setServerUrl] = useState(() =>
    (localStorage.getItem("workday-sync-server") ||
      import.meta.env.VITE_SYNC_API ||
      "http://localhost:8787").replace(/\/+$/, ""),
  );
  const [serverDraft, setServerDraft] = useState(serverUrl);
  const syncApi = () => serverUrl;

  const testServer = async () => {
    const api = serverDraft.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(api)) {
      setSyncStatus("请输入以 http:// 或 https:// 开头的地址");
      return;
    }
    setSyncStatus("正在连接同步服务...");
    try {
      const response = await fetch(`${api}/app/version`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const info = await response.json();
      setSyncStatus(`连接成功：${info.version} · 协议 ${info.protocolVersion}`);
    } catch (error) {
      setSyncStatus(error.message || "连接失败");
    }
  };

  const saveServer = () => {
    const next = serverDraft.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(next)) {
      setSyncStatus("请输入以 http:// 或 https:// 开头的地址");
      return;
    }
    setServerUrl(next);
    localStorage.setItem("workday-sync-server", next);
    setSyncStatus("同步服务器地址已保存");
  };

  useEffect(() => {
    fetch(`${syncApi()}/app/version`)
      .then((response) => (response.ok ? response.json() : null))
      .then((info) => {
        if (info) {
          setSyncStatus(`同步服务 ${info.version} · 协议 ${info.protocolVersion}`);
        }
      })
      .catch(() => setSyncStatus("离线模式：同步服务暂不可用"));
  }, [serverUrl]);
  useEffect(() => {
    if (smsCountdown <= 0) return undefined;
    const timer = window.setTimeout(() => setSmsCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [smsCountdown]);

  useEffect(() => {
    if (!location.search.includes("shared=1")) return;
    fetch("./__shared-image")
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          setPhoto({ dataUrl: reader.result });
          setNotice("已接收系统分享的图片，可识别或直接填写日程");
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  const applySnapshot = (snapshot) => {
    if (!snapshot) return;
    if (snapshot.tasks) {
      setTasksState(snapshot.tasks);
      localStorage.setItem("workday-tasks", JSON.stringify(snapshot.tasks));
    }
    if (snapshot.tags) {
      setTags(snapshot.tags);
      localStorage.setItem("workday-tags", JSON.stringify(snapshot.tags));
    }
    if (snapshot.theme) {
      setTheme(snapshot.theme);
      localStorage.setItem("workday-theme", snapshot.theme);
    }
    if (snapshot.background !== undefined) {
      setBackground(snapshot.background || "");
      localStorage.setItem("workday-bg", snapshot.background || "");
    }
  };

  const syncNow = async () => {
    if (!account?.token || syncing) return;
    setSyncing(true);
    setSyncStatus("正在同步...");
    try {
      const response = await fetch(`${syncApi()}/sync`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.token}`,
        },
        body: JSON.stringify(syncSnapshot(tasks, tags, theme, background)),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "同步失败");
      applySnapshot(data.data);
      setSyncStatus(`已同步 ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setSyncStatus(error.message || "同步服务暂不可用");
    } finally {
      setSyncing(false);
    }
  };

  const saveTasks = (next) => {
    const stamped = next.map((item) => ({ ...item, updatedAt: Date.now() }));
    setTasksState(stamped);
    localStorage.setItem("workday-tasks", JSON.stringify(stamped));
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    if (!account?.token || revision === 0) return undefined;
    const timer = window.setTimeout(() => syncNow(), 900);
    return () => window.clearTimeout(timer);
  }, [revision, account?.token]);
  const sendSmsCode = async () => {
    const api = syncApi();
    setSmsNotice("正在发送验证码...");
    try {
      const response = await fetch(`${api}/auth/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: authPhone.trim(), mode: authMode === "register" ? "register" : "login" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "验证码发送失败");
      setSmsNotice(data.devCode ? `${data.message}：验证码 ${data.devCode}` : data.message);
      setSmsCountdown(60);
    } catch (error) {
      setSmsNotice(error.message || "验证码服务暂不可用");
    }
  };

  const authenticate = async (event) => {
    event.preventDefault();
    const api = syncApi();
    setSyncStatus("正在连接同步服务...");
    try {
      const isSms = authChannel === "sms";
      const response = await fetch(`${api}${isSms ? "/auth/sms/verify" : `/auth/${authMode}`}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSms ? { phone: authPhone.trim(), code: authSmsCode.trim(), mode: authMode === "register" ? "register" : "login" } : { email: authEmail.trim(), password: authPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "账户操作失败");
      const next = isSms ? { loginType: "sms", phone: authPhone.trim(), token: data.token } : { loginType: "email", email: authEmail.trim(), token: data.token };
      setAccount(next);
      localStorage.setItem("workday-account", JSON.stringify(next));
      setAuthPassword(""); setAuthSmsCode("");
      setSyncStatus("登录成功，正在读取云端数据...");
      const cloudResponse = await fetch(`${api}/sync`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const cloud = await cloudResponse.json();
      if (!cloudResponse.ok) throw new Error(cloud.message || "读取云端数据失败");
      if (cloud.data) {
        const merged = {
          ...cloud.data,
          tasks: mergeTasks(tasks, cloud.data.tasks),
        };
        applySnapshot(merged);
        await fetch(`${api}/sync`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify(merged),
        });
      } else {
        await fetch(`${api}/sync`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify(syncSnapshot(tasks, tags, theme, background)),
        });
      }
      setSyncStatus("已同步");
    } catch (error) {
      setSyncStatus(error.message || "同步服务暂不可用");
    }
  };

  const logout = () => {
    setAccount(null);
    localStorage.removeItem("workday-account");
    setSyncStatus("已退出当前账户");
  };

  const openNew = (date) => {
    setEditing(null);
    setForm(defaultForm(date || selected, tags[0]));
    setModal(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title,
      date: task.date,
      endDate: task.endDate || task.date,
      time: task.time,
      tag: task.tag,
      remind: task.remind !== false,
      repeat: task.repeat || "none",
    });
    setModal(true);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const item = {
      ...form,
      id: editing?.id || Date.now(),
      done: editing?.done || false,
      doneAt: editing?.done ? editing?.doneAt || Date.now() : undefined,
    };
    saveTasks(
      editing
        ? tasks.map((task) => (task.id === editing.id ? item : task))
        : [...tasks, item],
    );
    setModal(false);
    setEditing(null);
  };

  const remove = () => {
    if (editing) saveTasks(tasks.filter((task) => task.id !== editing.id));
    setModal(false);
    setEditing(null);
  };

  const cancel = () => {
    if (editing) {
      saveTasks(
        tasks.map((task) =>
          task.id === editing.id ? { ...task, cancelled: true } : task,
        ),
      );
    }
    setModal(false);
    setEditing(null);
  };

  const toggle = (id) =>
    saveTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done, doneAt: !task.done ? Date.now() : undefined } : task,
      ),
    );

  const addTag = () => {
    const value = newTag.trim();
    if (value && !tags.includes(value)) {
      setTags([...tags, value]);
      setForm({ ...form, tag: value });
      setNewTag("");
    }
  };

  const removeTag = (value) => {
    if (tags.length > 1) {
      const next = tags.filter((tag) => tag !== value);
      setTags(next);
      if (form.tag === value) setForm({ ...form, tag: next[0] });
    }
  };

  const exportData = () => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(
      new Blob([JSON.stringify({ tasks, tags, background }, null, 2)], {
        type: "application/json",
      }),
    );
    anchor.download = `xiaorili-${key(now)}.json`;
    anchor.click();
  };

  const importData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.tasks)) saveTasks(data.tasks);
        if (Array.isArray(data.tags)) setTags(data.tags);
        if (data.background) setBackground(data.background);
      } catch {
        setNotice("备份文件无法读取");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto({ dataUrl: reader.result, name: file.name });
      setOcrText("");
      setDraft({ title: "", date: key(now), time: "09:00" });
      setNotice("已选择图片，可识别文字或直接填写日程");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const recognizePhoto = async () => {
    if (!photo || ocrLoading) return;
    setOcrLoading(true);
    setNotice("正在加载本地 OCR 识别...");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim+eng");
      const result = await worker.recognize(photo.dataUrl);
      const text = result.data.text.trim();
      const dateMatch = text.match(/(20\d{2})[年\\/-](\d{1,2})[月\\/-](\d{1,2})/);
      const timeMatch = text.match(/\b([01]?\d|2[0-3])[:：]([0-5]\d)\b/);
      setOcrText(text);
      setDraft((current) => ({
        ...current,
        title:
          text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) || current.title,
        date: dateMatch
          ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(
              dateMatch[3],
            ).padStart(2, "0")}`
          : current.date,
        time: timeMatch
          ? `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}`
          : current.time,
      }));
      await worker.terminate();
      setNotice(text ? "识别完成，请检查并确认内容" : "未识别到文字，请手动填写");
    } catch (error) {
      setNotice(`OCR 识别失败：${error.message || "未知错误"}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const addPhotoTask = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    saveTasks([
      ...tasks,
      {
        id: Date.now(),
        title: draft.title.trim(),
        date: draft.date,
        endDate: draft.date,
        time: draft.time,
        tag: tags[0],
        remind: true,
        repeat: "none",
        done: false,
        source: "mobile-photo",
      },
    ]);
    setPhoto(null);
    setOcrText("");
    setDraft({ title: "", date: key(now), time: "09:00" });
    setNotice("图片日程已加入日历");
  };

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const base = new Date(`${selected}T00:00:00`);
    base.setDate(base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      return day;
    });
  }, [selected]);

  const displayDays =
    rangeView === "week" ? weekDays : rangeView === "day" ? [new Date(`${selected}T00:00:00`)] : monthDays;
  const selectedTasks = sortByTime(
    tasks.filter((task) => !task.cancelled && inRange(task, selected)),
  );
  const todayTasks = sortByTime(
    tasks.filter((task) => !task.cancelled && inRange(task, key(now))),
  );
  const openCount = tasks.filter((task) => !task.done && !task.cancelled).length;
  const doneCount = tasks.filter((task) => task.done).length;
  const remindCount = tasks.filter(
    (task) => task.remind && !task.done && !task.cancelled,
  ).length;
  const visibleTasks = tasks.filter((task) => {
    const matchesQuery =
      !query.trim() ||
      `${task.title} ${task.tag}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "done" ? task.done : !task.done && !task.cancelled);
    return matchesQuery && matchesFilter;
  });

  const moveMonth = (amount) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  const goToday = () => {
    setSelected(key(now));
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };
  const selectDate = (day) => {
    setSelected(key(day));
    setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
  };
  const syncDot = syncing ? "busy" : account ? "on" : "";

  const TaskRow = ({ task }) => (
    <div
      className={`mobile-task ${task.done ? "is-done" : ""} ${task.cancelled ? "is-cancelled" : ""}`}
      onClick={() => openEdit(task)}
    >
      <button
        className={`mobile-check ${task.done ? "is-done" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          toggle(task.id);
        }}
        aria-label={task.done ? "标记未完成" : "标记完成"}
      >
        {task.done && <Check size={13} />}
      </button>
      <div className="mobile-task-body">
        <strong>{task.title}</strong>
        <span>
          {task.date}
          {task.endDate && task.endDate !== task.date ? ` ~ ${task.endDate}` : ""}{" "}
          · {task.time || "全天"} · {task.tag}
        </span>
      </div>
      {task.remind && <Bell size={14} className="mobile-remind-icon" />}
    </div>
  );

  const EmptyState = ({ title, hint }) => (
    <div className="mobile-empty">
      <Inbox size={34} strokeWidth={1.6} />
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  );

  return (
    <div className={`mobile-app theme-${theme}`}>
      <header className="mobile-header">
        <div className="mobile-brand">
          <span className="mobile-mark">
            <CalendarDays size={19} />
          </span>
          <div>
            <strong>小日历</strong>
            <small>
              {weekNames[now.getDay()]} · {now.getMonth() + 1}月{now.getDate()}日
            </small>
          </div>
        </div>
        <div className="mobile-sync">
          <i className={syncDot} />
          <span>{syncStatus || (account ? "已连接" : "本地模式")}</span>
        </div>
      </header>

      <main className="mobile-main">
        {tab === "today" && (
          <section className="mobile-view">
            <div className="mobile-greeting">
              <span>今日待办</span>
              <h2>{todayTasks.length ? `${todayTasks.length} 项安排` : "今天没有安排"}</h2>
            </div>
            <div className="mobile-stats">
              <div>
                <strong>{openCount}</strong>
                <span>未完成</span>
              </div>
              <div>
                <strong>{doneCount}</strong>
                <span>已完成</span>
              </div>
              <div>
                <strong>{remindCount}</strong>
                <span>待提醒</span>
              </div>
            </div>
            {todayTasks.length ? (
              <div className="mobile-list">
                {todayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <EmptyState title="今天没有待办" hint="点击右下角加号新建，或从设置导入图片日程" />
            )}
            <div className="mobile-tip">
              <ListChecks size={15} />
              <span>未完成事项会顺延到次日，完成后以灰色保留显示</span>
            </div>
          </section>
        )}

        {tab === "calendar" && (
          <section className="mobile-view">
            <div className="mobile-calendar-head">
              <button onClick={() => moveMonth(-1)} aria-label="上一个月">
                <ChevronLeft size={18} />
              </button>
              <strong>
                {cursor.getFullYear()}年{cursor.getMonth() + 1}月
              </strong>
              <button onClick={() => moveMonth(1)} aria-label="下一个月">
                <ChevronRight size={18} />
              </button>
              <button className="mobile-today-btn" onClick={goToday}>
                今天
              </button>
            </div>
            <div className="mobile-range-tabs">
              {[
                ["month", "月"],
                ["week", "周"],
                ["day", "日"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={rangeView === value ? "active" : ""}
                  onClick={() => setRangeView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {rangeView === "month" && (
              <>
                <div className="mobile-weekdays">
                  {weekNames.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <div className="mobile-month-grid">
                  {monthDays.map((day) => {
                    const dayKey = key(day);
                    const count = tasks.filter(
                      (task) =>
                        !task.cancelled &&
                        inRange(task, dayKey),
                    ).length;
                    return (
                      <button
                        key={dayKey}
                        className={`mobile-day ${day.getMonth() !== cursor.getMonth() ? "muted" : ""} ${dayKey === selected ? "selected" : ""} ${dayKey === key(now) ? "today" : ""}`}
                        onClick={() => selectDate(day)}
                      >
                        <b>{day.getDate()}</b>
                        {count > 0 && <i>{count}</i>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {rangeView === "week" && (
              <div className="mobile-week-grid">
                {weekDays.map((day) => {
                  const dayKey = key(day);
                  const items = tasks.filter(
                  (task) =>
                    !task.cancelled &&
                    inRange(task, dayKey),
                  );
                  return (
                    <div
                      key={dayKey}
                      className={`mobile-week-col ${dayKey === selected ? "selected" : ""}`}
                      onClick={() => selectDate(day)}
                    >
                      <small>{weekNames[day.getDay()]}</small>
                      <b>{day.getMonth() + 1}/{day.getDate()}</b>
                      {items.length ? (
                        items.slice(0, 3).map((task) => (
                          <button key={task.id} className={task.done ? "is-done" : ""} onClick={(event) => { event.stopPropagation(); openEdit(task); }}>
                            {task.title}
                          </button>
                        ))
                      ) : (
                        <em>无安排</em>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {rangeView === "day" && (
              <div className="mobile-day-timeline">
                {selectedTasks.length ? (
                  selectedTasks.map((task) => (
                    <div className={`mobile-timeline-row ${task.done ? "is-done" : ""}`} key={task.id} onClick={() => openEdit(task)}>
                      <time>{task.time || "全天"}</time>
                      <span>
                        <b>{task.title}</b>
                        <small>{task.tag} · {task.remind ? "已设置提醒" : "无提醒"}</small>
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyState title="这一天没有安排" hint="点击日期右侧加号可快速新建" />
                )}
              </div>
            )}
            <div className="mobile-day-panel">
              <div className="mobile-day-panel-head">
                <h3>{selected === key(now) ? "今天" : selected}</h3>
                <span>{selectedTasks.length} 项</span>
              </div>
              {selectedTasks.length ? (
                <div className="mobile-list">
                  {selectedTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <EmptyState title="暂无安排" hint="点右下角加号添加" />
              )}
            </div>
          </section>
        )}

        {tab === "tasks" && (
          <section className="mobile-view">
            <div className="mobile-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索待办和标签"
              />
            </div>
            <div className="mobile-filter">
              {[
                ["open", "未完成"],
                ["all", "全部"],
                ["done", "已完成"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {visibleTasks.length ? (
              <div className="mobile-list">
                {visibleTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <EmptyState title="没有匹配的待办" hint="换个关键词，或新建一条待办" />
            )}
          </section>
        )}

        {tab === "settings" && (
          <section className="mobile-view mobile-settings">
            <div className="mobile-section">
              <h2>账户与同步</h2>
              <div className="mobile-account-panel">
                {account ? (
                  <>
                    <div className="mobile-account-head">
                      <span className="mobile-account-avatar">
                        <UserRound size={18} />
                      </span>
                      <div>
                        <strong>{account.email || account.phone}</strong>
                        <small>同一账号登录后与电脑端同步</small>
                      </div>
                    </div>
                    <div className="mobile-actions">
                      <button className="mobile-btn primary" onClick={syncNow}>
                        <Cloud size={16} />
                        {syncing ? "正在同步..." : "立即同步"}
                      </button>
                      <button className="mobile-btn ghost" onClick={logout}>
                        <LogOut size={16} />
                        退出账户
                      </button>
                    </div>
                  </>
                ) : (
                  <form
                    className="mobile-account-form"
                    onSubmit={authMode === "forgot" ? undefined : authenticate}
                  >
                    <div className="mobile-segmented">
                      <button type="button" className={authChannel === "email" ? "active" : ""} onClick={() => setAuthChannel("email")}>邮箱密码</button>
                      <button type="button" className={authChannel === "sms" ? "active" : ""} onClick={() => { setAuthChannel("sms"); setAuthMode("login"); }}>手机验证码</button>
                    </div>
                    <div className="mobile-segmented">
                      <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>登录</button>
                      <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>注册</button>
                    </div>
                    {authChannel === "email" ? (
                      <>
                        <label className="mobile-field">
                          邮箱
                          <input type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                        </label>
                        <label className="mobile-field">
                          密码（至少 6 位）
                          <input type="password" required minLength="6" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="mobile-field">
                          手机号
                          <input type="tel" inputMode="tel" required value={authPhone} onChange={(event) => setAuthPhone(event.target.value)} />
                        </label>
                        <div className="mobile-sms-row">
                          <label className="mobile-field">
                            验证码
                            <input type="text" inputMode="numeric" maxLength="6" required value={authSmsCode} onChange={(event) => setAuthSmsCode(event.target.value)} />
                          </label>
                          <button type="button" className="mobile-btn quiet" disabled={smsCountdown > 0} onClick={sendSmsCode}>{smsCountdown > 0 ? `${smsCountdown}s` : "获取验证码"}</button>
                        </div>
                        {smsNotice && <span className="mobile-notice">{smsNotice}</span>}
                      </>
                    )}
                    <button className="mobile-btn primary" type="submit">
                      <Cloud size={16} />
                      {authMode === "login" ? "登录并同步" : "创建账户"}
                    </button>
                    {resetNotice && <span className="mobile-notice">{resetNotice}</span>}
                  </form>
                )}
                <p className="mobile-notice">{syncStatus}</p>
              </div>
            </div>

            <div className="mobile-section">
              <h2>同步服务器</h2>
              <div className="mobile-account-panel">
                <label className="mobile-field">
                  服务器地址
                  <input
                    type="url"
                    inputMode="url"
                    value={serverDraft}
                    onChange={(event) => setServerDraft(event.target.value)}
                    placeholder="http://192.168.1.8:8787"
                  />
                </label>
                <div className="mobile-actions">
                  <button className="mobile-btn primary" onClick={saveServer}>
                    <Save size={16} />
                    保存地址
                  </button>
                  <button className="mobile-btn quiet" onClick={testServer}>
                    <Server size={16} />
                    测试连接
                  </button>
                </div>
                <p className="mobile-notice">{syncStatus}</p>
              </div>
            </div>

            <div className="mobile-section">
              <h2>偏好设置</h2>
              <div className="mobile-account-panel">
                <div className="mobile-row">
                  <span>
                    界面主题
                    <small>手机端跟随桌面主题</small>
                  </span>
                  <select
                    value={theme}
                    onChange={(event) => {
                      setTheme(event.target.value);
                      localStorage.setItem("workday-theme", event.target.value);
                    }}
                  >
                    <option value="sage">鼠尾草</option>
                    <option value="lavender">薰衣草</option>
                    <option value="sky">晴空</option>
                  </select>
                </div>
                <div className="mobile-row">
                  <span>
                    数据备份
                    <small>导出 JSON 文件保存到手机</small>
                  </span>
                </div>
                <div className="mobile-actions">
                  <button className="mobile-btn quiet" onClick={exportData}>
                    <Download size={16} />
                    导出备份
                  </button>
                  <label className="mobile-btn quiet">
                    <RefreshCw size={16} />
                    导入恢复
                    <input
                      type="file"
                      accept="application/json"
                      hidden
                      onChange={importData}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mobile-section">
              <h2>图片转日程</h2>
              <div className="mobile-account-panel">
                <p>从相册选择截图或日程图片，手机本地识别后加入日历。</p>
                <label className="mobile-btn quiet">
                  <ImagePlus size={16} />
                  选择图片
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={pickPhoto}
                  />
                </label>
                {photo && (
                  <div className="mobile-photo">
                    <img src={photo.dataUrl} alt="待识别日程图片" />
                    <button
                      className="mobile-btn ghost"
                      onClick={recognizePhoto}
                      disabled={ocrLoading}
                    >
                      <Search size={15} />
                      {ocrLoading ? "正在识别..." : "识别图片文字"}
                    </button>
                    <form className="mobile-photo-form" onSubmit={addPhotoTask}>
                      <label className="mobile-field">
                        事项名称
                        <input
                          value={draft.title}
                          onChange={(event) =>
                            setDraft({ ...draft, title: event.target.value })
                          }
                          placeholder="识别结果会自动填入"
                        />
                      </label>
                      <div className="mobile-two">
                        <label className="mobile-field">
                          日期
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(event) =>
                              setDraft({ ...draft, date: event.target.value })
                            }
                          />
                        </label>
                        <label className="mobile-field">
                          时间
                          <input
                            type="time"
                            value={draft.time}
                            onChange={(event) =>
                              setDraft({ ...draft, time: event.target.value })
                            }
                          />
                        </label>
                      </div>
                      {ocrText && <pre className="mobile-ocr">{ocrText}</pre>}
                      <button className="mobile-btn primary" type="submit">
                        <Check size={15} />
                        加入日历
                      </button>
                    </form>
                  </div>
                )}
                {notice && <p className="mobile-notice">{notice}</p>}
              </div>
            </div>

            <p className="mobile-version">
              小日历手机版 · 数据与桌面端共用本地存储和云端同步
            </p>
          </section>
        )}
      </main>

      <nav className="mobile-tabs" aria-label="主导航">
        {[
          ["today", "今日", ListChecks],
          ["calendar", "日历", CalendarDays],
          ["tasks", "待办", Search],
          ["settings", "设置", Settings2],
        ].map(([value, label, Icon]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <button
        className="mobile-fab"
        onClick={() => openNew(selected)}
        aria-label="新建待办"
      >
        <Plus size={24} />
      </button>

      {modal && (
        <div className="mobile-overlay" onClick={() => setModal(false)}>
          <form
            className="mobile-sheet"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="mobile-sheet-head">
              <h3>{editing ? "编辑待办" : "新建待办"}</h3>
              <button type="button" onClick={() => setModal(false)} aria-label="关闭">
                <X size={20} />
              </button>
            </div>
            <label className="mobile-field">
              待办名称
              <input
                autoFocus
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="例如：整理本周项目资料"
              />
            </label>
            <div className="mobile-two">
              <label className="mobile-field">
                开始日期
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </label>
              <label className="mobile-field">
                结束日期
                <input
                  type="date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                />
              </label>
            </div>
            <div className="mobile-two">
              <label className="mobile-field">
                提醒时间
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                />
              </label>
              <label className="mobile-check-row">
                <input
                  type="checkbox"
                  checked={form.remind}
                  onChange={(event) =>
                    setForm({ ...form, remind: event.target.checked })
                  }
                />
                需要提醒
              </label>
            </div>
            <label className="mobile-field">
              重复周期
              <select
                value={form.repeat}
                onChange={(event) => setForm({ ...form, repeat: event.target.value })}
              >
                <option value="none">单次</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="yearly">每年</option>
              </select>
            </label>
            <label className="mobile-field">
              标签
              <select
                value={form.tag}
                onChange={(event) => setForm({ ...form, tag: event.target.value })}
              >
                {tags.map((tag) => (
                  <option key={tag}>{tag}</option>
                ))}
              </select>
            </label>
            <div className="mobile-tags">
              <input
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                placeholder="新标签"
              />
              <button type="button" onClick={addTag}>
                <Plus size={14} />
                添加
              </button>
              {tags.map((tag) => (
                <button type="button" key={tag} onClick={() => removeTag(tag)}>
                  {tag} <Trash2 size={11} />
                </button>
              ))}
            </div>
            <button className="mobile-submit" type="submit">
              {editing ? "保存修改" : "添加待办"}
            </button>
            {editing && (
              <div className="mobile-sheet-actions">
                <button type="button" className="mobile-cancel" onClick={cancel}>
                  取消待办
                </button>
                <button type="button" className="mobile-delete" onClick={remove}>
                  <Trash2 size={14} />
                  删除
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
