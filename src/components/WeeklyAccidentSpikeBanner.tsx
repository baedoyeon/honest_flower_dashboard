import { useMemo } from "react";
import { Flame } from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { computeWeeklyAccidentSpikes } from "../utils/claimCostEngine";

// 시즌 알림(YoY/MoM, 월 단위 클레임율 비교)과는 별개 — "최근 7일 사이 한 상품에 사고접수가
// 갑자기 몰리는" 단기 급증만 절대 건수 기준(주문량 대비 비율 아님)으로 잡아서 바로 알려준다.
// 사용자 확정 기준: 최근 7일 내 3건 이상.
const WINDOW_DAYS = 7;
const MIN_COUNT = 3;

export default function WeeklyAccidentSpikeBanner() {
  const { problemForms, setActiveTab } = useReviews();

  const spikes = useMemo(
    () => computeWeeklyAccidentSpikes(problemForms, new Date(), WINDOW_DAYS, MIN_COUNT),
    [problemForms]
  );

  if (spikes.length === 0) return null;

  const { windowStart, windowEnd } = spikes[0];

  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/40 p-5 space-y-3">
      <div className="flex items-start gap-2">
        <Flame className="h-4 w-4 text-rose-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">사고접수 급증 알림 ({windowStart} ~ {windowEnd})</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">최근 {WINDOW_DAYS}일 사이 사고접수가 {MIN_COUNT}건 이상 몰린 상품 (접수일 기준)</p>
        </div>
      </div>
      <div className="rounded-2xl border border-rose-200 bg-white p-3 space-y-2">
        {spikes.map(s => (
          <button
            key={s.product}
            onClick={() => setActiveTab("incidents")}
            className="w-full text-left flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-3 py-2 hover:bg-rose-100 transition cursor-pointer"
          >
            <span className="text-xs font-bold text-slate-800">{s.product}</span>
            <span className="text-[11px] font-bold text-rose-700">{s.count}건</span>
          </button>
        ))}
      </div>
    </div>
  );
}
