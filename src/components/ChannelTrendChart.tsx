import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Grid3x3, Table as TableIcon } from "lucide-react";
import { ChannelTrendPoint } from "../utils/chatRoomEngine";

// 채팅/전화 고정 카테고리컬 색 — "CS 응대 현황" 탭 전체(Part B 상세뷰 + Part C 채널 믹스)에서
// 동일하게 재사용한다. 재배정/순환 금지.
export const CHAT_CHANNEL_COLOR = "#3b82f6"; // 채팅
export const CALL_CHANNEL_COLOR = "#06b6d4"; // 전화(콜)

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs space-y-1.5">
      <p className="font-bold text-slate-800">{label}</p>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-slate-600">{p.name}</span>
            </span>
            <span className="font-bold text-slate-800">{p.value}건</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChannelTrendChart({ points }: { points: ChannelTrendPoint[] }) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  if (points.length === 0) {
    return (
      <div className="text-center py-16">
        <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400">아직 채널별 문의량 추이를 집계할 데이터가 없습니다.</p>
      </div>
    );
  }

  const chartData = points.map(p => ({ ...p, shortLabel: p.date.slice(5) }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          채팅/전화 일별 문의량(챗=오픈 시각, 전화=챗봇 생성 시각 기준). 채팅/전화만 다루는 상세뷰 — 사고접수/플라워고까지 포함한 전체 채널 믹스는 아래 "채널 믹스 추이" 섹션 참고.
        </p>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setViewMode("chart")}
            title="차트로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "chart" ? "bg-white shadow-2xs text-blue-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            title="표로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "table" ? "bg-white shadow-2xs text-blue-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {viewMode === "chart" ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#898781" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="채팅" stroke={CHAT_CHANNEL_COLOR} strokeWidth={2} dot={{ r: 3 }} name="채팅" />
            <Line type="monotone" dataKey="콜" stroke={CALL_CHANNEL_COLOR} strokeWidth={2} dot={{ r: 3 }} name="전화" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">날짜</th>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">채팅</th>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">전화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {points.map(p => (
                <tr key={p.date} className="hover:bg-slate-50/40">
                  <td className="py-1.5 px-3 font-bold text-slate-700 whitespace-nowrap">{p.date}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-600">{p.채팅}건</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-600">{p.콜}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
