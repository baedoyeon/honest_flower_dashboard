import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Award, ShieldAlert, Sparkles, Building2, Quote, AlertTriangle, BookOpen, Layers, CheckCircle2, HelpCircle, FileText, Filter, Search, ShieldCheck, Clock, ExternalLink, ThumbsDown, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useReviews } from "../context/ReviewsContext";
import { classifyCategory, NPS_PURCHASE_TIERS, purchaseTierLabel } from "../utils/csvParser";

function formatWon(n: number): string {
  return `${n.toLocaleString()}원`;
}

export default function VOCAnaTab() {
  const { weeklyReviews: reviewsData, npsDetractorRows, npsPurchaseTierStats, setActiveTab } = useReviews();
  const [activeGuideTab, setActiveGuideTab] = useState<"categories" | "judgment" | "patterns">("categories");

  // 1. Dynamic aggregation of categories and their ratings
  const categoryStats = useMemo(() => {
    const categories = ["품질/상태", "배송/포장", "상품구성/양", "서비스/시스템", "UXUI"];
    const agg: Record<string, { recommend: number; neutral: number; notRecommend: number; department: string }> = {
      "품질/상태": { recommend: 0, neutral: 0, notRecommend: 0, department: "SCM & MD" },
      "배송/포장": { recommend: 0, neutral: 0, notRecommend: 0, department: "SCM & CS" },
      "상품구성/양": { recommend: 0, neutral: 0, notRecommend: 0, department: "MD" },
      "서비스/시스템": { recommend: 0, neutral: 0, notRecommend: 0, department: "프로덕트" },
      "UXUI": { recommend: 0, neutral: 0, notRecommend: 0, department: "개발, 프로덕트" },
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

  // Part F 우선순위 4 — NPS Detractor(0~6점 또는 점수 공란) 피드백을 기존 VOC 대분류(품질/상태·
  // 배송/포장·상품구성/양·서비스/시스템) 기준으로 재사용해 사유별 빈도를 집계한다. classifyCategory는
  // 이미 리뷰 CSV 파싱에도 쓰이는 동일 함수라 리뷰 VOC와 같은 잣대로 비교 가능하다. 실측 기준 Detractor
  // 중 피드백 텍스트가 채워진 비율이 낮으므로(약 19%), 텍스트 없는 응답은 억지로 카테고리에 넣지 않고
  // "사유 미기재"로 별도 카운트만 남긴다 — 채움률 자체를 화면에 명시하는 게 스펙 요건이다.
  const detractorCategoryStats = useMemo(() => {
    const categories = ["품질/상태", "배송/포장", "상품구성/양", "서비스/시스템", "UXUI"] as const;
    const counts: Record<string, number> = { "품질/상태": 0, "배송/포장": 0, "상품구성/양": 0, "서비스/시스템": 0, "UXUI": 0 };
    const revenue: Record<string, number> = { "품질/상태": 0, "배송/포장": 0, "상품구성/양": 0, "서비스/시스템": 0, "UXUI": 0 };
    const samples: Record<string, string[]> = { "품질/상태": [], "배송/포장": [], "상품구성/양": [], "서비스/시스템": [], "UXUI": [] };

    // 이탈위험 매출액 — 피드백 유무와 무관하게 Detractor 전체의 구매비용 합. "몇 명이냐"가 아니라
    // "얼마가 걸려있냐"로 보여줘서 카테고리별 우선순위 판단의 근거로 쓴다(사용자 요청).
    let totalRevenueAtRisk = 0;
    let noFeedbackRevenue = 0;
    let withFeedback = 0;
    npsDetractorRows.forEach(r => {
      totalRevenueAtRisk += r.totalPurchaseAmount || 0;
      if (!r.feedback) {
        noFeedbackRevenue += r.totalPurchaseAmount || 0;
        return;
      }
      withFeedback++;
      const cat = classifyCategory(r.feedback, 0, undefined);
      const key = categories.includes(cat as any) ? cat : "품질/상태";
      counts[key]++;
      revenue[key] += r.totalPurchaseAmount || 0;
      if (samples[key].length < 2) samples[key].push(r.feedback!);
    });

    const detractorTotal = npsDetractorRows.length;
    return {
      total: withFeedback,
      detractorTotal,
      noFeedbackCount: detractorTotal - withFeedback,
      fillRate: detractorTotal > 0 ? Math.round((withFeedback / detractorTotal) * 1000) / 10 : 0,
      totalRevenueAtRisk,
      noFeedbackRevenue,
      breakdown: categories.map(cat => ({ name: cat, count: counts[cat], revenue: revenue[cat], samples: samples[cat] })).sort((a, b) => b.revenue - a.revenue)
    };
  }, [npsDetractorRows]);

  // Part F 지표 #2 — 구매빈도 등급별 이탈률. "Detractor가 몇 명이냐"가 아니라 "우리 단골 고객의
  // 이탈률이 신규 고객보다 높은가"를 봐야 더 급한 신호를 잡아낼 수 있다(사용자 요청). 전체 평균
  // 대비 어느 등급이 더 위험한지 비교하려고 전체 이탈률도 같이 계산한다.
  const purchaseTierRateStats = useMemo(() => {
    const overallTotal = npsPurchaseTierStats.reduce((s, t) => s + t.total, 0);
    const overallDetractors = npsPurchaseTierStats.reduce((s, t) => s + t.detractors, 0);
    const overallRate = overallTotal > 0 ? Math.round((overallDetractors / overallTotal) * 1000) / 10 : 0;
    return {
      overallTotal,
      overallRate,
      tiers: npsPurchaseTierStats.map(t => ({
        ...t,
        rate: t.total > 0 ? Math.round((t.detractors / t.total) * 1000) / 10 : 0
      }))
    };
  }, [npsPurchaseTierStats]);

  // Part F 지표 #3 — 카테고리 × 구매등급 교차표. "배송 문제가 신규고객한테 몰려있나, 품질 문제가
  // 단골한테 몰려있나"를 보려는 것. 피드백 텍스트가 있는 Detractor(전체의 약 19%)만 분류 가능하므로
  // 표본이 작다 — 비율(%)이 아니라 원 건수를 그대로 보여줘서 착시를 만들지 않는다.
  const categoryTierCrosstab = useMemo(() => {
    const categories = ["품질/상태", "배송/포장", "상품구성/양", "서비스/시스템", "UXUI"] as const;
    const tiers = NPS_PURCHASE_TIERS.map(t => t.label);
    const grid: Record<string, Record<string, number>> = {};
    categories.forEach(c => { grid[c] = {}; tiers.forEach(t => { grid[c][t] = 0; }); });

    let totalWithFeedback = 0;
    let maxCell = 0;
    npsDetractorRows.forEach(r => {
      if (!r.feedback) return;
      totalWithFeedback++;
      const cat = classifyCategory(r.feedback, 0, undefined);
      const key = categories.includes(cat as any) ? cat : "품질/상태";
      const tier = purchaseTierLabel(r.purchaseCount);
      grid[key][tier]++;
      maxCell = Math.max(maxCell, grid[key][tier]);
    });

    return { categories, tiers, grid, totalWithFeedback, maxCell };
  }, [npsDetractorRows]);

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

  // 4. Dynamic Auto-Summarizer generated from current reviews dataset
  const vocSummary = useMemo(() => {
    const totalCount = reviewsData.length;
    const recommendCount = reviewsData.filter(r => r.type === "추천").length;
    const neutralCount = reviewsData.filter(r => r.type === "중립").length;
    const notRecommendCount = reviewsData.filter(r => r.type === "비추천").length;

    const notRecReviews = reviewsData.filter(r => r.type === "비추천");
    const recReviews = reviewsData.filter(r => r.type === "추천");

    // Count issue keywords
    const isWither = notRecReviews.filter(r => r.review.includes("시들") || r.review.includes("죽") || r.review.includes("숙여")).length;
    const isDelivery = notRecReviews.filter(r => r.review.includes("박스") || r.review.includes("배송") || r.review.includes("눌려")).length;
    const isQty = notRecReviews.filter(r => r.review.includes("양") || r.review.includes("송이") || r.review.includes("적어")).length;

    return {
      totalCount,
      satisfactionRate: totalCount > 0 ? ((recommendCount / totalCount) * 100).toFixed(1) : "0",
      topPraises: [
        `싱싱한 생화 상태 & 봉오리 개화 과정에 대한 고객 만족도 높음 (추천 ${recReviews.length}건)`,
        "꼼꼼한 오아시스 폼 및 냉장 보냉 박스 포장 상태 호평",
        "플라워 럭키박스 및 스페셜 유레카 장미 구성의 가격 대비 풍성함 강조"
      ],
      topComplaints: [
        `생화 신선도 & 고개 숙임 이슈 (${isWither}건 언급) - 여름철 유통 과정 온습도 관리 필`,
        `택배 박스 눌림 및 줄기 꺾임 (${isDelivery}건 언급) - 배송 포장 고정 밴드 점검`,
        `상품 구성 수량 미달 및 사진 대비 빈약함 (${isQty}건 언급) - MD 출고 규격 재확인`
      ],
      actionItems: [
        { dept: "SCM & MD", task: "여름철 신선도 관리를 위해 과천 물류센터 출고 전 1차 수분 처리(오아시스) 유통 기준 강화" },
        { dept: "SCM & CS", task: "지방 택배사 상하차 파손 방지를 위한 내부 마찰 완충재 밀도 15% 보강 요청" },
        { dept: "프로덕트", task: "자사몰/앱 후기 작성 시 사진 첨부 오류 수정 및 어드민 API 연동 파이프라인 구축" }
      ]
    };
  }, [reviewsData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Executive VOC AI 요약 카드 */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100/80 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-indigo-600 p-2.5 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    전체 고객 VOC & 실시간 리뷰 요약
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                      Auto Executive Summary
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    현재 로드된 {vocSummary.totalCount}건의 고객 VOC 및 후기 텍스트를 파싱하여 도출된 핵심 인사이트 및 부서별 조치 과제입니다.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto bg-white border border-indigo-100 px-3 py-1.5 rounded-xl shadow-2xs text-xs font-bold text-indigo-900">
                <span>고객 추천 만족도:</span>
                <span className="text-indigo-600 font-extrabold text-sm">{vocSummary.satisfactionRate}%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Top Praises */}
              <div className="rounded-2xl bg-white border border-emerald-100 p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <h4 className="text-xs font-bold">주요 고객 긍정 평가 (Praise)</h4>
                </div>
                <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {vocSummary.topPraises.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold shrink-0">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Top Complaints */}
              <div className="rounded-2xl bg-white border border-rose-100 p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                  <h4 className="text-xs font-bold">주요 불만 및 품질 페인포인트</h4>
                </div>
                <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {vocSummary.topComplaints.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold shrink-0">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Department Action Recommendations */}
              <div className="rounded-2xl bg-white border border-indigo-100 p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Building2 className="h-4 w-4" />
                  <h4 className="text-xs font-bold">부서별 우선 조치 권고사항</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  {vocSummary.actionItems.map((item, i) => (
                    <div key={i} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5">
                        {item.dept}
                      </span>
                      <span className="text-[11px] text-slate-700 font-medium leading-tight">{item.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

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
                    <Bar dataKey="추천 (만족)" stackId="a" fill="#7cb342" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="중립 (보통)" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="비추천 (불만)" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Department Mapping Column (2/5) */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-green" /> 책임 부서 VOC 매핑 현황
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
                          <span className="inline-flex items-center rounded-md bg-brand-green-light px-2.5 py-1 text-[11px] font-bold text-brand-green-dark ring-1 ring-brand-green/20 ring-inset">
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
                  * 배송 과정의 파손 및 포장 문제는 SCM & CS에서 관여하며, 신선도 저하는 산지 및 SCM & MD 개선이 연동됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Part F 우선순위 4 — NPS Detractor(0~6점) 피드백 키워드 분석 (기존 VOC 대분류 재사용) */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-rose-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">NPS Detractor(0~6점) 피드백 카테고리 분석</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    업로드된 NPS Detractor 응답의 피드백 텍스트를 위와 동일한 VOC 대분류 기준으로 재분류했습니다.
                  </p>
                </div>
              </div>
            </div>

            {detractorCategoryStats.detractorTotal === 0 ? (
              <div className="text-center py-10 space-y-3">
                <ThumbsDown className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400">아직 업로드된 NPS Detractor 피드백이 없습니다.</p>
                <button
                  onClick={() => setActiveTab("metrics")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green-dark hover:underline cursor-pointer"
                >
                  <span>주간 핵심 지표 탭에서 업로드하기</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-rose-900">이탈위험 매출액</p>
                    <p className="text-[10px] text-rose-700/70 mt-0.5">Detractor {detractorCategoryStats.detractorTotal.toLocaleString()}명이 지금까지 구매한 누적 금액 합계</p>
                  </div>
                  <p className="text-2xl font-black text-rose-700">{formatWon(detractorCategoryStats.totalRevenueAtRisk)}</p>
                </div>

                {purchaseTierRateStats.overallTotal > 0 && (
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="text-xs font-bold text-slate-800">구매빈도 등급별 이탈률</p>
                      <p className="text-[11px] text-slate-400">전체 평균 <span className="font-bold text-slate-600">{purchaseTierRateStats.overallRate}%</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                      {purchaseTierRateStats.tiers.map(t => {
                        const isAboveAvg = t.total > 0 && t.rate > purchaseTierRateStats.overallRate;
                        return (
                          <div
                            key={t.tier}
                            className={`rounded-xl border p-3 text-center ${isAboveAvg ? "border-rose-200 bg-rose-50/50" : "border-slate-100 bg-slate-50/40"}`}
                          >
                            <p className="text-[10px] font-bold text-slate-500">{t.tier}</p>
                            <p className={`text-lg font-black mt-1 ${isAboveAvg ? "text-rose-700" : "text-slate-700"}`}>{t.rate}%</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{t.detractors.toLocaleString()} / {t.total.toLocaleString()}명</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Detractor {detractorCategoryStats.detractorTotal.toLocaleString()}건 중 피드백 텍스트가 있는{" "}
                    <span className="font-bold">{detractorCategoryStats.total.toLocaleString()}건({detractorCategoryStats.fillRate}%)만</span>{" "}
                    아래 카테고리 분석 대상입니다. 나머지 {detractorCategoryStats.noFeedbackCount.toLocaleString()}건(매출 {formatWon(detractorCategoryStats.noFeedbackRevenue)})은 사유 텍스트가 없어(사유 미기재) 집계에서 제외했습니다.
                  </p>
                </div>
                {detractorCategoryStats.total === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">텍스트가 있는 피드백이 없어 카테고리 분석을 표시할 수 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {detractorCategoryStats.breakdown.map((item) => {
                      const pct = detractorCategoryStats.total > 0 ? Math.round((item.count / detractorCategoryStats.total) * 100) : 0;
                      return (
                        <div key={item.name} className="rounded-2xl border border-rose-100 bg-rose-50/20 p-4 space-y-2">
                          <div className="flex items-baseline justify-between">
                            <p className="text-xs font-bold text-slate-800">{item.name}</p>
                            <p className="text-lg font-black text-rose-700">{item.count}<span className="text-[10px] font-bold text-slate-400 ml-0.5">건 ({pct}%)</span></p>
                          </div>
                          <p className="text-xs font-bold text-slate-600">{formatWon(item.revenue)}</p>
                          {item.samples.slice(0, 1).map((s, i) => (
                            <p key={i} className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">"{s}"</p>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {categoryTierCrosstab.totalWithFeedback > 0 && (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-baseline justify-between">
                      <p className="text-xs font-bold text-slate-800">불만유형 × 구매등급 교차표</p>
                      <p className="text-[10px] text-slate-400">피드백 있는 {categoryTierCrosstab.totalWithFeedback.toLocaleString()}건 기준(원 건수)</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-separate border-spacing-1">
                        <thead>
                          <tr>
                            <th className="text-left font-bold text-slate-500 px-2 py-1"></th>
                            {categoryTierCrosstab.tiers.map(tier => (
                              <th key={tier} className="text-center font-bold text-slate-500 px-2 py-1 whitespace-nowrap">{tier}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {categoryTierCrosstab.categories.map(cat => (
                            <tr key={cat}>
                              <td className="text-left font-bold text-slate-700 px-2 py-1 whitespace-nowrap">{cat}</td>
                              {categoryTierCrosstab.tiers.map(tier => {
                                const count = categoryTierCrosstab.grid[cat][tier];
                                const ratio = categoryTierCrosstab.maxCell > 0 ? count / categoryTierCrosstab.maxCell : 0;
                                const bg =
                                  count === 0 ? "bg-slate-50 text-slate-300" :
                                  ratio > 0.7 ? "bg-rose-600 text-white font-bold" :
                                  ratio > 0.4 ? "bg-rose-300 text-rose-950 font-bold" :
                                  ratio > 0.15 ? "bg-rose-100 text-rose-800" :
                                  "bg-rose-50 text-rose-700";
                                return (
                                  <td key={tier} className={`text-center rounded-lg px-2 py-1.5 ${bg}`}>
                                    {count}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">색이 진할수록 해당 (불만유형, 구매등급) 조합의 건수가 많음을 뜻합니다. 표본이 작아 비율이 아닌 건수 그대로 표시합니다.</p>
                  </div>
                )}
              </>
            )}
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

                      <div className="space-y-4">
                        {quotes.length > 0 ? (
                          quotes.map((q) => (
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
