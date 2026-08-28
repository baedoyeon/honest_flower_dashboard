import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PieChart, Grid3x3, Table as TableIcon } from "lucide-react";
import { MethodWeekBreakdown } from "../utils/claimCostEngine";

// 처리방법 5종 — 기존 "처리방법 비중" 위젯(ClaimCostTab)과 동일한 순서·색상을 그대로 재사용한다
// (팀이 이미 쓰는 카테고리 색: bg-blue-500/emerald-500/amber-500/purple-500/slate-400).
// 필터링해도 같은 항목은 항상 같은 색을 유지 — 재배정/순환 금지.
const METHOD_ORDER: { key: keyof MethodWeekBreakdown["methods"]; label: string; color: string }[] = [
  { key: "재발송", label: "재발송", color: "#3b82f6" },
  { key: "결제수단환불", label: "결제 수단으로 환불", color: "#10b981" },
  { key: "교환", label: "교환", color: "#f59e0b" },
  { key: "반품", label: "반품", color: "#a855f7" },
  { key: "적립금환불", label: "적립금 환불", color: "#94a3b8" },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as (MethodWeekBreakdown & { shortLabel: string }) | undefined;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs space-y-1.5">
      <p className="font-bold text-slate-800">{row.weekLabel}</p>
      <p className="text-slate-400">클레임 총 {row.totalClaims}건</p>
      <div className="space-y-1 pt-1 border-t border-slate-100">
        {METHOD_ORDER.map(m => (
          <div key={m.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-slate-600">{m.label}</span>
            </span>
            <span className="font-bold text-slate-800">
              {row.methodCounts[m.key]}건 · {row.methods[m.key]}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MethodBreakdownTrendChart({ weeks }: { weeks: MethodWeekBreakdown[] }) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const chartData = weeks.map(w => ({ ...w, shortLabel: w.weekStart.slice(5) }));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <PieChart className="h-4 w-4 text-indigo-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">처리방법 비율 추이</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              주차별(결제일 기준, 토요일 시작) 클레임 처리방법 5종 비중 — 100% 누적. 재발송/결제 수단으로 환불/교환/반품/적립금 환불.
            </p>
          </div>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setViewMode("chart")}
            title="차트로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "chart" ? "bg-white shadow-2xs text-indigo-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            title="표로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "table" ? "bg-white shadow-2xs text-indigo-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {weeks.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-16">아직 처리방법 추이를 집계할 클레임 데이터가 없습니다.</p>
      ) : viewMode === "chart" ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => value} />
            {METHOD_ORDER.map(m => (
              <Bar
                key={m.key}
                dataKey={`methods.${m.key}`}
                stackId="a"
                fill={m.color}
                stroke="#ffffff"
                strokeWidth={2}
                name={m.label}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">주차</th>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">클레임 총건수</th>
                {METHOD_ORDER.map(m => (
                  <th key={m.key} className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {weeks.map(w => (
                <tr key={w.weekStart} className="hover:bg-slate-50/40">
                  <td className="py-1.5 px-3 font-bold text-slate-700 whitespace-nowrap">{w.weekLabel}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-500">{w.totalClaims}건</td>
                  {METHOD_ORDER.map(m => (
                    <td key={m.key} className="py-1.5 px-3 text-right font-mono text-slate-600">
                      {w.methodCounts[m.key] > 0 ? `${w.methods[m.key]}% (${w.methodCounts[m.key]}건)` : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
