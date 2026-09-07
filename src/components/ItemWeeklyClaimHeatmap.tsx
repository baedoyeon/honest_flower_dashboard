import { useMemo, useState } from "react";
import { Flame, Grid3x3, Table as TableIcon, ChevronDown, ChevronUp } from "lucide-react";
import { ItemWeeklyClaimRow } from "../utils/claimCostEngine";

const DEFAULT_VISIBLE_WEEKS = 16;
const DEFAULT_TOP_N = 20;

type Metric = "count" | "share";

// 단일 색상(로즈) 명도 스케일만 사용 — 여러 색을 섞은 무지개 히트맵은 절대 안 쓴다(magnitude 인코딩
// 원칙). 이 프로젝트에서 이미 위험/경고를 나타낼 때 쓰는 로즈/레드 계열과 통일. 0은 배경 없음(=값 없음),
// t = sqrt(value/max)로 완만하게 스케일링해 작은 값들도 구간이 뭉치지 않고 퍼지게 한다.
function getCellClasses(value: number, max: number): { bg: string; text: string } {
  if (value <= 0 || max <= 0) return { bg: "bg-transparent", text: "text-transparent" };
  const t = Math.sqrt(value / max);
  if (t <= 0.2) return { bg: "bg-rose-50", text: "text-rose-900" };
  if (t <= 0.4) return { bg: "bg-rose-100", text: "text-rose-900" };
  if (t <= 0.6) return { bg: "bg-rose-200", text: "text-rose-900" };
  if (t <= 0.8) return { bg: "bg-rose-400", text: "text-white" };
  return { bg: "bg-rose-600", text: "text-white" };
}

const LEGEND_STEPS = ["bg-rose-50", "bg-rose-100", "bg-rose-200", "bg-rose-400", "bg-rose-600"];

function formatMetricValue(metric: Metric, value: number): string {
  if (value <= 0) return "";
  return metric === "count" ? `${value}` : `${value}%`;
}

