import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { ArrowDownRight, ArrowUpRight, MessageSquare, AlertTriangle, Lightbulb, Users, BarChart2, Star, Search, Sparkles, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews } from "../context/ReviewsContext";
import { useState, useMemo } from "react";

export default function WeeklyMetricsTab() {
  const { weeklyReviews: reviewsData, archiveActiveReviews, isSyncing, isUsingLocalData } = useReviews();

  const [selectedCardFilter, setSelectedCardFilter] = useState<"all" | "추천" | "중립" | "비추천">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);

  // Dynamic calculations based on live reviews data
  const totalCount = reviewsData.length;
  const recommendCount = reviewsData.filter(r => r.type === "추천").length;
  const neutralCount = reviewsData.filter(r => r.type === "중립").length;
  const notRecommendCount = reviewsData.filter(r => r.type === "비추천").length;

  const recommendRate = totalCount > 0 ? Math.round((recommendCount / totalCount) * 1000) / 10 : 0;
  const neutralRate = totalCount > 0 ? Math.round((neutralCount / totalCount) * 1000) / 10 : 0;
  const notRecommendRate = totalCount > 0 ? Math.round((notRecommendCount / totalCount) * 1000) / 10 : 0;

  // Comparison logic against national NPS baseline (86.1% recommendation and 4.9% detraction)
  const isRecommendLower = recommendRate < 86.1;
  const recommendDiff = Math.abs(recommendRate - 86.1).toFixed(1);

  const isDetractorHigher = notRecommendRate > 4.9;
  const detractorDiff = Math.abs(notRecommendRate - 4.9).toFixed(1);

  const comparisonData = useMemo(() => {
    return [
      {
        name: "추천 (Promoter)",
        [`금주 사진 후기 (${totalCount}건)`]: recommendRate,
        "누적 NPS (2.6만건)": 86.1,
      },
      {
        name: "중립 (Passive)",
        [`금주 사진 후기 (${totalCount}건)`]: neutralRate,
        "누적 NPS (2.6만건)": 9.0,
      },
      {
        name: "비추천 (Detractor)",
        [`금주 사진 후기 (${totalCount}건)`]: notRecommendRate,
        "누적 NPS (2.6만건)": 4.9,
      },
    ];
  }, [totalCount, recommendRate, neutralRate, notRecommendRate]);

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
    return list;
  }, [reviewsData, selectedCardFilter, searchQuery]);

  // Dynamic insights text based on the selected card filter
  const activeInsight = useMemo(() => {
    switch (selectedCardFilter) {
      case "추천":
        return {
          title: "추천(Positive) 핵심 요인",
          sub: "💡 추천 고객이 가장 매료되는 포인트는?",
          boldText: "“압도적인 싱싱함과 풍성한 꽃 구성의 시너지”",
          desc: "고객들이 긍정적인 후기와 추천을 자발적으로 남기는 가장 큰 원동력은 수령 직후 느껴지는 꽃의 '신선도'와 기대 이상의 '풍성함'입니다. 특히 선물 수령자들의 감동 섞인 피드백이 강력한 바이럴로 작용하고 있습니다.",
          tip: "선물용 패키징 디테일 강화 및 시그니처 꽃 구성 유지"
        };
      case "중립":
        return {
          title: "중립(Neutral) 전환 요인",
          sub: "💡 중립 고객을 추천 고객으로 만들려면?",
          boldText: "“품질은 만족스러우나 세부 프로세스 보완 필요”",
          desc: "중립적인 태도를 취하는 고객층은 대체로 꽃 자체에는 만족하나, 미흡한 배송 알림, 개화 시기 불일치(너무 안 피어서 도착했거나 이미 활짝 피어 있어 수명이 짧은 경우) 등 서비스적 디테일에서 아쉬움을 표하고 있습니다.",
          tip: "배송 예정 알림 고도화 및 개화 조절 가이드 동봉"
        };
      case "비추천":
        return {
          title: "비추천(Critical) 긴급 조치 요인",
          sub: "💡 비추천 후기가 경고하는 치명적인 위험?",
          boldText: "“여름철 고온 배송 시듦 및 파손에 즉각 반응”",
          desc: "비추천 의견은 80% 이상이 배송 중 파손(꽃대 부러짐, 화병 깨짐)이나 고온 노출로 인한 꽃잎 괴사에 집중됩니다. 불만을 즉시 해소하지 못하면 이들은 이탈할 뿐만 아니라 강력한 악성 루머를 형성할 위험이 있습니다.",
          tip: "여름철 콜드체인 보강 및 파손 대비 즉각 교환제 활성화"
        };
      case "all":
      default:
        return {
          title: "핵심 채널 인사이트",
          sub: "💡 비추천 비율이 유독 높은 원인은 무엇인가요?",
          boldText: "“불만 고객이 사진 후기를 더 적극적으로 남기는 경향”",
          desc: "만족한 고객들은 가볍게 텍스트로 고마움을 표하거나 사진을 가끔 찍어 올리는 반면, 배송 중 파손, 대가 부러짐, 혹은 극심한 여름 시들음 등의 피해를 입은 고객은 보상 신청 및 시각적인 불만 증빙을 위해 사진 후기를 훨씬 더 높은 활성도로 적극 업로드합니다.",
          tip: "여름 극성수기 대응 전략 수립 필요 (SCM / MD 공조)"
        };
    }
  }, [selectedCardFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
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
              if (isUsingLocalData) {
                alert("현재 로컬 백업 모드입니다. 우측의 '원본 후기 아카이브' 탭에서 Firestore 연동(시딩)을 완료한 후 초기화를 진행해 주세요.");
                return;
              }
              if (window.confirm("정말로 현재 주간 대시보드를 초기화하시겠습니까?\n\n* 집계 중인 주간 VOC 데이터는 주간 탭에서 비워지며, '원본 후기 아카이브' 탭과 클라우드 DB에는 날짜별로 안전하게 보관됩니다.")) {
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 ring-4 ring-blue-600/20"
              : "bg-blue-50/30 text-blue-900 border-blue-100/40 hover:bg-blue-50/60"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${selectedCardFilter === "추천" ? "text-blue-100" : "text-blue-500"}`}>
                추천 (Positive)
              </p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <h3 className="text-3xl font-black">{recommendCount}</h3>
                <span className={`text-xs font-bold ${selectedCardFilter === "추천" ? "text-blue-100" : "text-blue-500/80"}`}>{recommendRate}%</span>
              </div>
            </div>
            <div className={`rounded-2xl p-2.5 transition-colors ${selectedCardFilter === "추천" ? "bg-white/10 text-white" : "bg-blue-50 text-blue-500"}`}>
              <ThumbsUp className="h-5 w-5" />
            </div>
          </div>
          <div className={`mt-4 flex items-center gap-1 text-[10px] border-t pt-3 w-full font-bold ${selectedCardFilter === "추천" ? "border-white/10 text-blue-100" : "border-blue-100/30 text-blue-600"}`}>
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
      </div>

      {/* Main Charts & Insight Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Chart Column */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-600" /> 
                <span>금주 사진 후기 vs 전사 누적 NPS 분포 비교</span>
                {selectedCardFilter !== "all" && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition-colors ${
                    selectedCardFilter === "추천" ? "bg-blue-100 text-blue-700" :
                    selectedCardFilter === "중립" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  }`}>
                    {selectedCardFilter} 필터링됨
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-400 font-medium">사진을 첨부한 후기는 전체 만족도 조사(NPS)에 비해 비추천 비율이 높게 나타납니다.</p>
            </div>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">단위: %</span>
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
                <Bar dataKey={`금주 사진 후기 (${totalCount}건)`} fill="#2563eb" radius={[6, 6, 0, 0]}>
                  {comparisonData.map((entry, index) => {
                    const isMatched = 
                      selectedCardFilter === "all" ||
                      (selectedCardFilter === "추천" && entry.name.includes("추천")) ||
                      (selectedCardFilter === "중립" && entry.name.includes("중립")) ||
                      (selectedCardFilter === "비추천" && entry.name.includes("비추천"));
                      
                    let cellColor = "#2563eb"; // default active blue
                    if (selectedCardFilter !== "all" && !isMatched) {
                      cellColor = "#cbd5e1"; // dim other bars
                    } else if (selectedCardFilter === "중립" && isMatched) {
                      cellColor = "#f59e0b"; // amber for neutral focus
                    } else if (selectedCardFilter === "비추천" && isMatched) {
                      cellColor = "#ef4444"; // red for detractor focus
                    }
                    
                    return <Cell key={`cell-${index}`} fill={cellColor} />;
                  })}
                  <LabelList dataKey={`금주 사진 후기 (${totalCount}건)`} position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: "bold", fill: "#1e293b" }} />
                </Bar>
                
                {/* Cumulative NPS */}
                <Bar dataKey="누적 NPS (2.6만건)" fill="#94a3b8" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="누적 NPS (2.6만건)" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insight Column with dynamic, responsive theme shifting */}
        <div className={`rounded-3xl border p-6 shadow-xs flex flex-col justify-between transition-colors duration-300 ${
          selectedCardFilter === "추천" ? "border-blue-200 bg-blue-50/20" :
          selectedCardFilter === "중립" ? "border-amber-200 bg-amber-50/20" :
          selectedCardFilter === "비추천" ? "border-red-200 bg-red-50/20" :
          "border-blue-100 bg-blue-50/30"
        }`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`rounded-xl p-2 text-white shadow-sm transition-colors duration-300 ${
                selectedCardFilter === "추천" ? "bg-blue-600 shadow-blue-100" :
                selectedCardFilter === "중립" ? "bg-amber-500 shadow-amber-100" :
                selectedCardFilter === "비추천" ? "bg-red-600 shadow-red-100" :
                "bg-blue-600 shadow-blue-100"
              }`}>
                <Lightbulb className="h-5 w-5" />
              </div>
              <h4 className="text-base font-black text-slate-900">{activeInsight.title}</h4>
            </div>

            <div className="space-y-3.5">
              <div className={`rounded-2xl bg-white p-5 border shadow-xs transition-colors duration-300 ${
                selectedCardFilter === "추천" ? "border-blue-100/60" :
                selectedCardFilter === "중립" ? "border-amber-100/60" :
                selectedCardFilter === "비추천" ? "border-red-100/60" :
                "border-blue-100/50"
              }`}>
                <h5 className={`text-xs font-black mb-1.5 uppercase tracking-wide ${
                  selectedCardFilter === "추천" ? "text-blue-900" :
                  selectedCardFilter === "중립" ? "text-amber-950" :
                  selectedCardFilter === "비추천" ? "text-red-950" :
                  "text-blue-900"
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
            selectedCardFilter === "추천" ? "border-blue-100" :
            selectedCardFilter === "중립" ? "border-amber-100" :
            selectedCardFilter === "비추천" ? "border-red-100" :
            "border-blue-100"
          }`}>
            <div className={`flex flex-col gap-1 text-[11px] font-bold p-3.5 rounded-xl border transition-colors duration-300 ${
              selectedCardFilter === "추천" ? "text-blue-700 bg-blue-50/50 border-blue-100/40" :
              selectedCardFilter === "중립" ? "text-amber-800 bg-amber-50/50 border-amber-100/40" :
              selectedCardFilter === "비추천" ? "text-red-800 bg-red-50/50 border-red-100/40" :
              "text-blue-700 bg-blue-50 border-blue-100/40"
            }`}>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">추천 관리 가이드라인</span>
              <span className="text-xs leading-relaxed">{activeInsight.tip}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Detailed Filtered Review List Section */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span>
                {selectedCardFilter === "all" ? "금주 전체" : `금주 [${selectedCardFilter}]`} 피드백 상세 탐색
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                총 {filteredReviews.length}건
              </span>
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-1">
              상단 지표 카드를 클릭하여 긍정/중립/부정 의견을 손쉽게 필터링하고 검색할 수 있습니다.
            </p>
          </div>

          {/* Inline Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="상품명, 후기 내용 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(5); // Reset load more count on search
              }}
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-2xl pl-9 pr-4 py-2.5 focus:bg-white focus:outline-none focus:border-blue-400 font-medium transition"
            />
          </div>
        </div>

        {/* Reviews Render */}
        {filteredReviews.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-10 text-center border border-dashed border-slate-200/60">
            <p className="text-xs text-slate-400 font-bold">해당 필터 조건에 부합하는 주간 사진 후기가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {filteredReviews.slice(0, visibleCount).map((r) => {
                const sentimentTheme = 
                  r.type === "추천" ? { bg: "bg-blue-50 text-blue-700 border-blue-100", label: "추천" } :
                  r.type === "중립" ? { bg: "bg-amber-50 text-amber-700 border-amber-100", label: "중립" } :
                  { bg: "bg-red-50 text-red-700 border-red-100", label: "비추천" };

                return (
                  <div
                    key={r.id}
                    className="border border-slate-100 bg-white hover:border-slate-200 hover:shadow-xs p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start justify-between transition-all duration-200"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border ${sentimentTheme.bg}`}>
                          {sentimentTheme.label}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold font-mono">
                          ID: #{r.id}
                        </span>
                        <span className="text-[11px] font-bold text-slate-800">
                          {r.product}
                        </span>
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
        )}
      </div>
    </motion.div>
  );
}
