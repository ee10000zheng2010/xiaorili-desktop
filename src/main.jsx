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
} from "lucide-react";
import "./style.css";
import "./widget.css";
import "./motion.css";
import "./feature-ui.css";
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
function Widget() {
  const [tasks, setTasks] = useState(() => read("workday-tasks", initial)),
    [note, setNote] = useState(
      () => localStorage.getItem("workday-note") || "",
    ),
    [theme, setTheme] = useState(
      () => localStorage.getItem("workday-theme") || "sage",
    ),
    [prefs] = useState(() =>
      read("workday-desktop-prefs", {
        showNote: true,
        showTasks: true,
        showAgenda: true,
        taskLimit: 8,
      }),
    );
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
  const complete = (id) => {
    const n = tasks.map((t) => (t.id === id ? { ...t, done: true } : t));
    setTasks(n);
    localStorage.setItem("workday-tasks", JSON.stringify(n));
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
      {prefs.showTasks && (
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
        taskLimit: 8,
      }),
    ),
    [updateStatus, setUpdateStatus] = useState(""),
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
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const save = (n) => {
    setTasks(n);
    localStorage.setItem("workday-tasks", JSON.stringify(n));
  };
  const saveDesktopPrefs = (next) => {
    setDesktopPrefs(next);
    localStorage.setItem("workday-desktop-prefs", JSON.stringify(next));
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
        </nav>
        <div className="sidebar-bottom">
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
            <p className="version-note">
              当前数据保存在本机。更新程序时会保留待办、标签、背景和主题偏好。
            </p>
            <div className="update-row">
              <button onClick={checkUpdates}>
                <RefreshCw size={15} />
                检查程序更新
              </button>
              <span>{updateStatus}</span>
            </div>
          </section>
        )}
        <section
          className={`content ${panel !== "calendar" ? "content-secondary" : ""}`}
        >
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
createRoot(document.getElementById("root")).render(<App />);
