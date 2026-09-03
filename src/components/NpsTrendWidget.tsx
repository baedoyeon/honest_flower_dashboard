import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useReviews } from "../context/ReviewsContext";

const NPS_TREND_COLOR = "#6366f1";

// ClaimCostTab의 "전년동월 대비 없으면 직전월 대비로 폴백" 컨벤션을 그대로 따른다 — period가
// "YYYY-MM"이므로 첫 "-" 앞을 연도로 보고 동일한 로직을 적용할 수 있다.
function splitYearAndRest(period: string): { year: string; rest: string } | null {
  const idx = period.indexOf("-");
  if (idx === -1) return null;
  return { year: period.slice(0, idx), rest: period.slice(idx + 1) };
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs space-y-1">
      <p className="font-bold text-slate-800">{row.period}</p>
      <p className="text-slate-600">
        NPS <span className="font-bold" style={{ color: NPS_TREND_COLOR }}>{row.score}</span>
      </p>
      {typeof row.total === "number" && <p className="text-slate-400">응답 {row.total.toLocaleString()}건</p>}
    </div>
  );
}

// Part F 우선순위 3 — 별도 업로드 없음. 위 "NPS Detractor 이탈 위험군 추적" 위젯에서 원본 CSV를
// 올리는 즉시 생성일 기준 월별 집계(npsTrend)가 함께 계산되므로, 이 위젯은 그 결과를 그대로 표시만
// 한다.
export default function NpsTrendWidget() {
  const { npsTrend } = useReviews();

  const latest = npsTrend.length > 0 ? npsTrend[npsTrend.length - 1] : undefined;

  const comparison = useMemo(() => {
    if (!latest) return null;
    const parts = splitYearAndRest(latest.period);
    let base = undefined as typeof latest | undefined;
    let label = "직전기간 대비";

    if (parts) {
      const priorYear = (parseInt(parts.year, 10) - 1).toString();
      base = npsTrend.find(p => p.period === `${priorYear}-${parts.rest}`);
      if (base) label = "전년동기 대비";
    }
    if (!base && npsTrend.length >= 2) {
      base = npsTrend[npsTrend.length - 2];
      label = "직전기간 대비";
    }
    if (!base) return null;

    const diff = latest.score - base.score;
    return { label, diff, baseScore: base.score };
  }, [latest, npsTrend]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-start gap-2 border-b border-slate-100 pb-3">
        <TrendingUp className="h-5 w-5 text-indigo-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">NPS 스코어 월별 추이</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            위 "NPS Detractor 이탈 위험군 추적" 위젯에서 원본 CSV를 올리면 생성일 기준으로 자동 집계됩니다(별도 업로드 불필요).
          </p>
        </div>
      </div>

      {npsTrend.length === 0 ? (
        <div className="text-center py-10">
          <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">아직 집계된 NPS 추이 데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 sm:col-span-1">
            <p className="text-[11px] font-bold text-indigo-700">최근 NPS 스코어</p>
            <p className="text-2xl font-black text-indigo-950 mt-1">{latest?.score ?? "-"}</p>
            {comparison && (
              <p className={`text-[10px] mt-1 flex items-center gap-1 font-bold ${
                comparison.diff > 0 ? "text-emerald-600" : comparison.diff < 0 ? "text-rose-600" : "text-slate-500"
              }`}>
                {comparison.diff > 0 ? <TrendingUp className="h-3 w-3" /> : comparison.diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {comparison.diff > 0 ? `+${comparison.diff}` : comparison.diff}pt {comparison.label}
              </p>
            )}
            <p className="text-[10px] text-indigo-700 mt-1">{latest?.period}</p>
          </div>
          <div className="sm:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={npsTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#898781" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={NPS_TREND_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: NPS_TREND_COLOR }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
