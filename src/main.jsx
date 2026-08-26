import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Bell,
  Settings2,
  LayoutGrid,
  X,
  Trash2,
  Palette,
  ImagePlus,
  Monitor,
  Download,
  RefreshCw,
  Search,
  ListChecks,
  Keyboard,
  UserRound,
  Cloud,
  LogOut,
} from "lucide-react";
import "./style.css";
import "./widget.css";
import "./motion.css";
import "./feature-ui.css";
import MobileApp from "./mobile.jsx";
const T = {
  app: "\u5c0f\u65e5\u5386",
  work: "\u5de5\u4f5c\u65e5",
  calendar: "\u5de5\u4f5c\u65e5\u5386",
  newTask: "\u65b0\u5efa\u5f85\u529e",
  reminders: "\u63d0\u9192\u4e2d\u5fc3",
  settings: "\u504f\u597d\u8bbe\u7f6e",
  today: "\u56de\u5230\u4eca\u5929",
  todo: "\u5f85\u529e\u6e05\u5355",
  save: "\u4fdd\u5b58\u5f85\u529e",
  edit: "\u7f16\u8f91\u5f85\u529e",
  delete: "\u5220\u9664",
  cancel: "\u53d6\u6d88\u5f85\u529e",
};
const now = new Date(),
  pad = (n) => String(n).padStart(2, "0"),
  key = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const defaultTags = ["\u5de5\u4f5c", "\u4e2a\u4eba", "\u91cd\u8981"];
