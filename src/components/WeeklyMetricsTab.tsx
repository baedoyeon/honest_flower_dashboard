import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { ArrowDownRight, ArrowUpRight, MessageSquare, AlertTriangle, Lightbulb, Users, BarChart2, Star, Search, Sparkles, ThumbsUp, X, Sprout, ArrowUpDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews, getGroupKeysMap } from "../context/ReviewsContext";
import { computeNpsRates } from "../utils/csvParser";
import NpsSummaryUploader from "./NpsSummaryUploader";
import NpsWatchlistWidget from "./NpsWatchlistWidget";
import NpsTrendWidget from "./NpsTrendWidget";
import { useState, useMemo } from "react";

export default function WeeklyMetricsTab() {
  const { 
    weeklyReviews: allWeeklyReviews, 
    weeklyIncidents,
    archiveActiveReviews,
    isSyncing,
    metricsProductFilter,
    setMetricsProductFilter,
    metricsTypeFilter: selectedCardFilter,
    setMetricsTypeFilter: setSelectedCardFilter,
    weekFilter,
    setActiveTab,
    npsSummary
  } = useReviews();

  const npsRates = useMemo(() => computeNpsRates(npsSummary), [npsSummary]);

  const periodLabel = weekFilter === "this" ? "금주" : weekFilter === "last" ? "전주" : "전체기간";

  // Precompute group keys mapping for all weekly reviews using high-precision similarity logic
  const groupKeysMap = useMemo(() => getGroupKeysMap(allWeeklyReviews), [allWeeklyReviews]);

  const reviewsData = useMemo(() => {
    if (!metricsProductFilter) return allWeeklyReviews;
    const pLower = metricsProductFilter.toLowerCase();
    return allWeeklyReviews.filter(r => 
      r.product.toLowerCase() === pLower ||
      r.product.toLowerCase().includes(pLower) ||
      pLower.includes(r.product.toLowerCase())
    );
  }, [allWeeklyReviews, metricsProductFilter]);

  const matchingIncidents = useMemo(() => {
    if (!metricsProductFilter) return weeklyIncidents;
    const pLower = metricsProductFilter.toLowerCase();
    return weeklyIncidents.filter(i =>
      i.product.toLowerCase() === pLower ||
      i.product.toLowerCase().includes(pLower) ||
      pLower.includes(i.product.toLowerCase())
    );
  }, [weeklyIncidents, metricsProductFilter]);

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dynamic calculations based on live reviews data
  const totalCount = reviewsData.length;
  const recommendCount = reviewsData.filter(r => r.type === "추천").length;
  const neutralCount = reviewsData.filter(r => r.type === "중립").length;
  const notRecommendCount = reviewsData.filter(r => r.type === "비추천").length;
  const accidentCount = matchingIncidents.length;

  const recommendRate = totalCount > 0 ? Math.round((recommendCount / totalCount) * 1000) / 10 : 0;
  const neutralRate = totalCount > 0 ? Math.round((neutralCount / totalCount) * 1000) / 10 : 0;
  const notRecommendRate = totalCount > 0 ? Math.round((notRecommendCount / totalCount) * 1000) / 10 : 0;
  const accidentRate = totalCount > 0 ? Math.round((accidentCount / totalCount) * 1000) / 10 : 0;

  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<{ url: string; title: string } | null>(null);

  // Comparison logic against live 전사 NPS baseline (ReviewsContext.npsSummary, 업로드 전엔 확인 시점
  // 스냅샷 시드값) — 예전엔 86.1/9.0/4.9가 코드에 그대로 박혀 있던 오래된 목업값이었다.
  const npsBarKey = `누적 NPS (${npsSummary.total.toLocaleString()}건)`;
  const photoReviewBarKey = `${periodLabel} 사진 후기 (${totalCount}건)`;

  const isRecommendLower = recommendRate < npsRates.promoterRate;
  const recommendDiff = Math.abs(recommendRate - npsRates.promoterRate).toFixed(1);

  const isDetractorHigher = notRecommendRate > npsRates.detractorRate;
  const detractorDiff = Math.abs(notRecommendRate - npsRates.detractorRate).toFixed(1);

  const comparisonData = useMemo(() => {
    return [
      { name: "추천 (Promoter)", [photoReviewBarKey]: recommendRate, [npsBarKey]: npsRates.promoterRate },
      { name: "중립 (Passive)", [photoReviewBarKey]: neutralRate, [npsBarKey]: npsRates.passiveRate },
      { name: "비추천 (Detractor)", [photoReviewBarKey]: notRecommendRate, [npsBarKey]: npsRates.detractorRate },
    ];
  }, [photoReviewBarKey, npsBarKey, recommendRate, neutralRate, notRecommendRate, npsRates]);

  // Compute filtered incidents list for the detailed interactive list at the bottom when 사고접수 is selected
  const filteredIncidents = useMemo(() => {
    let list = [...matchingIncidents];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => 
        (i.claimText && i.claimText.toLowerCase().includes(q)) ||
        (i.product && i.product.toLowerCase().includes(q)) ||
        (i.reviewer && i.reviewer.toLowerCase().includes(q)) ||
        (i.customerName && i.customerName.toLowerCase().includes(q)) ||
        (i.accidentType && i.accidentType.toLowerCase().includes(q)) ||
        (i.accidentDetail && i.accidentDetail.toLowerCase().includes(q)) ||
        (i.id && i.id.toLowerCase().includes(q)) ||
        (i.orderNumber && i.orderNumber.toLowerCase().includes(q)) ||
        (i.csResponse && i.csResponse.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (a.date !== b.date) {
        return sortOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      }
      const aId = Number(String(a.id).replace(/\D/g, "")) || 0;
      const bId = Number(String(b.id).replace(/\D/g, "")) || 0;
      return sortOrder === "desc" ? bId - aId : aId - bId;
    });

    return list;
  }, [matchingIncidents, searchQuery, sortOrder]);

  // Compute filtered reviews list for the detailed interactive list at the bottom
  const filteredReviews = useMemo(() => {
    let list = [...reviewsData];
    if (selectedCardFilter !== "all") {
      list = list.filter(r => r.type === selectedCardFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.review.toLowerCase().includes(q) || 
        r.product.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }

    // Group reviews with the same reviewer, date, and highly similar content consecutively
    const groupRepresentatives = new Map<string, { maxId: number; date: string }>();
    
    // High-precision helper to get group key
    const getGroupKey = (r: any) => {
      return groupKeysMap.get(r.id) || `group_fallback_${r.id}`;
    };

    list.forEach(r => {
      const groupKey = getGroupKey(r);
      const current = groupRepresentatives.get(groupKey);
      if (!current) {
        groupRepresentatives.set(groupKey, { maxId: Number(r.id), date: r.date });
      } else {
        current.maxId = Math.max(current.maxId, Number(r.id));
      }
    });

    list.sort((a, b) => {
      const aGroupKey = getGroupKey(a);
      const bGroupKey = getGroupKey(b);

      if (aGroupKey === bGroupKey) {
        return sortOrder === "desc"
          ? Number(b.id) - Number(a.id)
          : Number(a.id) - Number(b.id);
      }

      const aRep = groupRepresentatives.get(aGroupKey)!;
      const bRep = groupRepresentatives.get(bGroupKey)!;

      // Primary sort: Date (chronological)
      if (aRep.date !== bRep.date) {
        return sortOrder === "desc"
          ? bRep.date.localeCompare(aRep.date)
          : aRep.date.localeCompare(bRep.date);
      }

      // Secondary sort: maxId as tie-breaker
      return sortOrder === "desc"
        ? bRep.maxId - aRep.maxId
        : aRep.maxId - bRep.maxId;
    });

    return list;
  }, [reviewsData, selectedCardFilter, searchQuery, sortOrder, groupKeysMap]);

  // Dynamic insights text based on the selected card filter and current reviewsData
  const activeInsight = useMemo(() => {
    switch (selectedCardFilter) {
      case "추천": {
        const positiveReviews = reviewsData.filter(r => r.type === "추천");
        const total = positiveReviews.length;
        if (total === 0) {
          return {
            title: "추천(Positive) 핵심 요인",
            sub: "💡 추천 고객이 가장 매료되는 포인트는?",
            boldText: "“현재 분석 데이터 내에 추천 피드백이 없습니다.”",
            desc: "현재 적용된 필터 조건 하에 추천(만족) 피드백이 집계되지 않은 상태입니다.",
            tip: "고객 만족도 증대를 위해 제품 패키징 개선 및 사후 관리 프로세스 강화 제안"
          };
        }
        
        const counts: Record<string, number> = {};
        positiveReviews.forEach(r => {
          counts[r.category] = (counts[r.category] || 0) + 1;
        });
        
        const sortedCategories = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topCategory = sortedCategories[0]?.[0] || "품질/상태";
        const topCount = sortedCategories[0]?.[1] || 0;
        const topPercent = total > 0 ? Math.round((topCount / total) * 100) : 0;
        
        const breakdownStr = sortedCategories.map(([cat, count]) => `${cat}(${Math.round((count / total) * 100)}%)`).join(", ");
        
        return {
          title: "추천(Positive) 핵심 요인",
          sub: "💡 추천 고객이 가장 매료되는 포인트는?",
          boldText: `“시각적 감동을 주는 '${topCategory}' (${topPercent}%)의 높은 기여도”`,
          desc: `현재 추천 피드백을 분석한 결과, 고객들이 매료되는 요인은 ${breakdownStr} 순서로 나타납니다. 특히 '${topCategory}' 요인이 핵심 원동력으로 분석되며, 이를 표준 성공 사례로 매뉴얼화하여 상품 경쟁력을 한층 더 극대화할 수 있습니다.`,
          tip: `${topCategory} 관련 성공적인 구성을 유지 및 강화하여 긍정적 바이럴 마케팅 지속`
        };
      }
      case "중립": {
        const neutralReviews = reviewsData.filter(r => r.type === "중립");
        const total = neutralReviews.length;
        if (total === 0) {
          return {
            title: "중립(Neutral) 전환 요인",
            sub: "💡 중립 고객을 추천 고객으로 만들려면?",
            boldText: "“현재 분석 데이터 내에 중립 피드백이 없습니다.”",
            desc: "현재 적용된 필터 조건 하에 중립 피드백이 집계되지 않은 상태입니다.",
            tip: "고객 만족도 다변화 상시 모니터링 진행"
          };
        }
        
        const counts: Record<string, number> = {};
        neutralReviews.forEach(r => {
          counts[r.category] = (counts[r.category] || 0) + 1;
        });
        
        const sortedCategories = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topCategory = sortedCategories[0]?.[0] || "품질/상태";
        const topCount = sortedCategories[0]?.[1] || 0;
        const topPercent = total > 0 ? Math.round((topCount / total) * 100) : 0;
        
        const breakdownStr = sortedCategories.map(([cat, count]) => `${cat}(${Math.round((count / total) * 100)}%)`).join(", ");
        
        return {
          title: "중립(Neutral) 전환 요인",
          sub: "💡 중립 고객을 추천 고객으로 만들려면?",
          boldText: `“아쉬움을 보완해야 할 '${topCategory}' (${topPercent}%) 개선 과제”`,
          desc: `현재 중립 고객들의 피드백 요인 분포는 ${breakdownStr} 순서로 나타납니다. 대체적인 제품 만족도는 양호하나 '${topCategory}' 영역에서의 미흡함이 지적되고 있으며, 이 세부 원인들을 선제 조치하면 우수 추천(Promoter) 고객군으로 즉각 전향될 수 있습니다.`,
          tip: `${topCategory} 피드백 내 구체적 아쉬움(개화 시기, 배송 알림 등)을 분석하여 맞춤 서비스 개선 조치`
        };
      }
      case "비추천": {
        const criticalReviews = reviewsData.filter(r => r.type === "비추천");
        const total = criticalReviews.length;
        if (total === 0) {
          return {
            title: "비추천(Critical) 긴급 조치 요인",
            sub: "💡 비추천 후기가 경고하는 치명적인 위험?",
            boldText: "“현재 분석 데이터 내에 비추천 피드백이 없습니다.”",
            desc: "현재 적용된 필터 범위 내에서 비추천(불만족) 피드백이 발생하지 않아 청정하고 우수한 품질 관리 상태를 보여주고 있습니다.",
            tip: "우수 품질 유지 관리를 위해 상시 품질 검수 루프 활성화"
          };
        }
        
        const counts: Record<string, number> = {};
        criticalReviews.forEach(r => {
          counts[r.category] = (counts[r.category] || 0) + 1;
        });
        
        const sortedCategories = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topCategory = sortedCategories[0]?.[0] || "품질/상태";
        const topCount = sortedCategories[0]?.[1] || 0;
        const topPercent = total > 0 ? Math.round((topCount / total) * 100) : 0;
        
        const breakdownStr = sortedCategories.map(([cat, count]) => `${cat}(${Math.round((count / total) * 100)}%)`).join(", ");
        
        return {
          title: "비추천(Critical) 긴급 조치 요인",
          sub: "💡 비추천 후기가 경고하는 치명적인 위험?",
          boldText: `“불만의 주된 요인은 '${topCategory}' (${topPercent}%)에 집중”`,
          desc: `현재 비추천 피드백 데이터 분석 결과, VOC 불만 원인은 ${breakdownStr} 순서로 집중되어 발생하고 있습니다. 특히 '${topCategory}' 요인이 핵심 원인으로 나타나므로, 타 부서와의 긴밀한 원인 규명 및 즉시 보상제 등의 긴급 조치가 시급합니다.`,
          tip: `${topCategory} 개선을 최우선 순위 과제로 상정하고 즉각적인 품질 보정제 가동`
        };
      }
      case "사고접수": {
        const total = matchingIncidents.length;
        if (total === 0) {
          return {
            title: "사고접수 (CS Claim) 현황",
            sub: `💡 ${periodLabel} 사고접수/품질 클레임 발생 현황`,
            boldText: "“현재 분석 범위 내 사고접수 내역이 없습니다.”",
            desc: "현재 선택된 기간 및 필터 범위 내에서 접수된 CS 사고 및 환불/보상 클레임 내역이 발생하지 않아 안정적인 상태입니다.",
            tip: "출고 검수 및 배송 패키징 모니터링 지속 유지"
          };
        }
        const approvedCount = matchingIncidents.filter(i => i.incidentStatus === "처리완료").length;
        const rejectedCount = matchingIncidents.filter(i => i.incidentStatus === "반려됨").length;

        // Breakdown top cause
        const causeCounts: Record<string, number> = {};
        matchingIncidents.forEach(i => {
          const c = i.accidentDetail || i.accidentType || "기타 불만";
          causeCounts[c] = (causeCounts[c] || 0) + 1;
        });
        const sortedCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]);
        const topCause = sortedCauses[0]?.[0] || "품질 불량";
        const topCauseCount = sortedCauses[0]?.[1] || 0;

        return {
          title: "사고접수 (CS Claim) 집중 분석",
          sub: `💡 ${periodLabel} 사고접수 및 보상 처리 현황`,
          boldText: `“총 ${total}건 접수 (승인/보상 ${approvedCount}건, 반려 ${rejectedCount}건)”`,
          desc: `현재 분석 데이터 내 총 ${total}건의 CS 사고접수가 등록되어 있습니다. 최다 발생 원인은 '${topCause}'(${topCauseCount}건)이며, 고객 접수 클레임 원인 분석 및 환불/재배송 조치를 철저히 모니터링해야 합니다.`,
          tip: `'${topCause}' 관련 출고 검수 기준 강화 및 빠른 고객 소통·보상 진행`
        };
      }
      case "all":
      default:
        return {
          title: "핵심 채널 인사이트",
          sub: "💡 사진 후기 채널이 가진 차별적 분석 가치는 무엇인가요?",
          boldText: "“압도적인 추천 비율이 보여주는 시각적 만족과 투명한 품질 검증”",
          desc: "사진 후기는 만족도가 높은 추천(Positive) 비중이 압도적으로 높습니다. 기대했던 만큼 화사하고 싱싱한 꽃을 받았을 때 이를 시각적으로 기록하고 자랑하려는 고객 심리가 강력하게 작용하기 때문입니다. 동시에, 소수의 비추천 사례에서는 실물 상태(시들음, 파손)를 고발하는 명확한 시각 증거 역할을 하므로, 시각적 만족과 품질 격차(Visual Gap)를 동시에 모니터링할 수 있는 가장 신뢰도 높은 채널입니다.",
          tip: "우수 추천 사진을 상품 페이지 및 마케팅 소스로 적극 활용하고, 소수의 불만 사진은 즉각 품질 피드백 루프로 연계"
        };
    }
  }, [selectedCardFilter, reviewsData, matchingIncidents, periodLabel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Active Product Filter Alert Banner */}
      {metricsProductFilter && (
        <div className="bg-brand-green-light border border-brand-green/20 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-green text-white rounded-2xl p-2.5 shadow-sm">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">
                상품 상세 분석 모드: <span className="text-brand-green-dark">{metricsProductFilter}</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                선택한 상품의 주간 핵심 지표, 누적 만족도 추이, 그리고 원본 피드백을 단독 조회 중입니다.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMetricsProductFilter("");
              setSelectedCardFilter("all");
            }}
            className="flex items-center gap-1.5 rounded-xl border border-brand-green/20 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 text-xs font-bold transition cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>필터 전체 해제 (Reset Filter)</span>
          </button>
        </div>
      )}

      {/* Action Header bar for Weekly Reset */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-3xl p-5 border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span>실시간 주간 대시보드 활성 데이터</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            현재 {reviewsData.length}건의 사진 후기 데이터가 주간 지표로 집계되고 있습니다. 마감 시 아래 버튼으로 대시보드를 비울 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (window.confirm("정말로 현재 주간 대시보드를 초기화하시겠습니까?\n\n* 집계 중인 주간 VOC 데이터는 주간 탭에서 비워지며, '원본 후기 아카이브' 탭에는 날짜별로 안전하게 보관됩니다.")) {
                archiveActiveReviews();
              }
            }}
            disabled={isSyncing || reviewsData.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2.5 text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>주간 대시보드 초기화 (Reset)</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Card */}
        <button
          onClick={() => setSelectedCardFilter("all")}
          className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border text-left flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 ${
            selectedCardFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-lg ring-4 ring-slate-900/10"
              : "bg-white text-slate-800 border-slate-100 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${selectedCardFilter === "all" ? "text-slate-300" : "text-slate-400"}`}>
                전체 사진 후기
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <h3 className="text-3xl font-black">{totalCount}</h3>
                <span className={`text-xs font-bold ${selectedCardFilter === "all" ? "text-slate-300" : "text-slate-400"}`}>건</span>
              </div>
            </div>
            <div className={`rounded-2xl p-2.5 transition-colors ${selectedCardFilter === "all" ? "bg-white/10 text-white" : "bg-slate-50 text-slate-600"}`}>
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-2 border-t pt-3 w-full text-[10px] font-bold uppercase ${selectedCardFilter === "all" ? "border-white/10 text-slate-300" : "border-slate-100 text-slate-400"}`}>
            <span>조회 필터:</span>
            <span className={`${selectedCardFilter === "all" ? "text-white" : "text-slate-800"}`}>전체 보기 (Active)</span>
          </div>
        </button>

        {/* Recommend Rate Card */}
        <button
          onClick={() => setSelectedCardFilter("추천")}
          className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border text-left flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 ${
            selectedCardFilter === "추천"
              ? "bg-brand-green text-white border-brand-green shadow-lg shadow-brand-green/20 ring-4 ring-brand-green/20"
              : "bg-brand-green-light/20 text-brand-green-dark border-brand-green/10 hover:bg-brand-green-light/50"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${selectedCardFilter === "추천" ? "text-brand-green-light" : "text-brand-green-dark"}`}>
                추천 (Positive)
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <h3 className="text-3xl font-black">{recommendCount}</h3>
                <span className={`text-xs font-bold ${selectedCardFilter === "추천" ? "text-brand-green-light" : "text-brand-green-dark/80"}`}>{recommendRate}%</span>
              </div>
            </div>
            <div className={`rounded-2xl p-2.5 transition-colors ${selectedCardFilter === "추천" ? "bg-white/10 text-white" : "bg-brand-green-light text-brand-green-dark"}`}>
              <ThumbsUp className="h-5 w-5" />
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-[10px] border-t pt-3 w-full font-bold ${selectedCardFilter === "추천" ? "border-white/10 text-brand-green-light" : "border-brand-green/20 text-brand-green-dark"}`}>
            <span className="flex items-center font-black">
              {isRecommendLower ? (
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
              )}
              {recommendDiff}%p
            </span>
            <span className="font-medium">NPS 평균 대비 {isRecommendLower ? "하락" : "상승"}</span>
          </div>
        </button>

        {/* Neutral Rate Card */}
        <button
          onClick={() => setSelectedCardFilter("중립")}
          className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border text-left flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 ${
            selectedCardFilter === "중립"
              ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100 ring-4 ring-amber-500/20"
              : "bg-amber-50/30 text-amber-900 border-amber-100/40 hover:bg-amber-50/60"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${selectedCardFilter === "중립" ? "text-amber-100" : "text-amber-600"}`}>
                중립 (Neutral)
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <h3 className="text-3xl font-black">{neutralCount}</h3>
                <span className={`text-xs font-bold ${selectedCardFilter === "중립" ? "text-amber-100" : "text-amber-600"}`}>{neutralRate}%</span>
              </div>
            </div>
            <div className={`rounded-2xl p-2.5 transition-colors ${selectedCardFilter === "중립" ? "bg-white/10 text-white" : "bg-amber-50 text-amber-600"}`}>
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-[10px] border-t pt-3 w-full font-bold ${selectedCardFilter === "중립" ? "border-white/10 text-amber-100" : "border-amber-100/30 text-amber-600"}`}>
            <span className="font-semibold">유보적 평가 고객층 필터</span>
          </div>
        </button>

        {/* Detractor Rate Card */}
        <button
          onClick={() => setSelectedCardFilter("비추천")}
          className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border text-left flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 ${
            selectedCardFilter === "비추천"
              ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-100 ring-4 ring-red-600/20"
              : "bg-red-50/30 text-red-900 border-red-100/40 hover:bg-red-50/60"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${selectedCardFilter === "비추천" ? "text-red-100" : "text-red-500"}`}>
                비추천 (Critical)
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <h3 className="text-3xl font-black">{notRecommendCount}</h3>
                <span className={`text-xs font-bold ${selectedCardFilter === "비추천" ? "text-red-100" : "text-red-500"}`}>{notRecommendRate}%</span>
              </div>
            </div>
            <div className={`rounded-2xl p-2.5 transition-colors ${selectedCardFilter === "비추천" ? "bg-white/10 text-white" : "bg-red-50 text-red-500"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-[10px] border-t pt-3 w-full font-bold ${selectedCardFilter === "비추천" ? "border-white/10 text-red-100" : "border-red-100/30 text-red-600"}`}>
            <span className="font-black">
              NPS 평균 대비 {isDetractorHigher ? `+${detractorDiff}` : `-${detractorDiff}`}%p {isDetractorHigher ? "증가" : "감소"}
            </span>
          </div>
        </button>

        {/* Accident Receipts Card */}
        <button
          onClick={() => setSelectedCardFilter("사고접수")}
          className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border text-left flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] active:scale-95 duration-200 ${
            selectedCardFilter === "사고접수"
              ? "bg-purple-700 text-white border-purple-700 shadow-lg shadow-purple-100 ring-4 ring-purple-700/20"
              : "bg-purple-50/30 text-purple-900 border-purple-100/40 hover:bg-purple-50/60"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${selectedCardFilter === "사고접수" ? "text-purple-200" : "text-purple-600"}`}>
                사고접수 (CS Issue)
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <h3 className="text-3xl font-black">{accidentCount}</h3>
                <span className={`text-xs font-bold ${selectedCardFilter === "사고접수" ? "text-purple-200" : "text-purple-600"}`}>{accidentRate}%</span>
              </div>
            </div>
            <div className={`rounded-2xl p-2.5 transition-colors ${selectedCardFilter === "사고접수" ? "bg-white/10 text-white" : "bg-purple-100 text-purple-700"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-[10px] border-t pt-3 w-full font-bold ${selectedCardFilter === "사고접수" ? "border-white/10 text-purple-200" : "border-purple-100/30 text-purple-600"}`}>
            <span className="font-bold">품질/배송 CS 접수건 필터</span>
          </div>
        </button>
      </div>

      {/* Main Charts & Insight Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Chart Column */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-brand-green" /> 
                <span>금주 사진 후기 vs 전사 누적 NPS 분포 비교</span>
                {selectedCardFilter !== "all" && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition-colors ${
                    selectedCardFilter === "추천" ? "bg-brand-green-light text-brand-green-dark border border-brand-green/10" :
                    selectedCardFilter === "중립" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  }`}>
                    {selectedCardFilter} 필터링됨
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-400 font-medium">사진을 첨부한 후기는 전체 만족도 조사(NPS)에 비해 비추천 비율이 높게 나타납니다.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">단위: %</span>
              <NpsSummaryUploader />
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, ""]}
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none" }}
                  itemStyle={{ color: "#f8fafc" }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: "bold" }} />
                
                {/* Weekly Photo Reviews with interactive cell coloring based on selected filter */}
                <Bar dataKey={photoReviewBarKey} fill="#7cb342" radius={[6, 6, 0, 0]}>
                  {comparisonData.map((entry, index) => {
                    const isMatched =
                      selectedCardFilter === "all" ||
                      (selectedCardFilter === "추천" && entry.name.includes("추천")) ||
                      (selectedCardFilter === "중립" && entry.name.includes("중립")) ||
                      (selectedCardFilter === "비추천" && entry.name.includes("비추천"));

                    let cellColor = "#7cb342"; // default active brand green
                    if (selectedCardFilter !== "all" && !isMatched) {
                      cellColor = "#cbd5e1"; // dim other bars
                    } else if (selectedCardFilter === "중립" && isMatched) {
                      cellColor = "#f59e0b"; // amber for neutral focus
                    } else if (selectedCardFilter === "비추천" && isMatched) {
                      cellColor = "#ef4444"; // red for detractor focus
                    }

                    return <Cell key={`cell-${index}`} fill={cellColor} />;
                  })}
                  <LabelList dataKey={photoReviewBarKey} position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: "bold", fill: "#1e293b" }} />
                </Bar>

                {/* Cumulative NPS */}
                <Bar dataKey={npsBarKey} fill="#94a3b8" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey={npsBarKey} position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insight Column with dynamic, responsive theme shifting */}
        <div className={`rounded-3xl border p-6 shadow-xs flex flex-col justify-between transition-colors duration-300 ${
          selectedCardFilter === "추천" ? "border-brand-green/20 bg-brand-green-light/25" :
          selectedCardFilter === "중립" ? "border-amber-200 bg-amber-50/20" :
          selectedCardFilter === "비추천" ? "border-red-200 bg-red-50/20" :
          "border-brand-green/20 bg-brand-green-light/10"
        }`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`rounded-xl p-2 text-white shadow-sm transition-colors duration-300 ${
                selectedCardFilter === "추천" ? "bg-brand-green shadow-brand-green/20" :
                selectedCardFilter === "중립" ? "bg-amber-500 shadow-amber-100" :
                selectedCardFilter === "비추천" ? "bg-red-600 shadow-red-100" :
                "bg-brand-green shadow-brand-green/20"
              }`}>
                <Lightbulb className="h-5 w-5" />
              </div>
              <h4 className="text-base font-black text-slate-900">{activeInsight.title}</h4>
            </div>

            <div className="space-y-3.5">
              <div className={`rounded-2xl bg-white p-5 border shadow-xs transition-colors duration-300 ${
                selectedCardFilter === "추천" ? "border-brand-green/10" :
                selectedCardFilter === "중립" ? "border-amber-100/60" :
                selectedCardFilter === "비추천" ? "border-red-100/60" :
                "border-brand-green/10"
              }`}>
                <h5 className={`text-xs font-black mb-1.5 uppercase tracking-wide ${
                  selectedCardFilter === "추천" ? "text-brand-green-dark" :
                  selectedCardFilter === "중립" ? "text-amber-950" :
                  selectedCardFilter === "비추천" ? "text-red-950" :
                  "text-brand-green-dark"
                }`}>
                  {activeInsight.sub}
                </h5>
                <p className="text-xs text-slate-800 leading-relaxed font-black">
                  {activeInsight.boldText}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
                  {activeInsight.desc}
                </p>
              </div>
            </div>
          </div>

          <div className={`mt-5 border-t pt-4 transition-colors duration-300 ${
            selectedCardFilter === "추천" ? "border-brand-green/25" :
            selectedCardFilter === "중립" ? "border-amber-100" :
            selectedCardFilter === "비추천" ? "border-red-100" :
            "border-brand-green/20"
          }`}>
            <div className={`flex flex-col gap-1 text-[11px] font-bold p-3.5 rounded-xl border transition-colors duration-300 ${
              selectedCardFilter === "추천" ? "text-brand-green-dark bg-brand-green-light/50 border-brand-green/10" :
              selectedCardFilter === "중립" ? "text-amber-800 bg-amber-50/50 border-amber-100/40" :
              selectedCardFilter === "비추천" ? "text-red-800 bg-red-50/50 border-red-100/40" :
              "text-brand-green-dark bg-brand-green-light border-brand-green/10"
            }`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">추천 관리 가이드라인</span>
              <span className="text-xs leading-relaxed">{activeInsight.tip}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Part F 우선순위 2/3/5 — NPS Detractor 워치리스트/이탈위험 세그먼트 + NPS 스코어 추이.
          워치리스트 테이블 컬럼이 많아 2단 그리드로 두면 너무 좁아지므로 세로로 쌓는다. */}
      <div className="space-y-6">
        <NpsWatchlistWidget />
        <NpsTrendWidget />
      </div>

      {/* Detailed Filtered Review & Incident List Section */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span>
                {selectedCardFilter === "all" ? `${periodLabel} 전체` : `${periodLabel} [${selectedCardFilter}]`} 피드백 상세 탐색
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                총 {selectedCardFilter === "사고접수" ? filteredIncidents.length : filteredReviews.length}건
              </span>
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {selectedCardFilter === "사고접수" 
                ? "CS 사고접수 및 보상(환불/재배송) 내역을 탐색하고 고객 클레임 원인을 확인합니다."
                : "상단 지표 카드를 클릭하여 긍정/중립/부정 의견을 손쉽게 필터링하고 검색할 수 있습니다."}
            </p>
          </div>

          {/* Inline Search Bar & Sort Toggle */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 min-w-[180px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={selectedCardFilter === "사고접수" ? "상품명, 클레임 내용, 고객명 검색..." : "상품명, 후기 내용 검색..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(5); // Reset load more count on search
                }}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-2xl pl-9 pr-4 py-2.5 focus:bg-white focus:outline-none focus:border-brand-green font-medium transition"
              />
            </div>
            
            <button
              onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-2xl text-xs font-bold transition shrink-0 shadow-sm cursor-pointer"
              title={sortOrder === "desc" ? "내림차순 (최신순) - 클릭 시 오름차순 변경" : "오름차순 (과거순) - 클릭 시 내림차순 변경"}
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
              <span>{sortOrder === "desc" ? "최신순" : "과거순"}</span>
            </button>
          </div>
        </div>

        {/* Incidents Render when 사고접수 is selected */}
        {selectedCardFilter === "사고접수" ? (
          <div className="space-y-4">
            <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-purple-900 font-medium">
                <AlertTriangle className="h-5 w-5 text-purple-600 shrink-0" />
                <span>
                  <strong>CS 사고접수 데이터:</strong> 총 <strong>{filteredIncidents.length}건</strong>의 사고접수 내역이 조회되었습니다. (승인 {filteredIncidents.filter(i => i.incidentStatus === "처리완료").length}건 / 반려 {filteredIncidents.filter(i => i.incidentStatus === "반려됨").length}건)
                </span>
              </div>
              <button
                onClick={() => setActiveTab("incidents")}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shrink-0 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span>사고접수 허브에서 전체 관리</span>
                <span>→</span>
              </button>
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="bg-slate-50 rounded-2xl p-10 text-center border border-dashed border-slate-200/60">
                <p className="text-xs text-slate-400 font-bold">해당 조건에 일치하는 사고접수 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {filteredIncidents.slice(0, visibleCount).map((inc) => {
                    const isApproved = inc.incidentStatus === "처리완료";
                    const isRejected = inc.incidentStatus === "반려됨";

                    return (
                      <div
                        key={inc.id}
                        className="border border-purple-100 bg-white hover:border-purple-200 hover:shadow-xs p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start justify-between transition-all duration-200 border-l-4 border-l-purple-500"
                      >
                        <div className="space-y-2.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md border bg-purple-100 text-purple-800 border-purple-200">
                              🚨 사고접수
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border ${
                              isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              isRejected ? "bg-slate-100 text-slate-700 border-slate-200" :
                              "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {isApproved ? "처리완료 (승인/보상)" : isRejected ? "반려됨 (생화특성)" : "접수중"}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                              {inc.reviewer || inc.customerName ? `${inc.reviewer || inc.customerName} 고객님` : `티켓 #${inc.id}`}
                            </span>
                            <span className="text-[11px] font-bold text-slate-800">
                              {inc.product}
                            </span>
                            {inc.id && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                [{inc.id}]
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-medium ml-auto md:ml-0">
                              접수일: {inc.date}
                            </span>
                          </div>

                          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100">
                            <p className="text-xs text-slate-800 leading-relaxed font-medium">
                              "{inc.claimText}"
                            </p>
                          </div>

                          {inc.csResponse && (
                            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 text-xs text-blue-900">
                              <span className="font-bold text-blue-700 mr-1.5">💬 CS 조치 답변:</span>
                              <span>{inc.csResponse}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full font-bold">
                              원인: {inc.accidentDetail || inc.accidentType || "품질 불량"}
                            </span>
                            {inc.refundAmount !== undefined && inc.refundAmount > 0 && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-extrabold">
                                💰 환불: {inc.refundAmount.toLocaleString()}원
                              </span>
                            )}
                            {inc.orderNumber && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                                주문: {inc.orderNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Photo Thumbnail if present */}
                        {inc.image_url && (
                          <div className="shrink-0 pt-2 md:pt-0">
                            <button
                              onClick={() => setSelectedPhotoPreview({ url: inc.image_url!, title: `${inc.product} (${inc.reviewer || inc.customerName || "고객"} 사고접수 증빙)` })}
                              className="group relative block overflow-hidden rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition cursor-pointer"
                              title="증빙 사진 확대 보기"
                            >
                              <img
                                src={inc.image_url}
                                alt="사고 증빙 사진"
                                className="h-20 w-20 object-cover group-hover:scale-105 transition duration-200"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                                🔍 확대
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Load More Button for Incidents */}
                {filteredIncidents.length > visibleCount && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 5)}
                      className="inline-flex items-center justify-center bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-5 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer"
                    >
                      사고접수 내역 더 보기 ({filteredIncidents.length - visibleCount}건 남음)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Standard Photo Reviews Render */
          filteredReviews.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-10 text-center border border-dashed border-slate-200/60">
              <p className="text-xs text-slate-400 font-bold">해당 필터 조건에 부합하는 주간 사진 후기가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {filteredReviews.slice(0, visibleCount).map((r, index, arr) => {
                  const sentimentTheme = 
                    r.type === "추천" ? { bg: "bg-brand-green-light text-brand-green-dark border-brand-green/10", label: "추천" } :
                    r.type === "중립" ? { bg: "bg-amber-50 text-amber-700 border-amber-100", label: "중립" } :
                    { bg: "bg-red-50 text-red-700 border-red-100", label: "비추천" };

                  // Check if this review belongs to the same post (same reviewer, date, and highly similar content) as the previous one
                  const prevItem = index > 0 ? arr[index - 1] : null;
                  const isSamePostAsPrev = prevItem && groupKeysMap.get(r.id) === groupKeysMap.get(prevItem.id);

                  return (
                    <div
                      key={r.id}
                      className={`border border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start justify-between transition-all duration-200 ${
                        isSamePostAsPrev ? "border-l-4 border-l-brand-green bg-brand-green-light/5 ml-2 md:ml-4" : ""
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border ${sentimentTheme.bg}`}>
                            {sentimentTheme.label}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold">
                            {r.reviewer ? `${r.reviewer}님의 후기` : `고객#${r.id}님의 후기`}
                          </span>
                          {isSamePostAsPrev && (
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              ↳ <span className="text-brand-green-dark">위와 동일한 게시글</span>
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-slate-800">
                            {r.product}
                          </span>
                          {r.image_urls && r.image_urls.length > 0 ? (
                            <div className="inline-flex gap-1 items-center flex-wrap">
                              {r.image_urls.map((url, imgIdx) => (
                                <button
                                  key={imgIdx}
                                  onClick={() => setSelectedPhotoPreview({ url, title: `${r.product} (${r.reviewer || `고객#${r.id}`} 사진 후기 #${imgIdx + 1})` })}
                                  className="inline-flex items-center justify-center h-5 shrink-0 bg-slate-100 hover:bg-brand-green-light text-slate-500 hover:text-brand-green-dark transition text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                                  title={`사진 후기 ${imgIdx + 1} 미리보기`}
                                >
                                  📷 #{imgIdx + 1}
                                </button>
                              ))}
                            </div>
                          ) : r.image_url && (
                            <button
                              onClick={() => setSelectedPhotoPreview({ url: r.image_url!, title: `${r.product} (${r.reviewer || `고객#${r.id}`} 사진 후기)` })}
                              className="inline-flex items-center text-xs hover:scale-110 transition shrink-0 cursor-pointer"
                              title="사진 후기 미리보기"
                            >
                              📷
                            </button>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium ml-auto md:ml-0">
                            수령일: {r.date}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {r.review}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full font-semibold">
                            분류: {r.category}
                          </span>
                          <span className="text-[10px] bg-indigo-50/50 text-indigo-600 border border-indigo-100/20 px-2 py-0.5 rounded-full font-semibold">
                            담당 부서: {r.department}
                          </span>
                        </div>
                      </div>

                      {/* Star Rating Column */}
                      <div className="flex items-center gap-1.5 md:flex-col md:items-end justify-center shrink-0 border-t md:border-t-0 border-slate-50 pt-2 md:pt-0 w-full md:w-auto">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-black text-slate-700">
                          {r.rating} / 5
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {filteredReviews.length > visibleCount && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 5)}
                    className="inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200/80 text-slate-600 px-5 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer"
                  >
                    사진 후기 더 보기 ({filteredReviews.length - visibleCount}건 남음)
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Photo Preview Modal */}
      <AnimatePresence>
        {selectedPhotoPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-800 truncate pr-4">
                  {selectedPhotoPreview.title}
                </h3>
                <button
                  onClick={() => setSelectedPhotoPreview(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 flex justify-center bg-slate-900/5 max-h-[70vh] overflow-auto">
                <img
                  src={selectedPhotoPreview.url}
                  alt={selectedPhotoPreview.title}
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <a
                  href={selectedPhotoPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-green hover:underline font-bold"
                >
                  새 창에서 원본 보기 ↗
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
