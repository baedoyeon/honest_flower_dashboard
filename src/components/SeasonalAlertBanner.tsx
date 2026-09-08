import { useMemo, useRef, useState } from "react";
import { Bell, Upload, CheckCircle2, ArrowRight } from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { parseCSVToOrderItems, parseCSVToProblemForms } from "../utils/csvParser";
import {
  computeProductMonthAggregates, computeSeasonalCompareMonths, computeSeasonalAlerts, SeasonalAlert
} from "../utils/claimCostEngine";
import { OrderItem } from "../data/orderItems";
import { ProblemForm } from "../data/problemForms";

// MD팀 요청 — "작년 이맘때도 이슈였던 상품"(YoY)과 "지난달에 새로 심각해진 상품"(MoM)을 매번
// 방문해야 보이는 탭 안이 아니라, 첫 화면(주간 핵심 지표)에 항상 뜨는 배너로 보여준다.
// 임계값(클레임율 5%↑ · 주문 20건↑ · 사고접수 4건↑)은 2026년 8월 실측으로 정함 — claimCostEngine.ts
// SEASONAL_ALERT_THRESHOLD 참고.
export default function SeasonalAlertBanner() {
  const { orderItems, problemForms, yoyReferenceAggregates, importYoyReferenceData, setActiveTab } = useReviews();
  const [showUpload, setShowUpload] = useState(false);
  const [showAllYoy, setShowAllYoy] = useState(false);
  const [showAllMom, setShowAllMom] = useState(false);
  const [parsedOi, setParsedOi] = useState<OrderItem[] | null>(null);
  const [parsedPf, setParsedPf] = useState<ProblemForm[] | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const oiInputRef = useRef<HTMLInputElement>(null);
  const pfInputRef = useRef<HTMLInputElement>(null);

  const { currentMonth, priorMonth, yoyMonth } = useMemo(() => computeSeasonalCompareMonths(), []);

  // 작년 데이터는 두 경로로 들어올 수 있다: ① 배너 전용 "작년 참고 데이터 올리기"(yoyReferenceAggregates,
  // 원본 행 없이 집계만 저장) ② 평소 쓰는 메인 임포터로 그냥 올려서 orderItems/problemForms 안에 같이
  // 누적된 경우 — 실사용에서 사용자가 후자로 올리는 게 자연스러워서(같은 CSV, 같은 버튼) 라이브
  // 데이터에 그 달 집계가 이미 있으면 그쪽을 우선 쓴다. 없을 때만 별도 저장된 참고 데이터로 대체.
  const { alerts, momDataSufficient, yoyDataSufficient, yoySource } = useMemo(() => {
    const currentAndPrior = computeProductMonthAggregates(orderItems, problemForms);
    const liveHasYoyMonth = currentAndPrior.some(a => a.month === yoyMonth);
    const yoySource = liveHasYoyMonth ? currentAndPrior : yoyReferenceAggregates;
    const result = computeSeasonalAlerts(currentAndPrior, currentMonth, currentAndPrior, priorMonth, yoySource, yoyMonth);
    return { ...result, yoySource };
  }, [orderItems, problemForms, yoyReferenceAggregates, currentMonth, priorMonth, yoyMonth]);

  const yoyAlerts = alerts.filter(a => a.type === "yoy");
  const momAlerts = alerts.filter(a => a.type === "mom");

  const hasYoyReferenceForThisMonth = yoySource.some(a => a.month === yoyMonth);
  const yoyNote = !hasYoyReferenceForThisMonth
    ? `${yoyMonth} 참고 데이터 없음 — YoY 비교 불가`
    : !yoyDataSufficient
      ? `${yoyMonth} 참고 데이터가 이번달 대비 너무 적어(부분 export로 추정) YoY 비교를 건너뜀`
      : null;
  const momNote = !momDataSufficient
    ? `${priorMonth} 데이터가 이번달 대비 너무 적어(부분 export로 추정) MoM 비교를 건너뜀`
    : null;

  const handleOiFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setParsedOi(parseCSVToOrderItems(text).orderItems);
    };
    reader.readAsText(file, "utf-8");
  };
  const handlePfFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setParsedPf(parseCSVToProblemForms(text).problemForms);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleApply = () => {
    if (!parsedOi && !parsedPf) return;
    importYoyReferenceData(parsedOi || [], parsedPf || []);
    setSuccessMsg(`작년 참고 데이터 반영 완료 (주문 ${parsedOi?.length ?? 0}건 · 사고접수 ${parsedPf?.length ?? 0}건 — 상품×월 집계만 저장, 원본 행은 저장 안 함)`);
    setTimeout(() => {
      setParsedOi(null); setParsedPf(null);
      setSuccessMsg(null); setShowUpload(false);
    }, 3000);
  };

  if (alerts.length === 0 && !showUpload) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Bell className="h-4 w-4" />
          <p className="text-xs font-bold">
            시즌 알림 — {currentMonth} 기준 반복/신규 악화 상품 없음
            {yoyNote && <span className="text-amber-600 ml-1">({yoyNote})</span>}
            {momNote && <span className="text-amber-600 ml-1">({momNote})</span>}
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer">
          작년 참고 데이터 올리기
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50/40 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bell className="h-4 w-4 text-rose-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">시즌 알림 ({currentMonth})</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              클레임율 {'>'}= 5% · 주문 {'>'}= 20건 · 사고접수 {'>'}= 4건 조건을 만족하는 상품만 표시.
              {yoyNote && <span className="text-amber-600"> {yoyNote}.</span>}
              {momNote && <span className="text-amber-600"> {momNote}.</span>}
            </p>
          </div>
        </div>
        <button onClick={() => setShowUpload(v => !v)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer shrink-0">
          작년 데이터 {showUpload ? "닫기" : "올리기"}
        </button>
      </div>

      {yoyAlerts.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-3 space-y-2">
          <p className="text-xs font-bold text-rose-800">🔁 작년 {yoyMonth}에도 이슈였던 상품 ({yoyAlerts.length})</p>
          {(showAllYoy ? yoyAlerts : yoyAlerts.slice(0, 3)).map(a => (
            <SeasonalAlertRow key={a.product} alert={a} compareLabel="작년 동월" onClick={() => setActiveTab("claimcost")} />
          ))}
          {yoyAlerts.length > 3 && (
            <button
              onClick={() => setShowAllYoy(v => !v)}
              className="w-full text-center text-[11px] font-bold text-rose-600 hover:text-rose-800 py-1.5 transition cursor-pointer"
            >
              {showAllYoy ? "접기" : `더보기 (${yoyAlerts.length - 3}개 더)`}
            </button>
          )}
        </div>
      ) : !yoyNote ? (
        // 비교가 안 돌아서(데이터 없음/부족) 조용한 것과, 비교는 정상적으로 돌았는데 겹치는 상품이
        // 0건이라 조용한 것을 구분해서 보여준다 — 둘 다 "아무 표시 없음"이면 사용자 입장에서
        // "원래 비교가 되긴 하는 건가?"라는 의심이 생김.
        <p className="text-[11px] text-slate-400 px-1">🔁 작년 {yoyMonth} 동월엔 겹치는 이슈 없음 (비교 완료)</p>
      ) : null}

      {momAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-3 space-y-2">
          <p className="text-xs font-bold text-amber-800">🆕 {priorMonth} 대비 새로 심각해진 상품 ({momAlerts.length})</p>
          {(showAllMom ? momAlerts : momAlerts.slice(0, 3)).map(a => (
            <SeasonalAlertRow key={a.product} alert={a} compareLabel="전월" onClick={() => setActiveTab("claimcost")} />
          ))}
          {momAlerts.length > 3 && (
            <button
              onClick={() => setShowAllMom(v => !v)}
              className="w-full text-center text-[11px] font-bold text-amber-700 hover:text-amber-900 py-1.5 transition cursor-pointer"
            >
              {showAllMom ? "접기" : `더보기 (${momAlerts.length - 3}개 더)`}
            </button>
          )}
        </div>
      )}

      {showUpload && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-[11px] text-slate-500">
            YoY 비교용 <b>작년 같은 달({yoyMonth})</b> OrderItem/ProblemForm CSV를 그대로 올리세요 — 기존
            업로드와 같은 파일 형식입니다. 상품×월 집계만 뽑아서 저장하고 원본 행은 버립니다.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 mb-1">주문(OrderItem) — {parsedOi ? `${parsedOi.length}건 파싱됨` : "미선택"}</p>
              <input ref={oiInputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleOiFile(e.target.files[0])} />
              <button onClick={() => oiInputRef.current?.click()} className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-[11px] font-bold text-slate-500 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer flex items-center justify-center gap-1">
                <Upload className="h-3 w-3" /> CSV 선택
              </button>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 mb-1">사고접수(ProblemForm) — {parsedPf ? `${parsedPf.length}건 파싱됨` : "미선택"}</p>
              <input ref={pfInputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handlePfFile(e.target.files[0])} />
              <button onClick={() => pfInputRef.current?.click()} className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-[11px] font-bold text-slate-500 hover:border-rose-300 hover:text-rose-600 transition cursor-pointer flex items-center justify-center gap-1">
                <Upload className="h-3 w-3" /> CSV 선택
              </button>
            </div>
          </div>
          {successMsg ? (
            <div className="rounded-xl bg-emerald-600 text-white p-3 flex items-center gap-2 text-[11px] font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
            </div>
          ) : (
            <button
              onClick={handleApply}
              disabled={!parsedOi && !parsedPf}
              className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white py-2 text-[11px] font-bold transition cursor-pointer"
            >
              반영하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// compareClaimRate/currentClaimRate는 서로 독립된 두 달의 자체 클레임율(사고접수/주문)이지,
// 한쪽이 다른 쪽의 비율(%)이 아니다 — "34%(0.5)" 처럼 한 줄에 붙여두면 그 둘의 관계로 오해하기
// 쉬워서, 어느 달 수치인지 라벨을 달고 두 칸으로 분리해 보여준다.
function SeasonalAlertRow({ alert, compareLabel, onClick }: { alert: SeasonalAlert; compareLabel: string; onClick: () => void }) {
  return (
    <div className="rounded-xl bg-slate-50 hover:bg-slate-100 transition px-3 py-2.5">
      <button onClick={onClick} className="text-xs font-bold text-slate-800 hover:underline cursor-pointer">
        {alert.product}
      </button>
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 rounded-lg bg-white px-2.5 py-1.5 border border-slate-100">
          <p className="text-[9px] font-bold text-slate-400">{compareLabel} ({alert.compareMonth})</p>
          <p className="text-[11px] font-bold text-slate-600">
            {alert.compareClaimRate}% <span className="text-slate-400 font-medium">({alert.compareAccidentCount}/{alert.compareOrderCount}건)</span>
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <div className="flex-1 rounded-lg bg-white px-2.5 py-1.5 border border-rose-100">
          <p className="text-[9px] font-bold text-rose-400">이번달 ({alert.currentMonth})</p>
          <p className="text-[11px] font-bold text-rose-700">
            {alert.currentClaimRate}% <span className="text-slate-400 font-medium">({alert.currentAccidentCount}/{alert.currentOrderCount}건)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
