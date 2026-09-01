import { motion } from "motion/react";
import { CheckCircle2, Clock, ExternalLink, PartyPopper, ShieldAlert, ThumbsDown } from "lucide-react";
import { useReviews } from "../context/ReviewsContext";

export default function ActionBoardTab() {
  const { actionItems: items, resolveActionItem, setActiveTab, setHighlightTargetId } = useReviews();

  const goToTarget = (item: (typeof items)[number]) => {
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
                  {/* 사고접수는 ProblemForm의 상태값(처리완료/반려됨/최종반려됨)만으로 자동 처리되므로
                      수동 버튼이 없다. 리뷰는 "답변 달았는지"를 CSV로 확인할 방법이 없어 exposed 여부만
                      자동 판단하고, 애매한 경우를 위한 수동 오버라이드를 남겨둔다. */}
                  {item.type === "review" && (
                    <button
                      onClick={() => resolveActionItem(item.key)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-[11px] font-bold transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> 처리완료로 표시
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
