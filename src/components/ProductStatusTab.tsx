import { useState, useMemo } from "react";
import { ProductStat } from "../data/classifiedReviews";
import { AlertTriangle, TrendingDown, CheckCircle2, Search, ArrowUpDown, Flame, HelpCircle, Star, X, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews, AccidentCategoryRecord, AccidentTopCategory } from "../context/ReviewsContext";

// 어드민 사고접수 태깅 대분류 배지 순서 — 미니 브레이크다운도 이 순서로 표시한다.
const ACCIDENT_CATEGORIES: AccidentTopCategory[] = ["품질", "출고", "배송", "기타불만"];
// 대표 인용으로 카드에 바로 노출할 사고접수 상세 개수. 나머지는 "N건 더 보기"로 접는다.
const ACCIDENT_QUOTE_PREVIEW_COUNT = 2;
// 1위-2위 대분류 비중 차이가 이 값(퍼센트 포인트) 이내면 특정 대분류로 단정짓지 않고 "복합 이슈"로 표시.
const MIXED_ISSUE_THRESHOLD_PP = 20;

function summarizeAccidentBreakdown(records: AccidentCategoryRecord[]) {
  const breakdown: Record<AccidentTopCategory, number> = { "품질": 0, "출고": 0, "배송": 0, "기타불만": 0 };
  records.forEach(r => { breakdown[r.topCategory]++; });

  const total = records.length;
  let badgeLabel = "품질 경고"; // 사고접수 레코드가 없는 경우(비추천/저평점만으로 선정된 카드) 기본값 유지
  if (total > 0) {
    const sorted = ACCIDENT_CATEGORIES
      .map(cat => [cat, breakdown[cat]] as const)
      .sort((a, b) => b[1] - a[1]);
    const [topCat, topCount] = sorted[0];
    const secondCount = sorted[1]?.[1] || 0;
    const topPct = (topCount / total) * 100;
    const secondPct = (secondCount / total) * 100;
    badgeLabel = secondCount > 0 && topPct - secondPct <= MIXED_ISSUE_THRESHOLD_PP
      ? "복합 이슈"
      : `${topCat} 경고`;
  }

  return { breakdown, badgeLabel };
}

