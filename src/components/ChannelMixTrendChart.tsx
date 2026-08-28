import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PieChart, Grid3x3, Table as TableIcon } from "lucide-react";
import { ChannelMixTrendPoint } from "../utils/chatRoomEngine";
import { CHAT_CHANNEL_COLOR, CALL_CHANNEL_COLOR } from "./ChannelTrendChart";

// 4종 고정 카테고리컬 색 — 챗/콜은 Part B 상세뷰(ChannelTrendChart)와 완전히 동일한 색을 재사용
// (재배정 금지). 사고접수/플라워고는 이 대시보드 전체에서 이미 쓰던 로즈/푸시아 계열과 통일.
const MIX_ORDER: { key: keyof ChannelMixTrendPoint["mix"]; label: string; color: string }[] = [
  { key: "챗", label: "챗", color: CHAT_CHANNEL_COLOR },
  { key: "콜", label: "콜", color: CALL_CHANNEL_COLOR },
  { key: "사고접수", label: "사고접수", color: "#f43f5e" },
  { key: "플라워고", label: "플라워고", color: "#d946ef" },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChannelMixTrendPoint | undefined;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs space-y-1.5">
      <p className="font-bold text-slate-800">{row.label}</p>
      <p className="text-slate-400">총 이슈 {row.totalIssues}건</p>
      <div className="space-y-1 pt-1 border-t border-slate-100">
        {MIX_ORDER.map(m => (
          <div key={m.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-slate-600">{m.label}</span>
            </span>
            <span className="font-bold text-slate-800">
              {row.counts[m.key]}건 · {row.mix[m.key].toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChannelMixTrendChart({ points }: { points: ChannelMixTrendPoint[] }) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  if (points.length === 0) {
    return (
      <div className="text-center py-16">
        <PieChart className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400">아직 채널 믹스 추이를 집계할 데이터가 없습니다(챗/콜/사고접수/플라워고 데이터가 모두 있어야 정확히 계산됩니다).</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          월별 챗/콜/사고접수/플라워고 4종 비중(합 100%) — CPO%와 동일한 "총 CS 이슈량" 기준.
        </p>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setViewMode("chart")}
            title="차트로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "chart" ? "bg-white shadow-2xs text-fuchsia-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            title="표로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "table" ? "bg-white shadow-2xs text-fuchsia-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {viewMode === "chart" ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {MIX_ORDER.map(m => (
              <Bar
                key={m.key}
                dataKey={`mix.${m.key}`}
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
        <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">월</th>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">총 이슈</th>
                {MIX_ORDER.map(m => (
                  <th key={m.key} className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {points.map(p => (
                <tr key={p.month} className="hover:bg-slate-50/40">
                  <td className="py-1.5 px-3 font-bold text-slate-700 whitespace-nowrap">{p.label}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-500">{p.totalIssues}건</td>
                  {MIX_ORDER.map(m => (
                    <td key={m.key} className="py-1.5 px-3 text-right font-mono text-slate-600">
                      {p.counts[m.key] > 0 ? `${p.mix[m.key].toFixed(1)}% (${p.counts[m.key]}건)` : "-"}
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
