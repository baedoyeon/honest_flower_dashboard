import { useMemo, useState } from "react";
import { Flame, Grid3x3, Table as TableIcon } from "lucide-react";
import { HourlyBottleneckCell } from "../utils/chatRoomEngine";

type Metric = "count" | "frt";

// 단일 색상(블루) 명도 스케일만 사용 — 매그니튜드 인코딩 원칙(무지개 금지). "CS 응대 현황" 탭의
// 채팅 카테고리컬 색(#3b82f6)과 계열을 통일한다. t = sqrt(value/max)로 완만하게 스케일링.
function getCellClasses(value: number, max: number): { bg: string; text: string } {
  if (value <= 0 || max <= 0) return { bg: "bg-transparent", text: "text-transparent" };
  const t = Math.sqrt(value / max);
  if (t <= 0.2) return { bg: "bg-blue-50", text: "text-blue-900" };
  if (t <= 0.4) return { bg: "bg-blue-100", text: "text-blue-900" };
  if (t <= 0.6) return { bg: "bg-blue-200", text: "text-blue-900" };
  if (t <= 0.8) return { bg: "bg-blue-400", text: "text-white" };
  return { bg: "bg-blue-600", text: "text-white" };
}

const LEGEND_STEPS = ["bg-blue-50", "bg-blue-100", "bg-blue-200", "bg-blue-400", "bg-blue-600"];

function formatMinutes(m?: number): string {
  if (m === undefined) return "-";
  if (m < 60) return `${Math.round(m)}분`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}시간 ${rem}분` : `${h}시간`;
}

export default function HourlyBottleneckHeatmap({ cells }: { cells: HourlyBottleneckCell[] }) {
  const [metric, setMetric] = useState<Metric>("count");
  const [viewMode, setViewMode] = useState<"heatmap" | "table">("heatmap");

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]; // 월~일 순으로 표시

  const grid = useMemo(() => {
    const map = new Map<string, HourlyBottleneckCell>();
    cells.forEach(c => map.set(`${c.weekday}-${c.hour}`, c));
    return map;
  }, [cells]);

  const maxValue = useMemo(() => {
    let max = 0;
    cells.forEach(c => {
      const v = metric === "count" ? c.count : (c.avgFrtMinutes || 0);
      if (v > max) max = v;
    });
    return max;
  }, [cells, metric]);

  const totalInquiries = cells.reduce((s, c) => s + c.count, 0);

  if (totalInquiries === 0) {
    return (
      <div className="text-center py-16">
        <Flame className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400">아직 시간대별 병목을 집계할 문의 데이터가 없습니다(이벤트 시각 컬럼이 비어있는 행은 집계에서 제외됩니다).</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          요일×시간대별 문의량(채팅=오픈 시각, 전화=챗봇 생성 시각 기준) 및 평균 FRT. 비운영시간(음영 테두리) 문의도 함께 표시됩니다.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMetric("count")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metric === "count" ? "bg-white shadow-2xs text-blue-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              문의량
            </button>
            <button
              onClick={() => setMetric("frt")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                metric === "frt" ? "bg-white shadow-2xs text-blue-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              평균 FRT
            </button>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("heatmap")}
              title="히트맵 보기"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "heatmap" ? "bg-white shadow-2xs text-blue-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="표로 보기(색상 없이)"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table" ? "bg-white shadow-2xs text-blue-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "heatmap" && (
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="font-bold">범례:</span>
          <span>0{metric === "count" ? "건" : "분"}</span>
          <div className="flex items-center gap-0.5">
            {LEGEND_STEPS.map((cls, i) => (
              <span key={i} className={`inline-block h-3 w-5 rounded-sm border border-slate-100 ${cls}`} />
            ))}
          </div>
          <span>{metric === "count" ? `${maxValue}건+` : formatMinutes(maxValue) + "+"}</span>
          <span className="ml-3 inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-amber-400 bg-white" />
            비운영시간 비중 높음
          </span>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-100">
        <table className="text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50 py-2 px-3 font-bold text-slate-500 border-b border-r border-slate-200">
                요일 \ 시간
              </th>
              {hours.map(h => (
                <th key={h} className="py-2 px-1 font-bold text-slate-400 border-b border-slate-200 text-center whitespace-nowrap" style={{ minWidth: 34 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {weekdayOrder.map((weekday, rowIdx) => {
              const tooltipBelow = rowIdx < weekdayOrder.length / 2;
              return (
                <tr key={weekday} className="hover:bg-slate-50/40">
                  <td className="sticky left-0 z-10 bg-white py-1.5 px-3 font-bold text-slate-800 border-r border-slate-200">
                    {["일", "월", "화", "수", "목", "금", "토"][weekday]}
                  </td>
                  {hours.map(h => {
                    const cell = grid.get(`${weekday}-${h}`);
                    const value = metric === "count" ? (cell?.count || 0) : (cell?.avgFrtMinutes || 0);
                    const nonOperatingMajority = !!cell && cell.nonOperatingCount > cell.operatingCount;

                    if (viewMode === "table") {
                      return (
                        <td key={h} className="py-1.5 px-1 text-center font-mono text-slate-600 border-l border-slate-50">
                          {cell && cell.count > 0 ? (metric === "count" ? `${cell.count}` : formatMinutes(cell.avgFrtMinutes)) : "-"}
                        </td>
                      );
                    }

                    const { bg, text } = getCellClasses(value, maxValue);
                    return (
                      <td key={h} className="relative p-0 border-l border-slate-50 group">
                        <div
                          className={`h-7 flex items-center justify-center text-[9px] font-bold ${bg} ${text} transition group-hover:ring-2 group-hover:ring-blue-500 group-hover:ring-inset ${
                            nonOperatingMajority && cell && cell.count > 0 ? "border-2 border-amber-400" : ""
                          }`}
                        >
                          {cell && cell.count > 0 ? (metric === "count" ? cell.count : Math.round(cell.avgFrtMinutes || 0)) : ""}
                        </div>
                        {cell && cell.count > 0 && (
                          <div
                            className={`hidden group-hover:flex absolute z-40 left-1/2 -translate-x-1/2 flex-col gap-0.5 rounded-lg bg-slate-900 text-white text-[10px] px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none ${
                              tooltipBelow ? "top-full mt-1.5" : "bottom-full mb-1.5"
                            }`}
                          >
                            <span className="font-bold">{["일", "월", "화", "수", "목", "금", "토"][weekday]}요일 {h}시</span>
                            <span>문의량 {cell.count}건 · 평균 FRT {formatMinutes(cell.avgFrtMinutes)}</span>
                            <span className="text-slate-300">운영 {cell.operatingCount}건 · 비운영 {cell.nonOperatingCount}건</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
