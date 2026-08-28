import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Timer, Grid3x3, Table as TableIcon } from "lucide-react";
import { FrtArtTrendPoint } from "../utils/chatRoomEngine";

const FRT_COLOR = "#f59e0b";
const ART_COLOR = "#8b5cf6";

function formatMinutes(m?: number): string {
  if (m === undefined) return "-";
  if (m < 60) return `${Math.round(m)}분`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}시간 ${rem}분` : `${h}시간`;
}

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
            <span className="font-bold text-slate-800">{formatMinutes(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FrtArtTrendChart({ points }: { points: FrtArtTrendPoint[] }) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  if (points.length === 0) {
    return (
      <div className="text-center py-16">
        <Timer className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-400">아직 FRT/ART 추이를 집계할 채팅 데이터가 없습니다.</p>
      </div>
    );
  }

  const chartData = points.map(p => ({ ...p, shortLabel: p.date.slice(5) }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          채팅 일별 평균 FRT(최초 응답 소요시간)/ART(매니저 답변 횟수 기준 평균 응대 간격) — 단위가 같아(분) 축 1개를 공유합니다.
        </p>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setViewMode("chart")}
            title="차트로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "chart" ? "bg-white shadow-2xs text-amber-700" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            title="표로 보기"
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              viewMode === "table" ? "bg-white shadow-2xs text-amber-700" : "text-slate-400 hover:text-slate-600"
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
            <YAxis
              tick={{ fontSize: 10, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => `${v}분`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="avgFrtMinutes" stroke={FRT_COLOR} strokeWidth={2} dot={{ r: 3 }} name="평균 FRT" connectNulls />
            <Line type="monotone" dataKey="avgArtMinutes" stroke={ART_COLOR} strokeWidth={2} dot={{ r: 3 }} name="평균 ART" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">날짜</th>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">평균 FRT</th>
                <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">평균 ART</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {points.map(p => (
                <tr key={p.date} className="hover:bg-slate-50/40">
                  <td className="py-1.5 px-3 font-bold text-slate-700 whitespace-nowrap">{p.date}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-600">{formatMinutes(p.avgFrtMinutes)}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-600">{formatMinutes(p.avgArtMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
