import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building2, CheckCircle2, Clock, ExternalLink, ListChecks, PartyPopper, ShieldAlert, ThumbsDown } from "lucide-react";
import { useReviews, getMaskedName } from "../context/ReviewsContext";
import { classifyCategory, getDepartmentForCategory } from "../utils/csvParser";
import { Review } from "../data/classifiedReviews";
import { Incident } from "../data/initialIncidents";

// "처리완료로 표시"는 원본 데이터(Review/Incident)를 건드리지 않고 별도의 로컬 확인됨 id 집합으로만
// 관리한다 — CSV를 다시 업로드해도(원본 데이터가 새 배열로 교체돼도) 이 표시가 사라지지 않게 하기 위함.
const RESOLVED_ACTION_IDS_STORAGE_KEY = "honestflower_resolvedActionIds";

function loadResolvedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(RESOLVED_ACTION_IDS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveResolvedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(RESOLVED_ACTION_IDS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

interface ActionItem {
  key: string;
  type: "review" | "incident";
  product: string;
  customer: string;
  date: string;
  summary: string;
  department: string;
  targetId: string;
  adminLink?: string;
  importChannel?: "일반" | "플라워고";
}

export default function ActionBoardTab() {
  const { reviews, incidents, setActiveTab, setHighlightTargetId } = useReviews();
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => loadResolvedIds());

  useEffect(() => {
    saveResolvedIds(resolvedIds);
  }, [resolvedIds]);

  const items: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [];

    // (1) 상태가 "접수중"인 사고접수 전체
    incidents.forEach((inc: Incident) => {
      if (inc.incidentStatus !== "접수중") return;
      const key = `incident-${inc.id}`;
      if (resolvedIds.has(key)) return;
      const category = classifyCategory(inc.claimText || "", 0, undefined);
      list.push({
        key,
        type: "incident",
        product: inc.product,
        customer: getMaskedName(parseInt(inc.id.replace(/\D/g, ""), 10) || 0, inc.rawReviewer || inc.reviewer || inc.customerName),
        date: inc.date,
        summary: inc.claimText || inc.accidentDetail || inc.accidentType || "사고접수 내용 없음",
        department: getDepartmentForCategory(category),
        targetId: inc.id,
        adminLink: inc.orderNumber ? `https://admin.honestflower.kr/orders/${inc.orderNumber}` : undefined,
        importChannel: inc.importChannel,
      });
    });

    // (2) 비추천(또는 rating<=2) 리뷰 중 exposed === true(=아직 노출 중=아직 CX가 조치 안 한 것)인 것.
    // "미처리"의 기준은 incidentStatus 유무가 아니라 노출여부다 — 노출이 꺼지면(exposed === false)
    // 어드민이 이미 확인·조치한 것으로 간주해 대기열에서 자동으로 빠진다(ReviewArchiveTab에는
    // "CX 조치완료(비공개 처리)" 배지로 계속 남아 있어 내부 VOC로는 계속 확인 가능). "처리완료로 표시"
    // 수동 버튼은 노출여부가 애매한 경우를 위한 수동 오버라이드로 그대로 유지한다.
    reviews.forEach((r: Review) => {
      const isNegative = r.type === "비추천" || (r.rating > 0 && r.rating <= 2);
      if (!isNegative) return;
      if (r.exposed !== true) return;
      const key = `review-${r.id}`;
      if (resolvedIds.has(key)) return;
      list.push({
        key,
        type: "review",
        product: r.product,
        customer: r.reviewer || getMaskedName(r.id, r.rawReviewer),
        date: r.date,
        summary: r.review || "",
        department: getDepartmentForCategory(r.category),
        targetId: String(r.id),
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [reviews, incidents, resolvedIds]);

  const deptSummary = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => map.set(i.department, (map.get(i.department) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const markResolved = (key: string) => {
    setResolvedIds(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const goToTarget = (item: ActionItem) => {
    setHighlightTargetId(item.targetId);
    setActiveTab(item.type === "review" ? "archive" : "incidents");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-2 mb-4">
          <ListChecks className="h-5 w-5 text-rose-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">담당부서별 미처리 건수</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              접수중 사고접수 + 노출 중인 비추천 리뷰를 담당부서 기준으로 집계한 요약입니다.
            </p>
          </div>
        </div>

        {deptSummary.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">지금 처리할 이슈가 없습니다 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {deptSummary.map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between p-3.5 rounded-lg border border-rose-100 bg-rose-50/30">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-bold text-slate-800">{dept}</span>
                </div>
                <span className="inline-flex items-center rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-black text-white">
                  {count}건
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">처리해야 할 이슈</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">최신순 · 총 {items.length}건</p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <PartyPopper className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">지금 처리할 이슈가 없습니다 🎉</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.key} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 hover:border-slate-300 transition space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {item.type === "incident" ? (
                    <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold border bg-amber-100 text-amber-800 border-amber-200">
                      <Clock className="h-3 w-3" /> 사고접수 (접수중)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold border bg-red-100 text-red-800 border-red-200">
                      <ThumbsDown className="h-3 w-3" /> 비추천 리뷰 (노출중)
                    </span>
                  )}
                  {item.importChannel === "플라워고" && (
                    <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-extrabold border bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200">
                      플라워고
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-900">{item.product}</span>
                  <span className="text-[11px] text-slate-400">{item.customer} · {item.date}</span>
                  <span className="ml-auto inline-flex items-center rounded-md bg-brand-green-light px-2 py-0.5 text-[10px] font-bold text-brand-green-dark">
                    {item.department}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{item.summary}</p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => goToTarget(item)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    원본 보기
                  </button>
                  {item.adminLink && (
                    <a
                      href={item.adminLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-700 transition"
                    >
                      <ExternalLink className="h-3 w-3" /> 어드민에서 보기
                    </a>
                  )}
                  <button
                    onClick={() => markResolved(item.key)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-bold transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> 처리완료로 표시
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
