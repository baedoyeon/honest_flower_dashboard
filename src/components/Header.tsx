import { useEffect, useRef, useState } from "react";
import { Calendar, Bell, ThumbsDown, ShieldAlert, ArrowUpRightSquare, CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useReviews } from "../context/ReviewsContext";
import { AppNotification, EMPTY_NOTIFICATION_SNAPSHOT, generateNotifications, NotificationSnapshot } from "../utils/notificationEngine";

// Helper: Get current date in KST (YYYY.MM.DD)
function getKSTDateString(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (3600000 * 9));
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, "0");
  const dd = String(kst.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

// 알림 인박스(개별 알림 read 상태 포함)와, "새로 반영된 것" 판단에 쓰는 이전 스냅샷을 각각
// localStorage에 지속 저장한다 — 새로고침/재접속해도 안읽음 카운트와 읽음 처리가 유지되도록.
const NOTIFICATIONS_STORAGE_KEY = "honestflower_notifications";
const NOTIFICATION_SNAPSHOT_STORAGE_KEY = "honestflower_notificationSnapshot";
const MAX_STORED_NOTIFICATIONS = 200;

function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function saveNotifications(list: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_STORED_NOTIFICATIONS)));
  } catch {
    // ignore
  }
}

// null = 아직 한 번도 스냅샷을 저장한 적 없음(최초 방문) — 이 경우 현재 데이터를 baseline으로만
// 잡고 알림은 생성하지 않는다. 그렇지 않으면 최초 로드 때 이미 있던 시드 데이터가 전부 "신규 알림"
// 으로 쏟아져 나오게 된다.
function loadSnapshot(): NotificationSnapshot | null {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SNAPSHOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationSnapshot) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: NotificationSnapshot): void {
  try {
    localStorage.setItem(NOTIFICATION_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

function NotificationCenter() {
  const { reviews, incidents, setActiveTab, setWeekFilter, setHighlightTargetId } = useReviews();
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadNotifications());
  const [open, setOpen] = useState(false);
  const snapshotRef = useRef<NotificationSnapshot | null>(loadSnapshot());

  useEffect(() => {
    if (snapshotRef.current === null) {
      // 최초 방문: 지금 데이터를 baseline으로만 기록하고 알림은 만들지 않음.
      const baseline: NotificationSnapshot = {
        knownNegativeReviewIds: reviews.filter(r => r.type === "비추천" || (r.rating > 0 && r.rating <= 2)).map(r => r.id),
        incidentStatusById: Object.fromEntries(incidents.map(inc => [inc.id, inc.incidentStatus])),
      };
      snapshotRef.current = baseline;
      saveSnapshot(baseline);
      return;
    }

    const { notifications: newOnes, snapshot } = generateNotifications(reviews, incidents, snapshotRef.current);
    snapshotRef.current = snapshot;
    saveSnapshot(snapshot);

    if (newOnes.length > 0) {
      setNotifications(prev => {
        const merged = [...newOnes, ...prev];
        saveNotifications(merged);
        return merged;
      });
    }
    // reviews/incidents는 CSV 업로드/새로고침으로 원본 데이터가 바뀔 때만 새 배열 참조를 갖는다
    // (ReviewsContext의 useMemo 기반 dedup 결과) — 그래서 이 effect가 "데이터가 실제로 바뀌었을 때"만 돈다.
  }, [reviews, incidents]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => (n.id === id ? { ...n, read: true } : n));
      saveNotifications(updated);
      return updated;
    });
  };

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  };

  const handleClickNotification = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    if (n.type === "review") {
      setHighlightTargetId(n.targetId);
      setActiveTab("archive");
    } else {
      // 사고접수 탭은 주차 필터(weekFilter)의 영향을 받으므로, 대상이 필터에 가려 안 보이는 일이
      // 없도록 전체 기간으로 전환한 뒤 이동한다.
      setWeekFilter("all");
      setHighlightTargetId(n.targetId);
      setActiveTab("incidents");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="relative flex items-center justify-center h-9 w-9 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl shadow-xs transition duration-200 cursor-pointer"
        title="알림센터"
        aria-label="알림센터"
      >
        <Bell className={`h-4 w-4 ${unreadCount > 0 ? "text-rose-600" : "text-slate-500"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-40 w-80 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <span className="text-xs font-bold text-slate-800">알림 ({unreadCount}건 안읽음)</span>
              {notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <CheckCheck className="h-3 w-3" /> 모두 읽음
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">아직 알림이 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.slice(0, 50).map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-2.5 transition cursor-pointer hover:bg-slate-50 ${!n.read ? "bg-rose-50/40" : ""}`}
                  >
                    <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${n.type === "review" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                      {n.type === "review" ? <ThumbsDown className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-800 truncate">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.detail}</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                        <span>{n.occurredAt}</span>
                        <ArrowUpRightSquare className="h-2.5 w-2.5" />
                        <span>{n.type === "review" ? "원본 후기 아카이브로 이동" : "사고접수 탭으로 이동"}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Header() {
  const todayStr = getKSTDateString();

  return (
    <header className="bg-white border-b border-slate-200 shrink-0">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            {/* Beautiful Honest Flower Trademark Replica from PDF */}
            <div className="flex flex-col justify-center bg-brand-green px-5 py-3.5 rounded-2xl shrink-0 shadow-lg shadow-brand-green/20 text-white select-none transition-transform hover:scale-105 duration-300 w-fit">
              <span className="text-[8px] font-bold tracking-wider opacity-90 leading-none font-sans uppercase">
                Flowers make feel better.
              </span>
              <span className="text-lg font-black tracking-widest uppercase mt-1.5 font-sans leading-none">
                HONEST FLOWER
              </span>
            </div>

            {/* Brand Category Badge under the Trademark */}
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-full bg-brand-green-light px-2.5 py-0.5 text-[10px] font-bold text-brand-green-dark uppercase tracking-wider">
                CX & QUALITY VOC REPORT
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
            {/* Notification center bell */}
            <NotificationCenter />

            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {todayStr} 기준
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
