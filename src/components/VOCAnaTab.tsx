import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Award, ShieldAlert, Sparkles, Building2, Quote, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useReviews } from "../context/ReviewsContext";

export default function VOCAnaTab() {
  const { weeklyReviews: reviewsData } = useReviews();

  // 1. Dynamic aggregation of categories and their ratings
  const categoryStats = useMemo(() => {
    const categories = ["품질/상태", "배송/포장", "상품구성/양", "서비스/시스템"];
    const agg: Record<string, { recommend: number; neutral: number; notRecommend: number; department: string }> = {
      "품질/상태": { recommend: 0, neutral: 0, notRecommend: 0, department: "SCM & MD" },
      "배송/포장": { recommend: 0, neutral: 0, notRecommend: 0, department: "SCM & CS" },
      "상품구성/양": { recommend: 0, neutral: 0, notRecommend: 0, department: "MD" },
      "서비스/시스템": { recommend: 0, neutral: 0, notRecommend: 0, department: "프로덕트" },
    };

    reviewsData.forEach(r => {
      const cat = agg[r.category] ? r.category : "품질/상태";
      if (r.type === "추천") agg[cat].recommend++;
      else if (r.type === "중립") agg[cat].neutral++;
      else agg[cat].notRecommend++;
    });

    return Object.keys(agg).map(cat => ({
      name: cat,
      "추천 (만족)": agg[cat].recommend,
      "중립 (보통)": agg[cat].neutral,
      "비추천 (불만)": agg[cat].notRecommend,
      department: agg[cat].department,
      total: agg[cat].recommend + agg[cat].neutral + agg[cat].notRecommend,
    }));
  }, [reviewsData]);

  // 2. Identify Top 3 categories of concern based on '비추천' counts
  const topConcernCategories = useMemo(() => {
    return [...categoryStats]
      .sort((a, b) => b["비추천 (불만)"] - a["비추천 (불만)"])
      .slice(0, 3);
  }, [categoryStats]);

  // 3. Find 3 actual critical reviews for each of the top concern categories
  const getCriticalQuotes = (category: string) => {
    return reviewsData
      .filter(r => r.category === category && r.type === "비추천")
      .slice(0, 3);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        
        {/* Left: Chart Column (3/5) */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-3">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">VOC 카테고리별 평가 분포</h3>
            <p className="text-xs text-slate-400 font-medium">카테고리별 추천, 중립, 비추천 건수 비중입니다.</p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryStats}
                margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none" }}
                  itemStyle={{ color: "#f8fafc", fontSize: 11 }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold", fontSize: 11 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: "bold" }} />
                
                {/* Stacked bars - Vibrant Palette Colors */}
                <Bar dataKey="추천 (만족)" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                <Bar dataKey="중립 (보통)" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="비추천 (불만)" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Responsibility Mapping Column (2/5) */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" /> 책임 부서 VOC 매핑 현황
              </h3>
              <p className="text-xs text-slate-400">카테고리별 품질 불만 발생 시 해결/대응 주관 팀입니다.</p>
            </div>

            <div className="space-y-3">
              {categoryStats.map((item, idx) => {
                const totalNotRec = item["비추천 (불만)"];
                const isHighRisk = totalNotRec > 5;
                
                return (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3.5 rounded-lg border transition ${
                      isHighRisk 
                        ? "bg-red-50/20 border-red-100 hover:bg-red-50/40" 
                        : "bg-slate-50/50 border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-400">전체 {item.total}건 중 비추천 {totalNotRec}건</p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-700/10 ring-inset">
                        {item.department}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              * 배송 과정의 파손 및 포장 문제는 물류 파트너 및 배송 포장 가이드라인(SCM & CS)의 정기 점검이 필요하며, 생화 자체의 컨디션 저하 시그널은 산지 조달과 품질 프로세스(SCM & MD)의 개선이 매핑되어 있습니다.
            </p>
          </div>
        </div>

      </div>

      {/* 2. 비추천 TOP 3 VOC 텍스트 표시 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-bold text-slate-900">비추천 TOP 3 주요 VOC 리얼 보이스</h3>
          <span className="text-xs text-slate-400 font-medium">현장 조치를 위한 품질/배송 불만 고객 원문</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {topConcernCategories.map((cat, idx) => {
            const quotes = getCriticalQuotes(cat.name);
            return (
              <div 
                key={idx}
                className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-slate-200 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800">{cat.name}</h4>
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-sm">
                      {cat.department}
                    </span>
                  </div>

                  {/* Customer Voice Carousel/Card style lists */}
                  <div className="space-y-4">
                    {quotes.length > 0 ? (
                      quotes.map((q, qIdx) => (
                        <div key={q.id} className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-slate-600">{q.product}</span>
                            <span className="text-[10px] font-mono text-red-500 font-bold">★ {q.rating}점</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                            &ldquo;{q.review}&rdquo;
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-6">해당 카테고리에 비추천 VOC가 존재하지 않습니다.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">비추천 누적 건수</span>
                  <span className="font-bold text-red-600">{cat["비추천 (불만)"]} 건</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