const initial = [
  {
    id: 1,
    title: "\u6574\u7406\u672c\u5468\u9879\u76ee\u8d44\u6599",
    date: key(now),
    endDate: key(now),
    time: "10:00",
    tag: defaultTags[0],
    remind: true,
    repeat: "none",
    done: false,
  },
];
const read = (name, fallback) => {
  try {
    const v = localStorage.getItem(name);
    return v ? JSON.parse(v) : fallback;
  } catch {
    localStorage.removeItem(name);
    return fallback;
  }
};
const decodeUi = () => {
  const decode = (v) =>
    v.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach((n) => {
    if (n.nodeValue.includes("\\u")) n.nodeValue = decode(n.nodeValue);
  });
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((n) =>
    ["placeholder", "aria-label", "title"].forEach((a) => {
      const v = n.getAttribute(a);
      if (v?.includes("\\u")) n.setAttribute(a, decode(v));
    }),
  );
};
const inRange = (t, d) => t.date <= d && (t.endDate || t.date) >= d;
const syncSnapshot = (tasks, tags, theme, background, desktopPrefs) => ({
  protocolVersion: 1,
  tasks,
  tags,
  theme,
  background,
  desktopPrefs,
});
const mergeTasks = (local = [], remote = []) => {
  const merged = new Map(remote.map((item) => [item.id, item]));
  local.forEach((item) => { const old = merged.get(item.id); if (!old || (item.updatedAt || 0) >= (old.updatedAt || 0)) merged.set(item.id, item); });
  return [...merged.values()];
};
const syncApi = () => (import.meta.env.VITE_SYNC_API || "http://localhost:8787").replace(/\/$/, "");
function useMobile() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const onChange = (event) => setMobile(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
function Root() {
  const isMobile = useMobile();
  if (location.hash === "#widget") return <Widget />;
  return isMobile ? <MobileApp /> : <App />;
}
function Widget() {
  useLayoutEffect(() => decodeUi(), []);
  const [tasks, setTasks] = useState(() => read("workday-tasks", initial)),
    [note, setNote] = useState(
      () => localStorage.getItem("workday-note") || "",
    ),
    [theme, setTheme] = useState(
      () => localStorage.getItem("workday-theme") || "sage",
    ),
    [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1)),
    [selected, setSelected] = useState(key(now)),
    [widgetView, setWidgetView] = useState("calendar"),
    [rangeView, setRangeView] = useState("month"),
    [prefs] = useState(() =>
      read("workday-desktop-prefs", {
        showNote: true,
        showTasks: true,
        showAgenda: true,
        showCalendar: true,
        taskLimit: 8,
      }),
    );
  const widgetDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);
  const selectedTasks = tasks.filter((t) => !t.cancelled && inRange(t, selected)).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  const selectedDate = new Date(`${selected}T00:00:00`);
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
  const widgetWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const yearMonths = Array.from({ length: 12 }, (_, i) => {
    const prefix = `${selectedDate.getFullYear()}-${pad(i + 1)}`;
    return { month: i + 1, count: tasks.filter((t) => !t.cancelled && t.date.startsWith(prefix)).length };
  });
  const active = tasks
    .filter((t) => !t.done && !t.cancelled && inRange(t, key(now)))
    .slice(0, prefs.taskLimit || 8);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "workday-theme") setTheme(e.newValue || "sage");
      if (e.key === "workday-desktop-prefs") window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => window.desktop?.onDataChanged?.(() => window.location.reload()), []);
  const complete = (id) => {
    const n = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTasks(n);
    localStorage.setItem("workday-tasks", JSON.stringify(n));
    window.desktop?.notifyDataChanged?.();
  };
  const shiftMonth = (amount) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  const selectDate = (date) => {
    setSelected(key(date));
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  };
  return (
    <div className={`widget widget-theme-${theme}`}>
      <div className="widget-head">
        <strong>{T.app}</strong>
        <span>
          {key(now)}{" "}
          <button onClick={() => window.desktop?.openMain?.()}>
            打开完整日历
          </button>
          <button onClick={() => window.desktop?.closeWidget?.()}>
            \u5173\u95ed
          </button>
        </span>
      </div>
      {prefs.showCalendar !== false && (
        <section className="widget-calendar" aria-label="桌面日历">
          <div className="widget-range-tabs" role="tablist" aria-label="日历视图">
            {[['day', '日'], ['week', '周'], ['month', '月'], ['year', '年']].map(([value, label]) => <button key={value} className={rangeView === value ? "active" : ""} onClick={() => setRangeView(value)}>{label}</button>)}
          </div>
          <div className="widget-calendar-head">
            <button aria-label="上一段" onClick={() => shiftMonth(rangeView === "year" ? -12 : rangeView === "week" ? -1 : -1)}><ChevronLeft size={15} /></button>
            <strong>{rangeView === "year" ? `${selectedDate.getFullYear()}年` : rangeView === "day" ? selected : `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`}</strong>
            <button aria-label="下一段" onClick={() => shiftMonth(rangeView === "year" ? 12 : rangeView === "week" ? 1 : 1)}><ChevronRight size={15} /></button>
            <button className="widget-today" onClick={() => selectDate(now)}>今天</button>
          </div>
          {rangeView === "month" && <><div className="widget-weekdays">{["日", "一", "二", "三", "四", "五", "六"].map((d) => <span key={d}>{d}</span>)}</div><div className="widget-grid">{widgetDays.map((date) => { const dayKey = key(date); const count = tasks.filter((t) => !t.done && !t.cancelled && inRange(t, dayKey)).length; return <button key={dayKey} className={`widget-day ${date.getMonth() !== cursor.getMonth() ? "muted" : ""} ${dayKey === selected ? "selected" : ""} ${dayKey === key(now) ? "today" : ""}`} onClick={() => selectDate(date)}><b>{date.getDate()}</b>{count > 0 && <i>{count > 3 ? "3+" : count}</i>}</button>; })}</div></>}
          {rangeView === "day" && <div className="widget-day-focus"><strong>{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日</strong><span>{selectedTasks.length} 项安排</span></div>}
          {rangeView === "week" && <div className="widget-week-grid">{widgetWeek.map((date) => { const dayKey = key(date); const items = tasks.filter((t) => !t.cancelled && !t.done && inRange(t, dayKey)); return <button key={dayKey} className={dayKey === selected ? "selected" : ""} onClick={() => selectDate(date)}><b>{["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}</b><small>{date.getMonth() + 1}/{date.getDate()}</small><i>{items.length || "-"}</i></button>; })}</div>}
          {rangeView === "year" && <div className="widget-year-grid">{yearMonths.map(({ month, count }) => <button key={month} onClick={() => { setRangeView("month"); setCursor(new Date(selectedDate.getFullYear(), month - 1, 1)); }}><b>{month}月</b><span>{count} 项</span><i style={{ "--fill": `${Math.min(100, count * 20)}%` }} /></button>)}</div>}
        </section>
      )}
      <div className="widget-switcher" role="tablist">
        <button className={widgetView === "calendar" ? "active" : ""} onClick={() => setWidgetView("calendar")}>当天事项</button>
        <button className={widgetView === "tasks" ? "active" : ""} onClick={() => setWidgetView("tasks")}>今日待办</button>
      </div>
      {widgetView === "calendar" && (
        <section className="widget-selected-day"><div className="widget-section-head"><h3>{selected}</h3><span>{selectedTasks.length} 项</span></div>{selectedTasks.length ? selectedTasks.slice(0, prefs.taskLimit || 8).map((t) => <button className={`widget-task ${t.done ? "is-done" : ""}`} key={t.id} onClick={() => complete(t.id)}><span /><time>{t.time || "全天"}</time><strong>{t.title}</strong></button>) : <p className="widget-empty">这一天没有安排</p>}</section>
      )}
      {prefs.showNote && (
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            localStorage.setItem("workday-note", e.target.value);
          }}
          placeholder="\u684c\u9762\u4fbf\u7b7e..."
        />
      )}
      {prefs.showTasks && widgetView === "tasks" && (
        <>
          <h3>\u4eca\u65e5\u5f85\u529e</h3>
          {active.map((t) => (
            <button
              className="widget-task"
              key={t.id}
              onClick={() => complete(t.id)}
            >
              <span />
              {t.title}
            </button>
          ))}
        </>
      )}
      {prefs.showAgenda && (
        <div className="widget-summary">
          未完成 {tasks.filter((t) => !t.done && !t.cancelled).length} 项 ·
          点击圆点即可完成
        </div>
      )}
    </div>
  );
}
function App() {
  if (location.hash === "#widget") return <Widget />;
  useLayoutEffect(() => decodeUi());
  const searchRef = useRef(null);
  const [cursor, setCursor] = useState(
      new Date(now.getFullYear(), now.getMonth(), 1),
    ),
    [view, setView] = useState("month"),
    [panel, setPanel] = useState("calendar"),
    [tasks, setTasks] = useState(() => read("workday-tasks", initial)),
    [tags, setTags] = useState(() => read("workday-tags", defaultTags)),
    [theme, setTheme] = useState(
      () => localStorage.getItem("workday-theme") || "sage",
    ),
    [background, setBackground] = useState(
      () => localStorage.getItem("workday-bg") || "",
    ),
    [selected, setSelected] = useState(key(now)),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState(null),
    [newTag, setNewTag] = useState(""),
    [desktopMode, setDesktopMode] = useState(true),
    [desktopPrefs, setDesktopPrefs] = useState(() =>
      read("workday-desktop-prefs", {
        showNote: true,
        showTasks: true,
        showAgenda: true,
        showCalendar: true,
        taskLimit: 8,
      }),
    ),
    [updateStatus, setUpdateStatus] = useState(""),
    [updateReady, setUpdateReady] = useState(false),
    [account, setAccount] = useState(() => read("workday-account", null)),
    [authMode, setAuthMode] = useState("login"),
    [resetCode, setResetCode] = useState(""),
    [resetNotice, setResetNotice] = useState(""),
    [authEmail, setAuthEmail] = useState(""),
    [authPassword, setAuthPassword] = useState(""),
    [syncStatus, setSyncStatus] = useState(""),
    [syncRevision, setSyncRevision] = useState(0),
    [clipboardImage, setClipboardImage] = useState(null),
    [clipboardNotice, setClipboardNotice] = useState(""),
    [ocrLoading, setOcrLoading] = useState(false),
    [ocrText, setOcrText] = useState(""),
    [clipboardDraft, setClipboardDraft] = useState({ title: "", date: key(now), time: "09:00" }),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("open"),
    [form, setForm] = useState({
      title: "",
      date: key(now),
      endDate: key(now),
      time: "09:00",
      tag: defaultTags[0],
      remind: true,
      repeat: "none",
    });
  useEffect(() => {
    if (window.desktop || !location.search.includes("shared=1")) return;
    fetch("./__shared-image").then((response) => response.ok ? response.blob() : null).then((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        setClipboardImage({ dataUrl: reader.result, width: 0, height: 0 });
        setClipboardNotice("已接收系统分享的图片，请识别并确认后加入日历");
      };
      reader.readAsDataURL(blob);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (window.desktop) return;
    fetch(`${syncApi()}/app/version`)
      .then((response) => response.ok ? response.json() : null)
      .then((info) => {
        if (!info) return;
        setSyncStatus(`同步服务 ${info.version} · 协议 ${info.protocolVersion}`);
      })
      .catch(() => setSyncStatus("离线模式：同步服务暂不可用"));
  }, []);
  useEffect(() => {
    const removeAvailable = window.desktop?.onUpdateAvailable?.((info) => setUpdateStatus(`发现新版本 ${info?.version || ""}，正在下载...`));
    const removeDownloaded = window.desktop?.onUpdateDownloaded?.((info) => { setUpdateReady(true); setUpdateStatus(`新版本 ${info?.version || ""} 已下载完成`); });
    return () => { removeAvailable?.(); removeDownloaded?.(); };
  }, []);
  const save = (n) => {
    const next = n.map((item) => ({ ...item, updatedAt: Date.now() }));
    setTasks(next);
    localStorage.setItem("workday-tasks", JSON.stringify(next));
    window.desktop?.notifyDataChanged?.();
    setSyncRevision((value) => value + 1);
  };
  const saveDesktopPrefs = (next) => {
    setDesktopPrefs(next);
    localStorage.setItem("workday-desktop-prefs", JSON.stringify(next));
    window.desktop?.notifyDataChanged?.();
  };
  const checkUpdates = async () => {
    setUpdateStatus("正在检查...");
    const result = await window.desktop?.checkForUpdates?.();
    setUpdateStatus(
      result?.available
        ? `发现新版本 ${result.version}`
        : result?.message || "当前已是最新版本",
    );
  };
  const applySnapshot = (snapshot) => {
    if (!snapshot) return;
    if (snapshot.tasks) { setTasks(snapshot.tasks); localStorage.setItem("workday-tasks", JSON.stringify(snapshot.tasks)); }
    if (snapshot.tags) { setTags(snapshot.tags); localStorage.setItem("workday-tags", JSON.stringify(snapshot.tags)); }
    if (snapshot.theme) { setTheme(snapshot.theme); localStorage.setItem("workday-theme", snapshot.theme); }
    if (snapshot.background !== undefined) { setBackground(snapshot.background || ""); localStorage.setItem("workday-bg", snapshot.background || ""); }
    if (snapshot.desktopPrefs) { setDesktopPrefs(snapshot.desktopPrefs); localStorage.setItem("workday-desktop-prefs", JSON.stringify(snapshot.desktopPrefs)); }
  };
  const authenticate = async (event) => {
    event.preventDefault();
    const api = syncApi();
    setSyncStatus("正在连接同步服务...");
    try {
      const response = await fetch(`${api}/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail.trim(), password: authPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "账户操作失败");
      const next = { email: authEmail.trim(), token: data.token };
      setAccount(next); localStorage.setItem("workday-account", JSON.stringify(next)); setAuthPassword("");
      setSyncStatus("登录成功，正在读取云端数据...");
      const cloudResponse = await fetch(`${api}/sync`, { headers: { Authorization: `Bearer ${data.token}` } });
      const cloud = await cloudResponse.json();
      if (!cloudResponse.ok) throw new Error(cloud.message || "读取云端数据失败");
      if (cloud.data) {
        const merged = { ...cloud.data, tasks: mergeTasks(tasks, cloud.data.tasks) };
        applySnapshot(merged);
        await fetch(`${api}/sync`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` }, body: JSON.stringify(merged) });
      } else {
        await fetch(`${api}/sync`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.token}` }, body: JSON.stringify(syncSnapshot(tasks, tags, theme, background, desktopPrefs)) });
      }
      setSyncStatus("已同步");
    } catch (error) { setSyncStatus(error.message || "同步服务暂不可用"); }
  };
  const requestPasswordReset = async () => {
    const api = syncApi(); setResetNotice("正在生成重置码...");
    try {
      const response = await fetch(`${api}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "无法生成重置码");
      setResetCode(data.resetCode || ""); setResetNotice(`${data.message}${data.resetCode ? `：${data.resetCode}` : ""}`);
    } catch (error) { setResetNotice(error.message || "重置服务暂不可用"); }
  };
  const resetPassword = async (event) => {
    event.preventDefault(); const api = syncApi(); setResetNotice("正在重置密码...");
    try {
      const response = await fetch(`${api}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail.trim(), code: resetCode, password: authPassword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "密码重置失败");
      setAuthMode("login"); setAuthPassword(""); setResetCode(""); setResetNotice(data.message);
    } catch (error) { setResetNotice(error.message || "密码重置失败"); }
  };
  const syncNow = async () => {
    if (!account?.token) return;
    const api = syncApi(); setSyncStatus("正在同步...");
    try {
      const response = await fetch(`${api}/sync`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.token}` }, body: JSON.stringify(syncSnapshot(tasks, tags, theme, background, desktopPrefs)) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "同步失败");
      applySnapshot(data.data); setSyncStatus(`已同步 · ${new Date().toLocaleTimeString()}`);
    } catch (error) { setSyncStatus(error.message || "同步服务暂不可用"); }
  };
  useEffect(() => {
    if (!account?.token || !syncRevision) return undefined;
    const timer = window.setTimeout(() => syncNow(), 900);
    return () => window.clearTimeout(timer);
  }, [syncRevision, account?.token]);
  const logout = () => { setAccount(null); localStorage.removeItem("workday-account"); setSyncStatus("已退出当前账户"); };
  useEffect(
    () => localStorage.setItem("workday-tags", JSON.stringify(tags)),
    [tags],
  );
  const openNew = (d) => {
    setEditing(null);
    setForm({
      title: "",
      date: d || key(now),
      endDate: d || key(now),
      time: "09:00",
      tag: tags[0],
      remind: true,
      repeat: "none",
    });
    setModal(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      title: t.title,
      date: t.date,
      endDate: t.endDate || t.date,
      time: t.time,
      tag: t.tag,
      remind: t.remind !== false,
      repeat: t.repeat || "none",
    });
    setModal(true);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const item = {
      ...form,
      id: editing?.id || Date.now(),
      done: editing?.done || false,
    };
    save(
      editing
        ? tasks.map((t) => (t.id === editing.id ? item : t))
        : [...tasks, item],
    );
    setModal(false);
    setEditing(null);
  };
  const remove = () => {
    if (editing) save(tasks.filter((t) => t.id !== editing.id));
    setModal(false);
    setEditing(null);
  };
  const cancel = () => {
    if (editing)
      save(
        tasks.map((t) => (t.id === editing.id ? { ...t, cancelled: true } : t)),
      );
    setModal(false);
    setEditing(null);
  };
  const toggle = (id) =>
    save(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const addTag = () => {
    const v = newTag.trim();
    if (v && !tags.includes(v)) {
      setTags([...tags, v]);
      setForm({ ...form, tag: v });
      setNewTag("");
    }
  };
  const removeTag = (v) => {
    if (tags.length > 1) {
      const n = tags.filter((t) => t !== v);
      setTags(n);
      if (form.tag === v) setForm({ ...form, tag: n[0] });
    }
  };
  const exportData = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify({ tasks, tags, background }, null, 2)], {
        type: "application/json",
      }),
    );
    a.download = `workday-${key(now)}.json`;
    a.click();
  };
  const importData = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (Array.isArray(d.tasks)) save(d.tasks);
        if (Array.isArray(d.tags)) setTags(d.tags);
        if (d.background) setBackground(d.background);
      } catch {}
    };
    r.readAsText(f);
  };
  const readClipboardImage = async () => {
    setClipboardNotice("正在读取本次剪贴板图片...");
    const result = await window.desktop?.readClipboardImage?.();
    if (!result?.ok) {
      setClipboardNotice(result?.message || "当前环境不支持读取剪贴板图片");
      return;
    }
    setClipboardImage({ dataUrl: result.dataUrl, width: result.width, height: result.height });
    setClipboardNotice("已获取截图，请填写并确认后加入日历");
  };
  const recognizeClipboardImage = async () => {
    if (!clipboardImage || ocrLoading) return;
    setOcrLoading(true);
    setClipboardNotice("正在按需加载本地 OCR...");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim+eng");
      const result = await worker.recognize(clipboardImage.dataUrl);
      const text = result.data.text.trim();
      const dateMatch = text.match(/(20\d{2})[年\\/-](\d{1,2})[月\\/-](\d{1,2})/);
      const timeMatch = text.match(/\\b([01]?\\d|2[0-3])[:：]([0-5]\\d)\\b/);
      setOcrText(text);
      setClipboardDraft((draft) => ({
        ...draft,
        title: text.split(/\\r?\\n/).map((line) => line.trim()).find(Boolean) || draft.title,
        date: dateMatch ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}` : draft.date,
        time: timeMatch ? `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}` : draft.time,
      }));
      await worker.terminate();
      setClipboardNotice(text ? "识别完成，请检查并确认内容" : "未识别到文字，请手动填写");
    } catch (error) {
      setClipboardNotice(`OCR 识别失败，请手动填写：${error.message || "未知错误"}`);
    } finally {
      setOcrLoading(false);
    }
  };
  const addClipboardTask = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    save([...tasks, {
      id: Date.now(), title, date: data.get("date") || key(now),
      endDate: data.get("date") || key(now), time: data.get("time") || "09:00",
      tag: tags[0], remind: true, repeat: "none", done: false,
      source: "clipboard-image",
    }]);
    setClipboardImage(null);
    setClipboardNotice("截图事项已加入日历并进入同步队列");
  };
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1),
      start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);
  const displayDays =
    view === "week"
      ? (() => {
          const base = new Date(`${selected}T00:00:00`);
          base.setDate(base.getDate() - base.getDay());
          return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            return d;
          });
        })()
      : view === "day"
        ? days.filter((d) => key(d) === selected)
        : view === "year"
          ? Array.from(
              { length: 12 },
              (_, i) => new Date(cursor.getFullYear(), i, 1),
            )
          : days;
  const visible = tasks.filter((t) => {
    const matchesDate = inRange(t, selected);
    const matchesQuery =
      !query.trim() ||
      `${t.title} ${t.tag}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "done" ? t.done : !t.done && !t.cancelled);
    return matchesDate && matchesQuery && matchesFilter;
  });
  const month = `${cursor.getFullYear()}\u5e74${cursor.getMonth() + 1}\u6708`;
  const rangeTasks = tasks.filter((t) => !t.cancelled && inRange(t, selected));
  const viewInsight =
    view === "day" ? (
      <div className="view-insight">
        <div className="view-insight-head">
          <span>日视图</span>
          <strong>{selected}</strong>
        </div>
        <div className="timeline-list">
          {rangeTasks.length ? (
            rangeTasks.map((t) => (
              <button
                className="timeline-item"
                key={t.id}
                onDoubleClick={() => openEdit(t)}
              >
                <time>{t.time || "全天"}</time>
                <span>
                  <b>{t.title}</b>
                  <small>
                    {t.tag} · {t.remind ? "已设置提醒" : "无提醒"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty">这一天没有待办</p>
          )}
        </div>
      </div>
    ) : view === "week" ? (
      <div className="view-insight">
        <div className="view-insight-head">
          <span>周视图</span>
          <strong>按星期查看任务</strong>
        </div>
        <div className="week-columns">
          {displayDays.map((d) => {
            const k = key(d);
            const ts = tasks.filter(
              (t) => !t.done && !t.cancelled && inRange(t, k),
            );
            return (
              <div className="week-column" key={k}>
                <small>
                  {["日", "一", "二", "三", "四", "五", "六"][d.getDay()]}{" "}
                  {d.getMonth() + 1}/{d.getDate()}
                </small>
                {ts.length ? (
                  ts.map((t) => (
                    <button key={t.id} onDoubleClick={() => openEdit(t)}>
                      {t.title}
                    </button>
                  ))
                ) : (
                  <em>无安排</em>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ) : view === "year" ? (
      <div className="view-insight">
        <div className="view-insight-head">
          <span>年视图</span>
          <strong>{cursor.getFullYear()} 年任务分布</strong>
        </div>
        <div className="year-summary">
          {Array.from({ length: 12 }, (_, i) => {
            const count = tasks.filter(
              (t) =>
                !t.cancelled &&
                t.date.startsWith(`${cursor.getFullYear()}-${pad(i + 1)}`),
            ).length;
            return (
              <div key={i}>
                <strong>{i + 1}</strong>
                <span>{count} 项</span>
                <i style={{ "--fill": `${Math.min(100, count * 18)}%` }} />
              </div>
            );
          })}
        </div>
      </div>
    ) : null;
  const bgStyle = background
    ? {
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
      }
    : {};
  return (
    <div className={`app theme-${theme} view-${view}`} style={bgStyle}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <CalendarDays size={20} />
          </div>
          <div>
            <b>{T.app}</b>
            <span>{T.work}</span>
          </div>
        </div>
        <button className="add" onClick={() => openNew()}>
          <Plus size={18} />
          {T.newTask}
        </button>
        <nav>
          <button
            className={panel === "calendar" ? "active" : ""}
            onClick={() => setPanel("calendar")}
          >
            <LayoutGrid size={18} />
            {T.calendar}
          </button>
          <button
            className={panel === "reminders" ? "active" : ""}
            onClick={() => setPanel("reminders")}
          >
            <Bell size={18} />
            {T.reminders}
            <i>
              {tasks.filter((t) => t.remind && !t.done && !t.cancelled).length}
            </i>
          </button>
          <button
            className={panel === "settings" ? "active" : ""}
            onClick={() => setPanel("settings")}
          >
            <Settings2 size={18} />
            {T.settings}
          </button>
          <button
            className={`account-shortcut ${panel === "settings" ? "active" : ""}`}
            onClick={() => setPanel("settings")}
          >
            <UserRound size={18} />
            <span>{account ? account.email : "账户与同步"}</span>
            {!account && <small>登录后跨设备同步</small>}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="widget-open-button" onClick={() => window.desktop?.openWidget?.()}><Monitor size={16} />打开桌面小日历</button>
          <textarea
            className="mini-note"
            value={localStorage.getItem("workday-note") || ""}
            onChange={(e) =>
              localStorage.setItem("workday-note", e.target.value)
            }
            placeholder="\u5199\u4e00\u5f20\u684c\u9762\u4fbf\u7b7e..."
          />
          <label className="image-button">
            <ImagePlus size={16} />
            \u9009\u62e9\u80cc\u666f
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onload = () => {
                    setBackground(r.result);
                    localStorage.setItem("workday-bg", r.result);
                  };
                  r.readAsDataURL(f);
                }
              }}
            />
          </label>
          <button
            className="extension"
            onClick={() => {
              const n =
                theme === "sage"
                  ? "lavender"
                  : theme === "lavender"
                    ? "sky"
                    : "sage";
              setTheme(n);
              localStorage.setItem("workday-theme", n);
            }}
          >
            <Palette size={16} />
            \u5207\u6362\u80cc\u666f
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">{T.calendar}</p>
            <h1>{month}</h1>
          </div>
          <div className="header-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索待办"
                aria-label="搜索待办"
              />
              <kbd>Ctrl K</kbd>
            </label>
            <button
              className="today"
              onClick={() => {
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelected(key(now));
              }}
            >
              {T.today}
            </button>
            <div className="arrows">
              <button
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="views">
              {["month", "week", "day", "year"].map((v) => (
                <button
                  className={view === v ? "selected" : ""}
                  onClick={() => setView(v)}
                  key={v}
                >
                  {v === "month"
                    ? "\u6708"
                    : v === "week"
                      ? "\u5468"
                      : v === "day"
                        ? "\u65e5"
                        : "\u5e74"}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="focus-bar">
          <div>
            <ListChecks size={17} />
            <strong>
              {tasks.filter((t) => !t.done && !t.cancelled).length}
            </strong>
            <span>项未完成</span>
          </div>
          <div className="filter-tabs">
            {[
              ["open", "未完成"],
              ["all", "全部"],
              ["done", "已完成"],
            ].map(([v, label]) => (
              <button
                key={v}
                className={filter === v ? "selected" : ""}
                onClick={() => setFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="shortcut-hint">
            <Keyboard size={14} /> 双击日期快速新建
          </span>
        </div>
        {panel === "reminders" && (
          <section className="tool-panel">
            <h2>{T.reminders}</h2>
            <p>所有需要提醒的待办都会集中显示在这里。</p>
            {tasks
              .filter((t) => t.remind && !t.done && !t.cancelled)
              .map((t) => (
                <button
                  className="tool-row"
                  key={t.id}
                  onClick={() => {
                    setSelected(t.date);
                    setPanel("calendar");
                  }}
                >
                  <Bell size={16} />
                  <span>{t.title}</span>
                  <small>
                    {t.date} {t.time} ·{" "}
                    {t.repeat === "none" ? "单次" : t.repeat}
                  </small>
                </button>
              ))}
            {!tasks.some((t) => t.remind && !t.done && !t.cancelled) && (
              <p className="empty">暂无待提醒事项</p>
            )}
          </section>
        )}
        {panel === "settings" && (
          <section className="tool-panel">
            <h2>{T.settings}</h2>
            <div className="account-panel">
              <div className="account-heading"><span className="account-icon"><UserRound size={18} /></span><div><strong>{account ? account.email : "账户与同步"}</strong><small>{account ? "云端账户已连接，可在其他设备登录" : "登录后同步待办、标签、主题和桌面偏好"}</small></div></div>
              {!account ? <form className="account-form" onSubmit={authMode === "forgot" ? resetPassword : authenticate}>
                <div className="segmented"><button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>登录</button><button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>注册</button></div>
                <input type="email" required placeholder="邮箱" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                <input type="password" required minLength="6" placeholder="密码（至少 6 位）" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                <button className="primary-action" type="submit"><Cloud size={15} />{authMode === "login" ? "登录并同步" : "创建账户"}</button>
              </form> : <div className="account-actions"><button className="primary-action" onClick={syncNow}><Cloud size={15} />立即同步</button><button className="quiet-action" onClick={logout}><LogOut size={15} />退出账户</button></div>}
              {!account && authMode === "login" && <button type="button" className="text-action" onClick={() => { setAuthMode("forgot"); setResetNotice(""); }}>忘记密码？</button>}
              {!account && authMode === "forgot" && <><input className="reset-code-input" required inputMode="numeric" placeholder="重置码" value={resetCode} onChange={(e) => setResetCode(e.target.value)} /><button type="button" className="text-action" onClick={requestPasswordReset}>获取重置码</button>{resetNotice && <span className="sync-status">{resetNotice}</span>}</>}
              <span className="sync-status">{syncStatus}</span>
            </div>
            <label className="setting-row">
              <span>
                <Monitor size={16} />
                开机显示桌面小日历<small>启动电脑后自动显示待办小组件</small>
              </span>
              <input
                type="checkbox"
                checked={desktopMode}
                onChange={(e) => {
                  setDesktopMode(e.target.checked);
                  window.desktop?.setDesktopMode?.(e.target.checked);
                }}
              />
            </label>
            <div className="desktop-content-settings">
              <strong>桌面上显示的内容</strong>
              <label className="setting-row compact">
                <span>桌面日历</span>
                <input
                  type="checkbox"
                  checked={desktopPrefs.showCalendar !== false}
                  onChange={(e) =>
                    saveDesktopPrefs({ ...desktopPrefs, showCalendar: e.target.checked })
                  }
                />
              </label>
              <label className="setting-row compact">
                <span>桌面便签</span>
                <input
                  type="checkbox"
                  checked={desktopPrefs.showNote}
                  onChange={(e) =>
                    saveDesktopPrefs({
                      ...desktopPrefs,
                      showNote: e.target.checked,
                    })
                  }
                />
              </label>
              <label className="setting-row compact">
                <span>今日待办</span>
                <input
                  type="checkbox"
                  checked={desktopPrefs.showTasks}
                  onChange={(e) =>
                    saveDesktopPrefs({
                      ...desktopPrefs,
                      showTasks: e.target.checked,
                    })
                  }
                />
              </label>
              <label className="setting-row compact">
                <span>完成统计</span>
                <input
                  type="checkbox"
                  checked={desktopPrefs.showAgenda}
                  onChange={(e) =>
                    saveDesktopPrefs({
                      ...desktopPrefs,
                      showAgenda: e.target.checked,
                    })
                  }
                />
              </label>
              <label className="setting-row compact">
                <span>最多显示待办数</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={desktopPrefs.taskLimit}
                  onChange={(e) =>
                    saveDesktopPrefs({
                      ...desktopPrefs,
                      taskLimit: Number(e.target.value) || 8,
                    })
                  }
                />
              </label>
            </div>
            <label className="setting-row">
              <span>
                <Palette size={16} />
                界面主题
              </span>
              <select
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  localStorage.setItem("workday-theme", e.target.value);
                }}
              >
                <option value="sage">鼠尾草</option>
                <option value="lavender">薰衣草</option>
                <option value="sky">晴空</option>
              </select>
            </label>
            <div className="tool-actions">
              <button onClick={readClipboardImage}>
                <ImagePlus size={15} />
                从剪贴板读取截图
              </button>
              <button onClick={exportData}>
                <Download size={15} />
                备份待办与偏好
              </button>
              <label>
                <RefreshCw size={15} />
                导入恢复
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={importData}
                />
              </label>
            </div>
            {clipboardNotice && <p className="sync-status">{clipboardNotice}</p>}
            {clipboardImage && (
              <div className="clipboard-import-panel">
                <img src={clipboardImage.dataUrl} alt="待识别的剪贴板截图" />
                <form onSubmit={addClipboardTask}>
                  <button type="button" className="quiet-action" onClick={recognizeClipboardImage} disabled={ocrLoading}><Search size={15} />{ocrLoading ? "正在识别..." : "本地识别截图文字"}</button>
                  <strong>确认截图中的日程</strong>
                  <input name="title" required placeholder="事项名称" value={clipboardDraft.title} onChange={(e) => setClipboardDraft({ ...clipboardDraft, title: e.target.value })} />
                  <div className="two"><input name="date" type="date" value={clipboardDraft.date} onChange={(e) => setClipboardDraft({ ...clipboardDraft, date: e.target.value })} /><input name="time" type="time" value={clipboardDraft.time} onChange={(e) => setClipboardDraft({ ...clipboardDraft, time: e.target.value })} /></div>
                  {ocrText && <small className="ocr-result">识别原文：{ocrText}</small>}
                  <button className="primary-action" type="submit"><Check size={15} />确认加入日历</button>
                </form>
              </div>
            )}
            <p className="version-note">
              当前数据保存在本机。更新程序时会保留待办、标签、背景和主题偏好。
            </p>
            <div className="update-row">
              <button onClick={checkUpdates}>
                <RefreshCw size={15} />
                检查程序更新
              </button>
              <span>{updateStatus}</span>
              {updateReady && <button onClick={() => window.desktop?.installUpdate?.()}><RefreshCw size={15} />立即更新</button>}
            </div>
          </section>
        )}
        <section
          className={`content ${panel !== "calendar" ? "content-secondary" : ""}`}
        >
          {viewInsight}
          <div className="calendar-panel">
            <div className="hint">
              \u53cc\u51fb\u65e5\u671f\u65b0\u5efa\u5f85\u529e\uff0c\u53cc\u51fb\u4efb\u52a1\u7f16\u8f91
            </div>
            <div className="weekdays">
              {[
                "\u65e5",
                "\u4e00",
                "\u4e8c",
                "\u4e09",
                "\u56db",
                "\u4e94",
                "\u516d",
              ].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {displayDays.map((d) => {
                const k = key(d),
                  dayTasks = tasks.filter(
                    (t) => !t.done && !t.cancelled && inRange(t, k),
                  );
                return (
                  <button
                    className={`day ${d.getMonth() !== cursor.getMonth() ? "muted" : ""} ${k === selected ? "chosen" : ""}`}
                    key={k}
                    onClick={() => setSelected(k)}
                    onDoubleClick={() => openNew(k)}
                  >
                    <span className="date-number">
                      {view === "year" ? `${d.getMonth() + 1}月` : d.getDate()}
                    </span>
                    {dayTasks.slice(0, 2).map((t) => (
                      <span
                        className={`event ${t.tag}`}
                        key={t.id}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          openEdit(t);
                        }}
                      >
                        {t.title}
                      </span>
                    ))}
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="agenda">
            <div className="agenda-head">
              <div>
                <span className="date-label">
                  {selected === key(now) ? "\u4eca\u5929" : selected}
                </span>
                <h2>{T.todo}</h2>
              </div>
              <button className="icon-button" onClick={() => openNew(selected)}>
                <Plus size={19} />
              </button>
            </div>
            {visible.map((t) => (
              <div
                className="task"
                key={t.id}
                onDoubleClick={() => openEdit(t)}
              >
                <button className="check" onClick={() => toggle(t.id)}>
                  {t.done && <Check size={14} />}
                </button>
                <div className="task-body">
                  <strong>{t.title}</strong>
                  <div>
                    <span className={`tag ${t.tag}`}>{t.tag}</span>
                    <span className="task-time">
                      <Clock3 size={13} />
                      {t.time}
                    </span>
                    <span className="repeat">
                      {t.date} ~ {t.endDate || t.date}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="reminder-strip">
              <Bell size={16} />
              <span>
                \u672a\u5b8c\u6210\u4f1a\u5728\u6709\u6548\u671f\u5185\u6301\u7eed\u663e\u793a
                <br />
                <b>
                  \u53ef\u8bbe\u5355\u6b21\u3001\u6bcf\u65e5\u3001\u6bcf\u5468\u3001\u6bcf\u5e74\u63d0\u9192
                </b>
              </span>
            </div>
            <div className="data-actions">
              <button onClick={exportData}>\u5bfc\u51fa\u5907\u4efd</button>
              <label>
                \u5bfc\u5165\u5907\u4efd
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={importData}
                />
              </label>
            </div>
          </aside>
        </section>
      </main>
      {modal && (
        <div className="overlay">
          <form className="modal" onSubmit={submit}>
            <div className="modal-title">
              <h2>{editing ? T.edit : T.newTask}</h2>
              <button type="button" onClick={() => setModal(false)}>
                <X size={18} />
              </button>
            </div>
            <label>
              \u5de5\u4f5c\u540d\u79f0
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="two">
              <label>
                \u5f00\u59cb\u65e5\u671f
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label>
                \u7ed3\u675f\u65e5\u671f
                <input
                  type="date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="two">
              <label>
                \u63d0\u9192\u65f6\u95f4
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.remind}
                  onChange={(e) =>
                    setForm({ ...form, remind: e.target.checked })
                  }
                />
                \u9700\u8981\u63d0\u9192
              </label>
            </div>
            <label>
              \u63d0\u9192\u5468\u671f
              <select
                value={form.repeat}
                onChange={(e) => setForm({ ...form, repeat: e.target.value })}
              >
                <option value="none">\u5355\u6b21</option>
                <option value="daily">\u6bcf\u65e5</option>
                <option value="weekly">\u6bcf\u5468</option>
                <option value="yearly">\u6bcf\u5e74</option>
              </select>
            </label>
            <label>
              \u6807\u7b7e
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              >
                {tags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <div className="tag-manager">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="\u65b0\u6807\u7b7e"
              />
              <button type="button" onClick={addTag}>
                \u589e\u52a0\u6807\u7b7e
              </button>
              {tags.map((t) => (
                <button type="button" key={t} onClick={() => removeTag(t)}>
                  {t} <Trash2 size={12} />
                </button>
              ))}
            </div>
            <button className="submit">{T.save}</button>
            {editing && (
              <div className="modal-actions">
                <button type="button" onClick={cancel}>
                  {T.cancel}
                </button>
                <button type="button" onClick={remove}>
                  <Trash2 size={14} />
                  {T.delete}
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
if ("serviceWorker" in navigator && !window.desktop && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
createRoot(document.getElementById("root")).render(<Root />);
