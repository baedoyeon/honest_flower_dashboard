import { useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { CheckCircle2, Info } from "lucide-react";
import { Forecast2026 } from "../utils/chatRoomEngine";

function Sparkline({ data, dataKey, color }: { data: Forecast2026[]; dataKey: keyof Forecast2026; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Forecast2026Panel({
  trend, monthlyCsLaborCostAllocation, setMonthlyCsLaborCostAllocation,
}: {
  trend: Forecast2026[];
  monthlyCsLaborCostAllocation: number;
  setMonthlyCsLaborCostAllocation: (won: number) => void;
}) {
  const [draftAllocation, setDraftAllocation] = useState(String(monthlyCsLaborCostAllocation));

  if (trend.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-10">아직 예측지표를 계산할 데이터가 없습니다.</p>;
  }

  const latest = trend[trend.length - 1];

  const verifiedCards: { label: string; value: string; dataKey: keyof Forecast2026; color: string }[] = [
    { label: "26년 CPO 예상", value: `${latest.cpoForecastPct.toFixed(1)}%`, dataKey: "cpoForecastPct", color: "#3b82f6" },
    { label: "26년 일평균 문의량 예상", value: `${latest.dailyAvgInquiries}건`, dataKey: "dailyAvgInquiries", color: "#06b6d4" },
    { label: "26년 월평균 문의량 예상", value: `${Math.round(latest.monthlyAvgInquiries)}건`, dataKey: "monthlyAvgInquiries", color: "#8b5cf6" },
  ];

  const commitAllocation = () => {
    const parsed = parseInt(draftAllocation.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      setMonthlyCsLaborCostAllocation(parsed);
      setDraftAllocation(String(parsed));
    } else {
      setDraftAllocation(String(monthlyCsLaborCostAllocation));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-emerald-900 leading-relaxed">
          CPO 예상 / 일평균·월평균 문의량 예상 3개는 시트 셀 수식을 직접 열지 못해 1~7월 실측값과 시트 예상값을 대조하는
          방식으로 역산 확정한 산출식입니다(7개월 전부 소수점 오차 없이 일치 확인).
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-900 leading-relaxed">
          "26년 예상 건당 코스트"는 위 3개와 성격이 다릅니다 — 실측값이 아니라 <b>CS 업무에 배분된 월 인건비를 주관적으로
          추산한 근사치</b>가 분자입니다(어드민의 "CS 비용 다운로드" export는 확인 결과 환불금액 재계산 사본일 뿐이라 인건비와
          무관 — 이미 이 대시보드가 추적 중인 값과 같은 개념). 아래 값을 실제 배분 감각에 맞게 직접 조정하세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
        <label className="text-xs font-bold text-slate-600 shrink-0">월 CS 인건비 배분 추정치</label>
        <input
          type="text"
          inputMode="numeric"
          value={draftAllocation}
          onChange={(e) => setDraftAllocation(e.target.value)}
          onBlur={commitAllocation}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono text-right focus:outline-hidden focus:ring-1 focus:ring-amber-400"
        />
        <span className="text-xs text-slate-500">원 / 월</span>
        <span className="text-[10px] text-slate-400">(기본값 2,000,000원 — 옛 시트도 동일한 하드코딩 값 사용)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {verifiedCards.map(c => (
          <div key={c.label} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
            <p className="text-[11px] font-bold text-slate-500">{c.label}</p>
            <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
            <div className="mt-2">
              <Sparkline data={trend} dataKey={c.dataKey} color={c.color} />
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
          <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
            26년 예상 건당 코스트
            <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full border border-amber-200">
              주관적 추정치
            </span>
          </p>
          <p className="text-lg font-black text-amber-950 mt-1">
            {latest.costPerInquiryForecast !== undefined ? `${Math.round(latest.costPerInquiryForecast).toLocaleString()}원` : "-"}
          </p>
          <div className="mt-2">
            <Sparkline data={trend} dataKey="costPerInquiryForecast" color="#f59e0b" />
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">월</th>
              <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">CPO 예상</th>
              <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">일평균 문의량</th>
              <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">월평균 문의량</th>
              <th className="py-2 px-3 font-bold text-slate-500 border-b border-slate-200 text-right whitespace-nowrap">건당 코스트(추정)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trend.map(f => (
              <tr key={f.month} className="hover:bg-slate-50/40">
                <td className="py-1.5 px-3 font-bold text-slate-700 whitespace-nowrap">{f.label}</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-600">{f.cpoForecastPct.toFixed(1)}%</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-600">{f.dailyAvgInquiries}건</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-600">{Math.round(f.monthlyAvgInquiries)}건</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                  {f.costPerInquiryForecast !== undefined ? `${Math.round(f.costPerInquiryForecast).toLocaleString()}원` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