export default function ProductStatusTab() {
  const {
    weeklyReviews: reviewsData,
    weeklyAccidentCountsByProduct,
    weeklyAccidentRecordsByProduct,
    productStats: productStatsData,
    setActiveTab,
    setMetricsProductFilter,
    setMetricsTypeFilter
  } = useReviews();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof ProductStat>("totalCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  // 카드별 "사고접수 상세 전체 보기" 토글 상태 (product 문자열을 키로 사용)
  const [expandedAccidentCards, setExpandedAccidentCards] = useState<Record<string, boolean>>({});


  // Aggregate stats for the 3 caution products dynamically based on reviews data for the selected period
  const cautionProducts = useMemo(() => {
    // 1. Group reviews by product
    const productGroups: Record<string, typeof reviewsData> = {};
    reviewsData.forEach(r => {
      if (!productGroups[r.product]) {
        productGroups[r.product] = [];
      }
      productGroups[r.product].push(r);
    });

    // 별점 리뷰가 아예 없고 CS 사고접수만 있는 상품(예: 아세비)도 후보에서 빠지지 않도록 시드해둔다.
    // reviewsData만 순회하면 이런 상품은 productGroups에 키 자체가 안 생겨서, 아래 accidentCount>0
    // 필터가 있어도 애초에 후보 목록에 오르지 못해 "품질 경고"에서 통째로 누락되는 문제가 있었다.
    Object.keys(weeklyAccidentCountsByProduct).forEach(product => {
      if (!productGroups[product]) {
        productGroups[product] = [];
      }
    });

    // 2. Calculate stats for each product
    const stats = Object.entries(productGroups).map(([product, list]) => {
      const total = list.length;
      const recommend = list.filter(r => r.type === "추천").length;
      const neutral = list.filter(r => r.type === "중립").length;
      const notRecommend = list.filter(r => r.type === "비추천").length;
      
      const accidentCount = weeklyAccidentCountsByProduct[product] || 0;

      const ratedList = list.filter(r => r.rating > 0);
      const sumRating = ratedList.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = ratedList.length > 0 ? Math.round((sumRating / ratedList.length) * 100) / 100 : 0;
      const recommendRate = total > 0 ? Math.round((recommend / total) * 100) : 0;

      // "Caution Score" — 비율 기반으로 재계산(실측으로 확인된 볼륨 편향 수정). 예전엔 원시 카운트에
      // 리뷰량 보너스(total*0.1)까지 더해서, 리뷰가 많이 달리는 상품(예: 플라워 럭키박스)이 실제
      // 불량률과 무관하게 항상 최상위를 차지했다 — 리뷰 10건 중 4건이 비추천인 상품과 리뷰 100건 중
      // 4건이 비추천인 상품이 똑같이 "notRecommend*40"으로 집계되던 게 원인. 리뷰가 있는 상품은
      // notRecommend/neutral을 리뷰 수 대비 비율로, 사고접수는 리뷰 수 대비 비율로 계산해 "이 상품을
      // 접한 사람 중 얼마나 문제를 겪었나"를 반영한다. 리뷰가 아예 없는(사고접수만 있는) 상품은 비교
      // 대상이 없으니 사고접수 건수를 그대로 쓴다. avgRating은 실제 평점 데이터가 있을 때만 감점하고
      // (0점=무평점을 "최악의 평점"으로 오인하면 안 됨), 없으면 감점하지 않는다.
      const hasReviews = total > 0;
      const notRecommendRate = hasReviews ? notRecommend / total : 0;
      const neutralRate = hasReviews ? neutral / total : 0;
      const accidentSignal = hasReviews ? (accidentCount / total) * 50 : accidentCount * 50;
      const ratingPenalty = ratedList.length > 0 ? (5 - avgRating) * 15 : 0;
      const cautionScore = (notRecommendRate * 40) + accidentSignal + (neutralRate * 10) + ratingPenalty;

      return {
        product,
        total,
        recommend,
        neutral,
        notRecommend,
        accidentCount,
        avgRating,
        recommendRate,
        cautionScore,
        reviews: list
      };
    });

    // 3. Filter to products with at least some neutral or negative signal or accidents OR are generally low rated (< 4.2).
    // avgRating<4.2 조건은 실제 별점 리뷰가 있을 때만 의미가 있다 — 위에서 사고접수만으로 시드된
    // 상품은 리뷰가 없어 avgRating이 0으로 잡히는데, 그 0을 "저평점"으로 오인해 (반려/접수중처럼)
    // 확정된 사고가 아닌 건까지 품질 경고로 잘못 띄우면 안 된다.
    const sortedStats = stats
      .filter(s => s.notRecommend > 0 || s.accidentCount > 0 || s.neutral > 0 || (s.total > 0 && s.avgRating < 4.2))
      .sort((a, b) => b.cautionScore - a.cautionScore);

    // If we have fewer than 3, we append other products sorted by lowest rating
    const finalProducts = [...sortedStats];
    if (finalProducts.length < 3) {
      // avgRating===0은 "최악의 평점"이 아니라 "평점 데이터 없음"이라, 무평점 상품이 실제 저평점
      // 상품보다 먼저 채워지면 안 된다 — 리뷰 있는 상품을 우선하고, 그 안에서만 평점 낮은 순.
      const remaining = stats
        .filter(s => !finalProducts.some(fp => fp.product === s.product))
        .sort((a, b) => {
          if ((a.total > 0) !== (b.total > 0)) return a.total > 0 ? -1 : 1;
          return a.avgRating - b.avgRating;
        });
      
      for (const r of remaining) {
        if (finalProducts.length >= 3) break;
        finalProducts.push(r);
      }
    }

    // Take top 3
    const top3 = finalProducts.slice(0, 3);

    // 4. Map them to caution card structure with dynamically generated tagline and description derived from reviews & accidents
    return top3.map((item, idx) => {
      const { product, total, recommend, neutral, notRecommend, accidentCount, avgRating, recommendRate, reviews: productReviews } = item;
      
      // Extract specific issues by analyzing review text keywords & accidents
      const negativeReviews = productReviews.filter(r => r.type === "비추천" || r.type === "중립");
      // 실제 사고접수(ProblemForm/Incident) 레코드 — weeklyAccidentCountsByProduct와 동일 소스라
      // accidentRecords.length가 항상 accidentCount와 일치한다(리뷰 전체를 통째로 나열하던 버그 수정).
      const accidentRecords: AccidentCategoryRecord[] = weeklyAccidentRecordsByProduct[product] || [];

      let issues: string[] = [];
      let hasWilt = false;
      let hasBroken = false;
      let hasPests = false;
      let hasVolume = false;
      let hasDelivery = false;

      negativeReviews.forEach(r => {
        const text = r.review;
        if (/시들|시든|시들어|컨디션|상태|싱싱|생기/.test(text)) hasWilt = true;
        if (/부러|꺾|으깨|상처|가지|머리|꺾임/.test(text)) hasBroken = true;
        if (/벌레|날파리|모기|유입/.test(text)) hasPests = true;
        if (/양|구성|풍성|부족|다름|홍보|작아|적음|적어/.test(text)) hasVolume = true;
        if (/배송|포장|누락|지연|박스/.test(text)) hasDelivery = true;
      });

      if (hasWilt) issues.push("시들음/갈변");
      if (hasBroken) issues.push("가지/줄기 꺾임");
      if (hasPests) issues.push("날파리/해충 유입");
      if (hasVolume) issues.push("풍성함 부족");
      if (hasDelivery) issues.push("배송 지연/포장 손상");

      // 카드에 바로 노출할 대표 인용(중복 제거 후 앞 2개) — 나머지는 토글/사고접수 탭 링크로 대체
      const accidentDetailsList: string[] = [];
      accidentRecords.forEach(r => {
        if (r.detail && !accidentDetailsList.includes(r.detail)) {
          accidentDetailsList.push(r.detail);
        }
      });
      const { breakdown: accidentBreakdown, badgeLabel } = summarizeAccidentBreakdown(accidentRecords);

      if (accidentCount > 0) {
        issues.push(`CS 사고접수 ${accidentCount}건`);
      }

      // Default issue categories based on review category if text matching didn't yield anything
      if (issues.length === 0 && negativeReviews.length > 0) {
        const catCounts: Record<string, number> = {};
        negativeReviews.forEach(r => {
          catCounts[r.category] = (catCounts[r.category] || 0) + 1;
        });
        const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topCat) {
          if (topCat === "품질/상태") issues.push("꽃 컨디션 저하");
          else if (topCat === "배송/포장") issues.push("배송 중 컨디션 훼손");
          else if (topCat === "상품구성/양") issues.push("구성품 부족 및 누락");
          else if (topCat === "UXUI") issues.push("웹/앱 사용성 불편");
          else issues.push("서비스 만족도 아쉬움");
        }
      }

      // If there are still no issues (product is actually recommended but selected to fill 3 spots)
      if (issues.length === 0) {
        issues.push("안정적인 품질");
      }

      // Generate tagline
      const issuesStr = issues.join(" 및 ");
      const tagline = (notRecommend > 0 || accidentCount > 0)
        ? `${issuesStr} 긴급 점검 필요`
        : neutral > 0
          ? `${issuesStr} 관련 아쉬움 제기`
          : "전반적으로 우수한 평가를 유지 중";

      // Find the most representative critical review for the description
      const repReview = negativeReviews.find(r => r.review.length > 15)?.review || 
                        negativeReviews[0]?.review || 
                        productReviews[0]?.review || 
                        "";
      
      // Generate description — 사고접수 상세는 카드 내 별도 섹션(브레이크다운+대표 인용)에서
      // 노출하므로, 요약 문단은 일반 후기 인용 하나만 유지해 카드가 무한정 길어지지 않게 한다.
      let desc = "";
      if (notRecommend > 0 || neutral > 0 || accidentCount > 0) {
        const quotePart = repReview ? `\n\n💬 일반 후기 내용: "${repReview.length > 80 ? repReview.slice(0, 80) + "..." : repReview}"` : "";
        desc = `이번 분석 기간 중 '${product}' 상품에서 ${issuesStr} 관련 피드백이 집중 접수되었습니다. 출고 전 검수 방식을 정비하고 즉각 조치할 필요가 있습니다.${quotePart}`;
      } else {
        desc = `'${product}' 상품은 이번 분석 기간 동안 비추천 및 사고접수 피드백 없이 균일한 만족도를 기록하고 있습니다. 지속적인 사후 모니터링을 통해 우수한 퀄리티를 유지해 주세요.`;
      }

      return {
        id: `dynamic_${idx}_${product.replace(/\s+/g, "_")}`,
        title: product,
        keyword: product,
        tagline,
        desc,
        total,
        recommend,
        neutral,
        notRecommend,
        accidentCount,
        avgRating,
        recommendRate,
        badgeLabel,
        accidentBreakdown,
        accidentDetailsList
      };
    });
  }, [reviewsData, weeklyAccidentCountsByProduct, weeklyAccidentRecordsByProduct]);

  // Filter & Sort table data
  const handleSort = (field: keyof ProductStat) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredStats = useMemo(() => {
    const filtered = productStatsData.filter(item => 
      item.product.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      return 0;
    });
  }, [searchTerm, sortField, sortOrder]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* 1. 요주의 상품 카드 섹션 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-bold text-slate-900">요주의 위크 핵심 케어 상품 (3종)</h3>
          <span className="text-xs text-slate-400">선택한 기간 내 비추천 및 부정적 평가 기준 자동 산출</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cautionProducts.length === 0 ? (
            <div className="lg:col-span-3 bg-red-50/5 border border-red-100 rounded-3xl p-8 text-center">
              <p className="text-xs font-bold text-slate-500">조회 범위 내 품질 경고 데이터가 발생하지 않았습니다.</p>
            </div>
          ) : cautionProducts.map((p, idx) => (
            <div 
              key={p.id}
              className="rounded-3xl border border-red-100 bg-red-50/10 p-6 shadow-sm flex flex-col justify-between hover:border-red-200 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">
                      {p.badgeLabel}
                    </span>
                    <h4 className="text-base font-black text-slate-900">{p.title}</h4>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                </div>

                <p className="text-xs font-bold text-red-600 mt-1">{p.tagline}</p>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed font-medium whitespace-pre-line">{p.desc}</p>

                {p.accidentCount > 0 && (
                  <div className="mt-3 rounded-xl bg-purple-50/60 border border-purple-100 p-2.5">
                    <p className="text-[10px] font-bold text-purple-700 mb-1.5">🚨 CS 사고접수 상세 ({p.accidentCount}건)</p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {Object.entries(p.accidentBreakdown)
                        .filter(([, count]) => count > 0)
                        .map(([category, count]) => (
                          <span key={category} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-purple-200 text-purple-600">
                            {category} {count}
                          </span>
                        ))}
                    </div>
                    {(expandedAccidentCards[p.id] ? p.accidentDetailsList : p.accidentDetailsList.slice(0, ACCIDENT_QUOTE_PREVIEW_COUNT)).map((detail, i) => (
                      <p key={i} className="text-[10px] text-slate-500 leading-relaxed">
                        · {detail.length > 60 ? `${detail.slice(0, 60)}...` : detail}
                      </p>
                    ))}
                    <div className="flex items-center gap-2.5 mt-1.5">
                      {p.accidentDetailsList.length > ACCIDENT_QUOTE_PREVIEW_COUNT && (
                        <button
                          onClick={() => setExpandedAccidentCards(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          className="text-[10px] font-bold text-purple-600 hover:underline cursor-pointer focus:outline-hidden"
                        >
                          {expandedAccidentCards[p.id] ? "접기" : `사유 전체 보기 (${p.accidentDetailsList.length})`}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMetricsProductFilter(p.title);
                          setMetricsTypeFilter("사고접수");
                          setActiveTab("metrics");
                        }}
                        className="text-[10px] font-bold text-purple-600 hover:underline cursor-pointer focus:outline-hidden"
                      >
                        사고접수 탭에서 보기 →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Stats Grid with custom rounded corners */}
              <div className="mt-5 pt-3.5 border-t border-red-100/60 grid grid-cols-5 text-center gap-1 bg-white/80 rounded-2xl p-2.5 border border-red-100/40">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">전체</p>
                  <p className="text-xs font-black text-slate-800">{p.total}건</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">추천율</p>
                  <p className="text-xs font-black text-red-600">{p.recommendRate}%</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">평균별점</p>
                  <p className="text-xs font-black text-slate-800">★ {p.avgRating}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">비추천</p>
                  <button 
                    onClick={() => {
                      if (p.notRecommend > 0) {
                        setMetricsProductFilter(p.title);
                        setMetricsTypeFilter("비추천");
                        setActiveTab("metrics");
                      }
                    }}
                    className={`text-xs font-black text-red-600 hover:underline cursor-pointer focus:outline-hidden ${p.notRecommend > 0 ? "" : "opacity-30 pointer-events-none"}`}
                  >
                    {p.notRecommend}건
                  </button>
                </div>
                <div>
                  <p className="text-[9px] text-purple-600 font-bold uppercase">사고접수</p>
                  <button 
                    onClick={() => {
                      if ((p.accidentCount || 0) > 0) {
                        setMetricsProductFilter(p.title);
                        setMetricsTypeFilter("사고접수");
                        setActiveTab("metrics");
                      }
                    }}
                    className={`text-xs font-black text-purple-700 hover:underline cursor-pointer focus:outline-hidden ${(p.accidentCount || 0) > 0 ? "" : "opacity-30 pointer-events-none"}`}
                  >
                    {p.accidentCount || 0}건
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 상품별 현황 테이블 */}
      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">상품별 만족도 & 별점 현황</h3>
            <p className="text-xs text-slate-400">각 상품들의 전체 리뷰 건수와 추천율, 별점 평균을 확인할 수 있습니다.</p>
          </div>
          
          {/* Search bar */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="상품명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green bg-white"
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  상품명
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("totalCount")}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    전체건수 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("recommend")}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    추천 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("neutral")}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    중립 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("notRecommend")}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    비추천 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("accidentCount" as any)}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-purple-600 uppercase tracking-wider cursor-pointer hover:bg-purple-50 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    사고접수 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("recommendRate")}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    추천율 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  onClick={() => handleSort("avgRating")}
                  className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-end gap-1">
                    평균별점 <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStats.length > 0 ? (
                filteredStats.map((item, idx) => {
                  const isHighRate = item.recommendRate === 100 && item.totalCount >= 1;
                  const isLowRate = item.recommendRate < 70 && item.totalCount >= 1;

                  return (
                    <tr 
                      key={idx}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isHighRate ? "bg-emerald-50/10" : isLowRate ? "bg-rose-50/10" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isHighRate && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          )}
                          {isLowRate && (
                            <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
                            {item.product}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs font-medium text-slate-600">
                        {item.totalCount}건
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs text-brand-green-dark font-semibold">
                        <button
                          onClick={() => {
                            if (item.recommend > 0) {
                              setMetricsProductFilter(item.product);
                              setMetricsTypeFilter("추천");
                              setActiveTab("metrics");
                            }
                          }}
                          className={`px-2 py-1 rounded-md transition-all ${
                            item.recommend > 0 
                              ? "hover:bg-brand-green-light hover:underline cursor-pointer text-brand-green-dark font-bold animate-pulse-subtle" 
                              : "text-slate-300 pointer-events-none"
                          }`}
                        >
                          {item.recommend}건
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs text-amber-600 font-semibold">
                        <button
                          onClick={() => {
                            if (item.neutral > 0) {
                              setMetricsProductFilter(item.product);
                              setMetricsTypeFilter("중립");
                              setActiveTab("metrics");
                            }
                          }}
                          className={`px-2 py-1 rounded-md transition-all ${
                            item.neutral > 0 
                              ? "hover:bg-amber-50 hover:underline cursor-pointer text-amber-600 font-bold" 
                              : "text-slate-300 pointer-events-none"
                          }`}
                        >
                          {item.neutral}건
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs text-rose-500 font-semibold">
                        <button
                          onClick={() => {
                            if (item.notRecommend > 0) {
                              setMetricsProductFilter(item.product);
                              setMetricsTypeFilter("비추천");
                              setActiveTab("metrics");
                            }
                          }}
                          className={`px-2 py-1 rounded-md transition-all ${
                            item.notRecommend > 0 
                              ? "hover:bg-rose-50 hover:underline cursor-pointer text-rose-600 font-bold" 
                              : "text-slate-300 pointer-events-none"
                          }`}
                        >
                          {item.notRecommend}건
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs text-purple-600 font-semibold">
                        <button
                          onClick={() => {
                            if ((item.accidentCount || 0) > 0) {
                              setMetricsProductFilter(item.product);
                              setMetricsTypeFilter("사고접수");
                              setActiveTab("metrics");
                            }
                          }}
                          className={`px-2 py-1 rounded-md transition-all ${
                            (item.accidentCount || 0) > 0 
                              ? "hover:bg-purple-50 hover:underline cursor-pointer text-purple-700 font-bold bg-purple-50/60" 
                              : "text-slate-300 pointer-events-none"
                          }`}
                        >
                          {item.accidentCount || 0}건
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isHighRate 
                            ? "bg-emerald-50 text-emerald-700" 
                            : isLowRate 
                              ? "bg-rose-50 text-rose-700" 
                              : "bg-slate-50 text-slate-700"
                        }`}>
                          {item.recommendRate}%
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-xs font-bold text-slate-800 font-mono">
                        ★ {item.avgRating.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-slate-400">
                    검색 결과에 일치하는 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