export default function ItemWeeklyClaimHeatmap({
  rows,
  weekStarts,
}: {
  rows: ItemWeeklyClaimRow[];
  weekStarts: string[];
}) {
  const [metric, setMetric] = useState<Metric>("count");
  const [viewMode, setViewMode] = useState<"heatmap" | "table">("heatmap");
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);

  const firstVisibleWeekIdx = showAllWeeks ? 0 : Math.max(0, weekStarts.length - DEFAULT_VISIBLE_WEEKS);
  const visibleWeekStarts = weekStarts.slice(firstVisibleWeekIdx);
  const visibleRows = showAllItems ? rows : rows.slice(0, DEFAULT_TOP_N);

  const maxValue = useMemo(() => {
    let max = 0;
    visibleRows.forEach(r => {
      r.weeks.slice(firstVisibleWeekIdx).forEach(w => {
        const v = metric === "count" ? w.count : w.shareOfWeekTotal;
        if (v > max) max = v;
      });
    });
    return max;
  }, [visibleRows, firstVisibleWeekIdx, metric]);

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
        <Flame className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400">아직 상품×주차로 집계할 사고접수 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <Flame className="h-4 w-4 text-rose-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">상품 × 주차 사고접수 히트맵</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              특정 상품의 사고접수가 최근 몇 주 사이 튀었는지, 원래 꾸준했는지 한눈에 파악. 사고접수건수 상위{" "}
              {Math.min(rows.length, DEFAULT_TOP_N)}개 상품 기본 표시 · 접수일 기준 월요일 시작 주차.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMetric("count")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metric === "count" ? "bg-white shadow-2xs text-rose-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              건수 보기
            </button>
            <button
              onClick={() => setMetric("share")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metric === "share" ? "bg-white shadow-2xs text-rose-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              비율(%) 보기
            </button>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("heatmap")}
              title="히트맵 보기"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "heatmap" ? "bg-white shadow-2xs text-rose-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="표로 보기(색상 없이)"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table" ? "bg-white shadow-2xs text-rose-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "heatmap" && (
        <div className="flex items-center gap-2 mb-3 text-[10px] text-slate-500">
          <span className="font-bold">범례:</span>
          <span>0{metric === "count" ? "건" : "%"}</span>
          <div className="flex items-center gap-0.5">
            {LEGEND_STEPS.map((cls, i) => (
              <span key={i} className={`inline-block h-3 w-5 rounded-sm border border-slate-100 ${cls}`} />
            ))}
          </div>
          <span>{maxValue}{metric === "count" ? "건+" : "%+"}</span>
        </div>
      )}

      <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-100">
        <table className="text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50 py-2 px-3 font-bold text-slate-500 border-b border-r border-slate-200 min-w-[160px]">
                상품명
              </th>
              <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">
                전체건수
              </th>
              {visibleWeekStarts.map(ws => (
                <th key={ws} className="py-2 px-1.5 font-bold text-slate-400 border-b border-slate-200 text-center whitespace-nowrap" style={{ minWidth: 56 }}>
                  {ws.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row, rowIdx) => {
              // 스크롤 컨테이너(overflow-auto)가 위로 넘치는 절대위치 툴팁을 잘라버리므로, 위쪽 절반
              // 행은 셀 아래쪽에, 아래쪽 절반 행은 셀 위쪽에 띄운다 — 상단 고정 헤더에 가려지는 걸 방지.
              const tooltipBelow = rowIdx < visibleRows.length / 2;
              return (
              <tr key={row.item} className="hover:bg-slate-50/40">
                <td className="sticky left-0 z-10 bg-white py-1.5 px-3 font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap max-w-[180px] truncate" title={row.item}>
                  {row.item}
                </td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-500">{row.totalCount}건</td>
                {row.weeks.slice(firstVisibleWeekIdx).map((w, i) => {
                  const value = metric === "count" ? w.count : w.shareOfWeekTotal;
                  if (viewMode === "table") {
                    return (
                      <td key={visibleWeekStarts[i]} className="py-1.5 px-1.5 text-center font-mono text-slate-600 border-l border-slate-50">
                        {value > 0 ? formatMetricValue(metric, value) : "-"}
                      </td>
                    );
                  }
                  const { bg, text } = getCellClasses(value, maxValue);
                  return (
                    <td key={visibleWeekStarts[i]} className="relative p-0 border-l border-slate-50 group">
                      <div className={`h-8 flex items-center justify-center text-[10px] font-bold ${bg} ${text} transition group-hover:ring-2 group-hover:ring-rose-500 group-hover:ring-inset`}>
                        {formatMetricValue(metric, value)}
                      </div>
                      <div
                        className={`hidden group-hover:flex absolute z-40 left-1/2 -translate-x-1/2 flex-col gap-0.5 rounded-lg bg-slate-900 text-white text-[10px] px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none ${
                          tooltipBelow ? "top-full mt-1.5" : "bottom-full mb-1.5"
                        }`}
                      >
                        <span className="font-bold">{row.item}</span>
                        <span className="text-slate-300">{w.weekLabel}</span>
                        <span>건수 {w.count}건 · 비율 {w.shareOfWeekTotal}%</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        {weekStarts.length > DEFAULT_VISIBLE_WEEKS ? (
          <button
            onClick={() => setShowAllWeeks(!showAllWeeks)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-700 transition cursor-pointer"
          >
            {showAllWeeks ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAllWeeks ? `최근 ${DEFAULT_VISIBLE_WEEKS}주만 보기` : `전체 ${weekStarts.length}주 보기`}
          </button>
        ) : (
          <span />
        )}

        {rows.length > DEFAULT_TOP_N && (
          <button
            onClick={() => setShowAllItems(!showAllItems)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-700 transition cursor-pointer"
          >
            {showAllItems ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showAllItems ? "상위 20개만 보기" : `더보기 (전체 ${rows.length}개 상품)`}
          </button>
        )}
      </div>
    </div>
  );
}
