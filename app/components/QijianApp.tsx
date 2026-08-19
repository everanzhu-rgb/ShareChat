"use client";

import {
  ArchiveRestore,
  AudioLines,
  Bell,
  BookHeart,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Feather,
  Heart,
  Image as ImageIcon,
  Link2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Music2,
  Palette,
  PenLine,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localVault } from "../lib/local-vault";
import {
  loadCloudAccessKey,
  loadCloudAttachmentPreview,
  loadCloudEntries,
  saveCloudAccessKey,
  saveCloudEntry,
  uploadCloudAttachment,
  verifyCloudAccess,
} from "../lib/cloud-client";
import { seedEntries } from "../lib/seed";
import type {
  Attachment,
  AttachmentKind,
  Draft,
  JournalEntry,
  Visibility,
} from "../lib/types";

type Tab = "today" | "journals" | "calendar" | "us";
type Sheet = "none" | "compose" | "entry" | "notifications" | "trash" | "settings";
type SaveState = "saved" | "saving" | "offline";
type CloudState = "checking" | "needs-key" | "connected" | "error";

const moods = ["平静", "想念", "温柔", "雀跃", "疲惫", "复杂"];
const reactions = ["抱抱", "我们懂", "✨", "☕"];

const attachmentOptions: Array<{
  kind: AttachmentKind;
  label: string;
  icon: typeof Camera;
}> = [
  { kind: "photo", label: "照片", icon: Camera },
  { kind: "video", label: "视频", icon: Video },
  { kind: "audio", label: "语音", icon: Mic },
  { kind: "location", label: "位置", icon: MapPin },
  { kind: "weather", label: "天气", icon: Sparkles },
  { kind: "music", label: "音乐", icon: Music2 },
  { kind: "drawing", label: "手绘", icon: PenLine },
  { kind: "activity", label: "活动", icon: Heart },
];

const kindDetails: Record<AttachmentKind, string> = {
  photo: "已选择一张照片 · 将在本机生成加密预览",
  video: "视频待上传 · 支持断点续传",
  audio: "00:18 · 语音保存在本机",
  location: "河畔步道 · 仅存入这篇手记",
  weather: "微风 · 21°C",
  mood: "今天的心情",
  music: "外部音乐链接 · 播放前会提示",
  drawing: "一幅手绘 · 笔画保存在本机",
  activity: "散步 4,821 步 · 手动记录",
};

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function localDate(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

function localTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function isShared(entry: JournalEntry): boolean {
  if (entry.visibility === "shared") return true;
  if (entry.visibility !== "scheduled" || !entry.publishAt) return false;
  return new Date(entry.publishAt).getTime() <= Date.now();
}

function createBlankDraft(): Draft {
  return {
    id: uid("draft"),
    title: "",
    body: "",
    visibility: "private",
    attachments: [],
    updatedAt: new Date().toISOString(),
  };
}

export function QijianApp() {
  const [tab, setTab] = useState<Tab>("today");
  const [sheet, setSheet] = useState<Sheet>("none");
  const [entries, setEntries] = useState<JournalEntry[]>(seedEntries);
  const [draft, setDraft] = useState<Draft>(() => createBlankDraft());
  const [selectedEntryId, setSelectedEntryId] = useState<string>(seedEntries[0].id);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [filter, setFilter] = useState<"shared" | "private" | "scheduled" | "drafts">("shared");
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [dark, setDark] = useState(false);
  const [showMemory, setShowMemory] = useState(true);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [cloudAccessKey, setCloudAccessKey] = useState("");
  const [cloudKeyInput, setCloudKeyInput] = useState("");
  const [cloudState, setCloudState] = useState<CloudState>("checking");
  const [cloudGateDismissed, setCloudGateDismissed] = useState(false);
  const initialized = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);

  useEffect(() => {
    const load = async () => {
      try {
        const [storedEntries, drafts] = await Promise.all([
          localVault.loadEntries(),
          localVault.loadDrafts(),
        ]);
        if (storedEntries.length > 0) setEntries(storedEntries);
        else await Promise.all(seedEntries.map((entry) => localVault.saveEntry(entry)));
        if (drafts.length > 0) {
          drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          setDraft(drafts[0]);
        }

        const savedKey = loadCloudAccessKey();
        if (!savedKey) {
          setCloudState("needs-key");
        } else {
          setCloudAccessKey(savedKey);
          setCloudKeyInput(savedKey);
          try {
            await verifyCloudAccess(savedKey);
            const cloudEntries = await loadCloudEntries(savedKey);
            const localEntries = storedEntries.length > 0 ? storedEntries : seedEntries;
            const merged = new Map(localEntries.map((entry) => [entry.id, entry]));
            for (const remote of cloudEntries) {
              const local = merged.get(remote.id);
              if (!local || remote.updatedAt >= local.updatedAt) merged.set(remote.id, remote);
            }
            const hydrated = await Promise.all(Array.from(merged.values()).map(async (entry) => ({
              ...entry,
              attachments: await Promise.all(entry.attachments.map(async (attachment) => {
                if (attachment.previewUrl || !attachment.cloudId) return attachment;
                const previewUrl = await loadCloudAttachmentPreview(savedKey, attachment).catch(() => undefined);
                return previewUrl ? { ...attachment, previewUrl } : attachment;
              })),
            })));
            setEntries(hydrated);
            await Promise.all(hydrated.map((entry) => localVault.saveEntry(entry)));
            setCloudState("connected");
          } catch {
            setCloudState("error");
          }
        }
      } catch {
        setNotice("本机加密存储暂时不可用，当前内容只会保留到本次打开结束。");
      } finally {
        initialized.current = true;
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const update = () => {
      const state = navigator.onLine;
      setOnline(state);
      if (!state) setSaveState("offline");
      else if (saveState === "offline") setSaveState("saved");
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [saveState]);

  useEffect(() => {
    if (!initialized.current) return;
    setSaveState(online ? "saving" : "offline");
    const timer = window.setTimeout(() => {
      void localVault
        .saveDraft({ ...draft, updatedAt: new Date().toISOString() })
        .then(() => setSaveState(online ? "saved" : "offline"))
        .catch(() => setNotice("没有保存成功，请先不要关闭这一页。"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, online]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const sharedEntries = useMemo(
    () => entries.filter((entry) => entry.status === "published" && isShared(entry)),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return entries
      .filter((entry) => entry.status === "published")
      .filter((entry) => {
        if (filter === "shared") return isShared(entry);
        if (filter === "private") return entry.visibility === "private";
        if (filter === "scheduled") {
          return entry.visibility === "scheduled" && !isShared(entry);
        }
        return false;
      })
      .filter((entry) =>
        normalized
          ? `${entry.title} ${entry.body} ${entry.mood ?? ""} ${entry.place ?? ""}`
              .toLowerCase()
              .includes(normalized)
          : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries, filter, search]);

  const memory = sharedEntries[0];

  const connectCloud = async () => {
    const nextKey = cloudKeyInput.trim();
    if (!nextKey) {
      setNotice("请输入共同空间口令。");
      return;
    }
    setCloudState("checking");
    try {
      await verifyCloudAccess(nextKey);
      saveCloudAccessKey(nextKey);
      setCloudAccessKey(nextKey);
      const remote = await loadCloudEntries(nextKey);
      setEntries((current) => {
        const merged = new Map(current.map((entry) => [entry.id, entry]));
        for (const entry of remote) {
          const local = merged.get(entry.id);
          if (!local || entry.updatedAt >= local.updatedAt) merged.set(entry.id, entry);
        }
        return Array.from(merged.values());
      });
      setCloudState("connected");
      setCloudGateDismissed(true);
      setNotice("已连接你们的加密云端空间。");
    } catch (error) {
      setCloudState("error");
      setNotice(error instanceof Error ? error.message : "无法连接云端空间。");
    }
  };

  const persistEntry = useCallback(async (entry: JournalEntry) => {
    setEntries((current) => {
      const existing = current.some((item) => item.id === entry.id);
      return existing
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [entry, ...current];
    });
    try {
      await localVault.saveEntry(entry);
      if (cloudAccessKey) await saveCloudEntry(cloudAccessKey, entry);
    } catch {
      setNotice(cloudAccessKey ? "已保存在本机，但云端同步暂时失败。" : "这次修改只保留在当前页面，请稍后再试。");
    }
  }, [cloudAccessKey]);

  const openEntry = (id: string) => {
    setSelectedEntryId(id);
    setSheet("entry");
  };

  const openCompose = () => {
    setSheet("compose");
    setAttachmentMenu(false);
  };

  const publishDraft = async () => {
    if (!draft.title.trim() && !draft.body.trim() && draft.attachments.length === 0) {
      setNotice("写下一点内容，或添加一份回忆后再发布。");
      return;
    }
    if (draft.visibility === "scheduled" && !draft.publishAt) {
      setNotice("请选择这页回忆开启的时间。");
      return;
    }
    const now = new Date().toISOString();
    const entry: JournalEntry = {
      id: uid("entry"),
      author: "我",
      title: draft.title.trim() || "未命名的一页",
      body: draft.body.trim(),
      createdAt: now,
      updatedAt: now,
      visibility: draft.visibility,
      publishAt: draft.publishAt,
      status: "published",
      attachments: draft.attachments,
      mood: draft.mood,
      place: draft.place,
      reactions: {},
      comments: [],
    };
    await persistEntry(entry);
    await localVault.deleteDraft(draft.id);
    setDraft(createBlankDraft());
    setSelectedEntryId(entry.id);
    setSheet("entry");
    setNotice(
      entry.visibility === "private"
        ? "这一页已安全收进你的私藏。"
        : entry.visibility === "scheduled"
          ? "这一页会在约定的时间开启。"
          : "这一页已加入你们的共同手记。",
    );
  };

  const addAttachment = (kind: AttachmentKind) => {
    if (kind === "photo" || kind === "video") {
      fileInput.current?.click();
      setAttachmentMenu(false);
      return;
    }
    const label = attachmentOptions.find((item) => item.kind === kind)?.label ?? "附件";
    const attachment: Attachment = {
      id: uid(kind),
      kind,
      label,
      detail: kindDetails[kind],
    };
    setDraft((current) => ({
      ...current,
      attachments: [...current.attachments, attachment],
      place: kind === "location" ? "河畔步道" : current.place,
    }));
    setAttachmentMenu(false);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    const next: Attachment[] = selected.map((file) => {
      const id = uid(file.type.startsWith("video/") ? "video" : "photo");
      return {
        id,
        kind: file.type.startsWith("video/") ? "video" : "photo",
        label: file.name || "来自相册的回忆",
        detail: `${Math.max(1, Math.round(file.size / 1024))} KB · ${cloudAccessKey ? "准备上传云端" : "已加入本机草稿"}`,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        cloudId: cloudAccessKey ? id : undefined,
        cloudState: cloudAccessKey ? "uploading" : undefined,
        mimeType: file.type,
        size: file.size,
      };
    });
    setDraft((current) => ({ ...current, attachments: [...current.attachments, ...next] }));

    if (cloudAccessKey) {
      selected.forEach((file, index) => {
        const attachment = next[index];
        void uploadCloudAttachment(cloudAccessKey, attachment.id, file, (completed, total) => {
          setDraft((current) => ({
            ...current,
            attachments: current.attachments.map((item) => item.id === attachment.id
              ? { ...item, detail: `正在上传云端 · ${completed}/${total}` }
              : item),
          }));
        }).then((cloud) => {
          setDraft((current) => ({
            ...current,
            attachments: current.attachments.map((item) => item.id === attachment.id
              ? { ...item, ...cloud, detail: `${Math.max(1, Math.round(file.size / 1024))} KB · 已安全上传` }
              : item),
          }));
        }).catch(() => {
          setDraft((current) => ({
            ...current,
            attachments: current.attachments.map((item) => item.id === attachment.id
              ? { ...item, cloudState: "failed", detail: "云端上传失败 · 文件仍保留在本机" }
              : item),
          }));
        });
      });
    }
  };

  const addReaction = async (emoji: string) => {
    if (!selectedEntry) return;
    const next = {
      ...selectedEntry,
      reactions: {
        ...selectedEntry.reactions,
        [emoji]: (selectedEntry.reactions[emoji] ?? 0) + 1,
      },
    };
    await persistEntry(next);
  };

  const addComment = async () => {
    if (!selectedEntry || !comment.trim()) return;
    const next: JournalEntry = {
      ...selectedEntry,
      comments: [
        ...selectedEntry.comments,
        {
          id: uid("comment"),
          author: "我",
          body: comment.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await persistEntry(next);
    setComment("");
  };

  const moveToTrash = async (entry: JournalEntry) => {
    await persistEntry({ ...entry, status: "trash", updatedAt: new Date().toISOString() });
    setSheet("none");
    setNotice("这页已移到回收站，30 天内可以恢复。");
  };

  const restoreEntry = async (entry: JournalEntry) => {
    await persistEntry({ ...entry, status: "published", updatedAt: new Date().toISOString() });
    setNotice("这页已经回到原来的位置。");
  };

  return (
    <main className={dark ? "qijian-app dark" : "qijian-app"}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="phone-shell">
        <header className="topbar">
          <button className="brand" onClick={() => setTab("today")} aria-label="回到今日">
            <span className="brand-mark"><Feather size={18} /></span>
            <span><strong>栖笺</strong><small>PRIVATE JOURNAL</small></span>
          </button>
          <div className="top-actions">
            {!online && <span className="offline-chip"><CloudOff size={13} /> 离线</span>}
            {online && cloudState === "connected" && <span className="cloud-chip"><Cloud size={13} /> 已同步</span>}
            <button className="icon-button" onClick={() => setSheet("notifications")} aria-label="通知">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <button className="avatar" onClick={() => setTab("us")} aria-label="我们的空间">
              <span>栖</span><span>安</span>
            </button>
          </div>
        </header>

        <section className="content" aria-live="polite">
          {tab === "today" && (
            <TodayView
              memory={memory}
              entries={sharedEntries}
              showMemory={showMemory}
              onHideMemory={() => setShowMemory(false)}
              onOpen={openEntry}
              onCompose={openCompose}
            />
          )}
          {tab === "journals" && (
            <JournalsView
              entries={filteredEntries}
              filter={filter}
              search={search}
              draft={draft}
              onFilter={setFilter}
              onSearch={setSearch}
              onOpen={openEntry}
              onCompose={openCompose}
            />
          )}
          {tab === "calendar" && (
            <CalendarView entries={entries.filter((entry) => entry.status === "published")} onOpen={openEntry} />
          )}
          {tab === "us" && (
            <UsView
              dark={dark}
              onDark={setDark}
              onSettings={() => setSheet("settings")}
              onTrash={() => setSheet("trash")}
            />
          )}
        </section>

        <nav className="bottom-nav" aria-label="主要导航">
          <NavButton active={tab === "today"} label="今日" icon={Sparkles} onClick={() => setTab("today")} />
          <NavButton active={tab === "journals"} label="手记" icon={BookHeart} onClick={() => setTab("journals")} />
          <button className="compose-fab" onClick={openCompose} aria-label="新建手记"><Plus size={27} /></button>
          <NavButton active={tab === "calendar"} label="日历" icon={CalendarDays} onClick={() => setTab("calendar")} />
          <NavButton active={tab === "us"} label="我们" icon={Heart} onClick={() => setTab("us")} />
        </nav>
      </div>

      {sheet !== "none" && <button className="sheet-backdrop" onClick={() => setSheet("none")} aria-label="关闭弹出页面" />}
      {sheet === "compose" && (
        <ComposeSheet
          draft={draft}
          saveState={saveState}
          attachmentMenu={attachmentMenu}
          fileInput={fileInput}
          onDraft={setDraft}
          onClose={() => setSheet("none")}
          onPublish={() => void publishDraft()}
          onToggleAttachment={() => setAttachmentMenu((value) => !value)}
          onAttachment={addAttachment}
          onFiles={handleFiles}
        />
      )}
      {sheet === "entry" && selectedEntry && (
        <EntrySheet
          entry={selectedEntry}
          comment={comment}
          onComment={setComment}
          onSend={() => void addComment()}
          onReact={(emoji) => void addReaction(emoji)}
          onTrash={() => void moveToTrash(selectedEntry)}
          onClose={() => setSheet("none")}
        />
      )}
      {sheet === "notifications" && <NotificationsSheet onClose={() => setSheet("none")} />}
      {sheet === "trash" && (
        <TrashSheet
          entries={entries.filter((entry) => entry.status === "trash")}
          onRestore={(entry) => void restoreEntry(entry)}
          onClose={() => setSheet("none")}
        />
      )}
      {sheet === "settings" && <SettingsSheet onClose={() => setSheet("none")} />}

      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="关闭提示"><X size={15} /></button>
        </div>
      )}
      {!cloudGateDismissed && (cloudState === "needs-key" || cloudState === "error" || cloudState === "checking") && (
        <CloudGate
          value={cloudKeyInput}
          state={cloudState}
          onValue={setCloudKeyInput}
          onConnect={() => void connectCloud()}
          onLocal={() => setCloudGateDismissed(true)}
        />
      )}
    </main>
  );
}

function CloudGate({ value, state, onValue, onConnect, onLocal }: { value: string; state: CloudState; onValue: (value: string) => void; onConnect: () => void; onLocal: () => void }) {
  return (
    <div className="cloud-gate" role="dialog" aria-modal="true" aria-label="连接共同空间">
      <div className="cloud-gate-card">
        <span className="cloud-gate-icon"><Cloud size={27} /></span>
        <h2>连接你们的共同空间</h2>
        <p>在两台 iPhone 上输入同一个口令，手记会存入 D1，照片、视频和语音会安全传到私有 R2。</p>
        <input
          type="password"
          value={value}
          onChange={(event) => onValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") onConnect(); }}
          placeholder="共同空间口令"
          autoComplete="current-password"
        />
        <button className="cloud-connect" onClick={onConnect} disabled={state === "checking"}>
          {state === "checking" ? "正在连接…" : "连接并同步"}
        </button>
        <button className="cloud-local" onClick={onLocal}>暂时只在本机体验</button>
        <small><LockKeyhole size={12} /> R2 文件不公开，不生成公共下载链接</small>
      </div>
    </div>
  );
}

function NavButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof Heart; onClick: () => void }) {
  return <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}><Icon size={20} /><span>{label}</span></button>;
}

function TodayView({ memory, entries, showMemory, onHideMemory, onOpen, onCompose }: { memory?: JournalEntry; entries: JournalEntry[]; showMemory: boolean; onHideMemory: () => void; onOpen: (id: string) => void; onCompose: () => void }) {
  return (
    <div className="view today-view">
      <div className="hero-copy">
        <div className="date-kicker">{todayLabel()}</div>
        <h1>今天</h1>
        <p>把此刻留给未来，也留给彼此。</p>
      </div>
      <button className="write-card" onClick={onCompose}>
        <span className="write-icon"><Plus size={24} /></span>
        <span><strong>新建手记</strong><small>照片、文字、语音，或一句想说的话</small></span>
        <span className="write-arrow"><ChevronRight size={18} /></span>
      </button>

      {showMemory && memory && (
        <section className="memory-card">
          <button className="memory-visual" onClick={() => onOpen(memory.id)} aria-label="打开那年今日">
            <span className="memory-badge"><Sparkles size={14} /> 那年今日</span>
            <span className="memory-date">8月<br /><strong>12日</strong></span>
          </button>
          <div className="memory-summary">
            <button className="memory-copy" onClick={() => onOpen(memory.id)}>
              <span>一年前</span>
              <strong>{memory.title}</strong>
              <small>{memory.body}</small>
            </button>
            <button className="quiet-action" onClick={onHideMemory} aria-label="暂时不看"><MoreHorizontal size={20} /></button>
          </div>
        </section>
      )}

      <section className="memory-flow">
        <div className="section-heading"><div><span className="eyebrow">我们的最近</span><h2>共同回忆</h2></div><span>{entries.length} 页</span></div>
        <div className="entry-list">
          {entries.map((entry, index) => <EntryCard key={entry.id} entry={entry} featured={index === 0} onOpen={onOpen} />)}
        </div>
      </section>
    </div>
  );
}

function EntryCard({ entry, featured, onOpen }: { entry: JournalEntry; featured?: boolean; onOpen: (id: string) => void }) {
  return (
    <button className={featured ? "entry-card featured" : "entry-card"} onClick={() => onOpen(entry.id)}>
      <div className="entry-visual" aria-hidden="true"><span>{entry.place ?? "共同回忆"}</span></div>
      <div className="entry-card-body">
      <div className="entry-meta"><span>{entry.author}</span><time>{localDate(entry.createdAt)} · {localTime(entry.createdAt)}</time></div>
      <h3>{entry.title}</h3>
      <p>{entry.body}</p>
      {entry.attachments.length > 0 && (
        <div className="attachment-strip">
          {entry.attachments.slice(0, 3).map((attachment) => <AttachmentPill key={attachment.id} attachment={attachment} />)}
        </div>
      )}
      <div className="entry-footer">
        <span>{entry.mood ? `心情 · ${entry.mood}` : "一页手记"}</span>
        <span><Heart size={14} /> {Object.values(entry.reactions).reduce((sum, value) => sum + value, 0)} <MessageCircle size={14} /> {entry.comments.length}</span>
      </div>
      </div>
    </button>
  );
}

function AttachmentPill({ attachment }: { attachment: Attachment }) {
  const option = attachmentOptions.find((item) => item.kind === attachment.kind);
  const Icon = option?.icon ?? Link2;
  return <span className="attachment-pill"><Icon size={13} /> {attachment.label}</span>;
}

function JournalsView({ entries, filter, search, draft, onFilter, onSearch, onOpen, onCompose }: { entries: JournalEntry[]; filter: "shared" | "private" | "scheduled" | "drafts"; search: string; draft: Draft; onFilter: (value: "shared" | "private" | "scheduled" | "drafts") => void; onSearch: (value: string) => void; onOpen: (id: string) => void; onCompose: () => void }) {
  const tabs = [["shared", "我们的"], ["private", "我的私藏"], ["scheduled", "待开启"], ["drafts", "草稿"]] as const;
  return (
    <div className="view journals-view">
      <div className="page-title"><span className="eyebrow">OUR JOURNALS</span><h1>手记</h1><p>共享的与私藏的，都各自在正确的位置。</p></div>
      <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="在本机搜索已解锁的内容" /></label>
      <div className="segmented">{tabs.map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => onFilter(value)}>{label}</button>)}</div>
      {filter === "drafts" ? (
        <button className="draft-card" onClick={onCompose}><span><PenLine size={19} /></span><div><strong>{draft.title || "未命名草稿"}</strong><p>{draft.body || "从这里继续写下去……"}</p><small>已安全保存到本机</small></div><ChevronRight size={18} /></button>
      ) : entries.length ? (
        <div className="entry-list">{entries.map((entry) => <EntryCard key={entry.id} entry={entry} onOpen={onOpen} />)}</div>
      ) : (
        <div className="empty-state"><BookHeart size={28} /><h3>这里还没有内容</h3><p>{filter === "scheduled" ? "约定时间开启的手记会出现在这里。" : "写下第一篇，让这一栏慢慢长出来。"}</p><button onClick={onCompose}>开始写</button></div>
      )}
    </div>
  );
}

function CalendarView({ entries, onOpen }: { entries: JournalEntry[]; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 31 }, (_, index) => index + 1);
  const marked = new Set(entries.map((entry) => new Date(entry.createdAt).getDate()));
  return (
    <div className="view calendar-view">
      <div className="page-title"><span className="eyebrow">AUGUST 2026</span><h1>八月</h1><p>回忆按日期安静地落在这里。</p></div>
      <section className="calendar-card"><div className="calendar-header"><button aria-label="上个月"><ChevronLeft size={18} /></button><strong>2026 年 8 月</strong><button aria-label="下个月"><ChevronRight size={18} /></button></div><div className="week-row">{"一二三四五六日".split("").map((day) => <span key={day}>{day}</span>)}</div><div className="day-grid"><span /><span /><span /><span /><span />{days.map((day) => <button key={day} className={marked.has(day) ? "marked" : ""}>{day}{marked.has(day) && <i />}</button>)}</div></section>
      <div className="section-heading"><div><span className="eyebrow">最近写下</span><h2>这个月的手记</h2></div></div>
      <div className="timeline">{entries.slice(0, 4).map((entry) => <button key={entry.id} onClick={() => onOpen(entry.id)}><time>{new Date(entry.createdAt).getDate()}</time><span><strong>{entry.title}</strong><small>{entry.author} · {entry.mood ?? "一页手记"}</small></span><ChevronRight size={17} /></button>)}</div>
    </div>
  );
}

function UsView({ dark, onDark, onSettings, onTrash }: { dark: boolean; onDark: (value: boolean) => void; onSettings: () => void; onTrash: () => void }) {
  return (
    <div className="view us-view">
      <div className="page-title"><span className="eyebrow">JUST FOR TWO</span><h1>我们的空间</h1><p>两个人，和一处安静保存日常的地方。</p></div>
      <section className="couple-card"><div className="couple-orbit"><span>栖</span><i><Heart size={15} fill="currentColor" /></i><span>安</span></div><strong>在一起的第 1,284 天</strong><p>共同写下 42 页 · 留下 118 次回应</p></section>
      <section className="settings-group">
        <button><span className="setting-icon sage"><ShieldCheck size={19} /></span><span><strong>安全与设备</strong><small>恢复短语、设备验证、登录记录</small></span><ChevronRight size={18} /></button>
        <button onClick={() => onDark(!dark)}><span className="setting-icon violet"><Palette size={19} /></span><span><strong>暮纸主题</strong><small>{dark ? "深色墨夜" : "跟随温暖纸白"}</small></span><span className={dark ? "switch on" : "switch"}><i /></span></button>
        <button onClick={onSettings}><span className="setting-icon amber"><Bell size={19} /></span><span><strong>通知与安静时段</strong><small>默认只提示“有一份新心意”</small></span><ChevronRight size={18} /></button>
        <button onClick={onTrash}><span className="setting-icon rose"><ArchiveRestore size={19} /></span><span><strong>回收站</strong><small>删除的内容保留 30 天</small></span><ChevronRight size={18} /></button>
      </section>
      <div className="privacy-note"><LockKeyhole size={18} /><div><strong>内容先在设备上加密</strong><p>当前演示数据保存在这台设备的加密本机空间。接入服务器后，服务器也只保存密文。</p></div></div>
    </div>
  );
}

function ComposeSheet({ draft, saveState, attachmentMenu, fileInput, onDraft, onClose, onPublish, onToggleAttachment, onAttachment, onFiles }: { draft: Draft; saveState: SaveState; attachmentMenu: boolean; fileInput: React.RefObject<HTMLInputElement | null>; onDraft: (value: Draft | ((current: Draft) => Draft)) => void; onClose: () => void; onPublish: () => void; onToggleAttachment: () => void; onAttachment: (kind: AttachmentKind) => void; onFiles: (files: FileList | null) => void }) {
  return (
    <section className="sheet compose-sheet" role="dialog" aria-modal="true" aria-label="新建手记">
      <header className="sheet-header editor-header">
        <button className="round-button editor-back" onClick={onClose} aria-label="返回"><ChevronLeft size={25} /></button>
        <div className="editor-actions"><button>格式</button><button aria-label="书写工具"><PenLine size={20} /></button><button aria-label="更多选项"><MoreHorizontal size={22} /></button></div>
        <button className="done-button" onClick={onPublish} aria-label="完成"><Check size={27} /></button>
      </header>
      <div className="compose-body">
        <div className={`compose-date save-state ${saveState}`}><span />{todayLabel()} · {saveState === "saving" ? "正在保存" : saveState === "offline" ? "已存本机，等待网络" : "已自动保存"}</div>
        <input className="title-input" value={draft.title} onChange={(event) => onDraft((current) => ({ ...current, title: event.target.value }))} placeholder="给这一页一个名字" aria-label="手记标题" />
        <textarea className="body-input" value={draft.body} onChange={(event) => onDraft((current) => ({ ...current, body: event.target.value }))} placeholder="写下一点此刻……" aria-label="手记正文" />
        {draft.attachments.length > 0 && <div className="draft-attachments">{draft.attachments.map((attachment) => <div key={attachment.id} className="draft-attachment">{attachment.previewUrl ? <img src={attachment.previewUrl} alt={attachment.label} /> : <AttachmentPill attachment={attachment} />}<span>{attachment.detail}</span><button aria-label={`移除${attachment.label}`} onClick={() => onDraft((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id) }))}><X size={15} /></button></div>)}</div>}
        <div className="mood-row"><span>此刻心情</span><div>{moods.map((mood) => <button key={mood} className={draft.mood === mood ? "active" : ""} onClick={() => onDraft((current) => ({ ...current, mood }))}>{mood}</button>)}</div></div>
        <div className="visibility-panel"><span>谁可以看到</span><div>{(["private", "shared", "scheduled"] as Visibility[]).map((visibility) => <button key={visibility} className={draft.visibility === visibility ? "active" : ""} onClick={() => onDraft((current) => ({ ...current, visibility }))}>{visibility === "private" ? <LockKeyhole size={16} /> : visibility === "shared" ? <Heart size={16} /> : <CalendarDays size={16} />}<span>{visibility === "private" ? "仅自己" : visibility === "shared" ? "现在共享" : "定时开启"}</span></button>)}</div>{draft.visibility === "scheduled" && <input type="datetime-local" value={draft.publishAt?.slice(0, 16) ?? ""} onChange={(event) => onDraft((current) => ({ ...current, publishAt: new Date(event.target.value).toISOString() }))} aria-label="公开时间" />}</div>
      </div>
      <footer className="compose-toolbar"><button className={attachmentMenu ? "active" : ""} onClick={onToggleAttachment} aria-label="添加内容"><Plus size={20} /></button><button onClick={() => onAttachment("photo")} aria-label="添加照片"><ImageIcon size={20} /></button><button onClick={() => onAttachment("audio")} aria-label="录制语音"><AudioLines size={20} /></button><button onClick={() => onAttachment("location")} aria-label="添加位置"><MapPin size={20} /></button><button onClick={() => onAttachment("music")} aria-label="添加音乐"><Music2 size={20} /></button></footer>
      {attachmentMenu && <div className="attachment-menu">{attachmentOptions.map(({ kind, label, icon: Icon }) => <button key={kind} onClick={() => onAttachment(kind)}><span><Icon size={19} /></span>{label}</button>)}</div>}
      <input ref={fileInput} className="visually-hidden" type="file" accept="image/*,video/*" multiple onChange={(event) => onFiles(event.target.files)} />
    </section>
  );
}

function EntrySheet({ entry, comment, onComment, onSend, onReact, onTrash, onClose }: { entry: JournalEntry; comment: string; onComment: (value: string) => void; onSend: () => void; onReact: (emoji: string) => void; onTrash: () => void; onClose: () => void }) {
  return (
    <section className="sheet entry-sheet" role="dialog" aria-modal="true" aria-label={entry.title}>
      <header className="sheet-header reader-header"><button className="round-button" onClick={onClose}><ChevronLeft size={24} /></button><span className={`visibility-badge ${entry.visibility}`}><LockKeyhole size={13} />{entry.visibility === "private" ? "仅自己" : entry.visibility === "scheduled" && !isShared(entry) ? "待开启" : "已共享"}</span><button className="round-button danger" onClick={onTrash} aria-label="移到回收站"><MoreHorizontal size={22} /></button></header>
      <article className="entry-content"><div className="reader-hero" aria-hidden="true" /><div className="entry-byline"><span className="author-seal">{entry.author === "我" ? "栖" : "安"}</span><div><strong>{entry.author}</strong><time>{localDate(entry.createdAt)} · {localTime(entry.createdAt)}{entry.edited && " · 已编辑"}</time></div></div><h1>{entry.title}</h1><p>{entry.body}</p>{entry.attachments.map((attachment) => <div className="content-attachment" key={attachment.id}>{attachment.previewUrl ? <img src={attachment.previewUrl} alt={attachment.label} /> : <><AttachmentPill attachment={attachment} /><small>{attachment.detail}</small></>}</div>)}{entry.mood && <div className="mood-display"><span>此刻心情</span><strong>{entry.mood}</strong></div>}</article>
      {isShared(entry) && <section className="responses"><div className="reaction-row">{reactions.map((reaction) => <button key={reaction} onClick={() => onReact(reaction)} className={entry.reactions[reaction] ? "active" : ""}>{reaction} {entry.reactions[reaction] || ""}</button>)}</div><div className="comments"><h2>回应 <span>{entry.comments.length}</span></h2>{entry.comments.map((item) => <div className="comment" key={item.id}><span>{item.author === "我" ? "栖" : "安"}</span><div><strong>{item.author}<time>{localTime(item.createdAt)}</time></strong>{item.quotedText && <blockquote>{item.quotedText}</blockquote>}<p>{item.body}</p></div></div>)}</div><div className="comment-box"><button aria-label="语音回复"><Mic size={18} /></button><input value={comment} onChange={(event) => onComment(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSend(); }} placeholder="留下一句回应……" /><button onClick={onSend} aria-label="发送回应"><Send size={18} /></button></div></section>}
    </section>
  );
}

function NotificationsSheet({ onClose }: { onClose: () => void }) {
  return <section className="sheet compact-sheet" role="dialog" aria-modal="true" aria-label="通知"><div className="sheet-handle" /><header className="sheet-title"><div><span className="eyebrow">A QUIET NOTE</span><h2>新心意</h2></div><button onClick={onClose}><X size={20} /></button></header><div className="notification-list"><div><span className="notification-icon"><Heart size={18} /></span><p><strong>你收到了一份新心意</strong><small>解锁后可以查看 · 12 分钟前</small></p><i /></div><div><span className="notification-icon"><MessageCircle size={18} /></span><p><strong>栖笺里有一条新的回应</strong><small>内容不会显示在锁屏通知中 · 昨天</small></p></div><div><span className="notification-icon"><ShieldCheck size={18} /></span><p><strong>本机草稿受到加密保护</strong><small>服务器接入后也只会保存密文</small></p></div></div></section>;
}

function TrashSheet({ entries, onRestore, onClose }: { entries: JournalEntry[]; onRestore: (entry: JournalEntry) => void; onClose: () => void }) {
  return <section className="sheet compact-sheet" role="dialog" aria-modal="true" aria-label="回收站"><div className="sheet-handle" /><header className="sheet-title"><div><span className="eyebrow">30 DAYS TO RESTORE</span><h2>回收站</h2></div><button onClick={onClose}><X size={20} /></button></header>{entries.length ? <div className="trash-list">{entries.map((entry) => <div key={entry.id}><span><strong>{entry.title}</strong><small>29 天后自动清理</small></span><button onClick={() => onRestore(entry)}><ArchiveRestore size={16} /> 恢复</button></div>)}</div> : <div className="empty-state"><ArchiveRestore size={28} /><h3>这里很干净</h3><p>删除的内容会在这里保留 30 天。</p></div>}</section>;
}

function SettingsSheet({ onClose }: { onClose: () => void }) {
  return <section className="sheet compact-sheet" role="dialog" aria-modal="true" aria-label="设置"><div className="sheet-handle" /><header className="sheet-title"><div><span className="eyebrow">PRIVACY FIRST</span><h2>通知与网页能力</h2></div><button onClick={onClose}><X size={20} /></button></header><div className="capability-list"><div><Check size={17} /><p><strong>应用内通知</strong><small>新手记、评论和安全事件都有温和提示。</small></p></div><div><Bell size={17} /><p><strong>主屏幕网页推送</strong><small>添加到 iPhone 主屏幕后，由你点击按钮开启。</small></p></div><div><Settings2 size={17} /><p><strong>系统小组件</strong><small>网页第一版使用应用内卡片；未来原生版再接入 WidgetKit。</small></p></div><div><ShieldCheck size={17} /><p><strong>设备验证</strong><small>网页通过 Passkey 请求系统验证，具体可能是 Face ID、Touch ID 或设备密码。</small></p></div></div></section>;
}
