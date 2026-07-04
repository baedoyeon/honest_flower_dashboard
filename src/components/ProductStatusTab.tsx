import { useState, useMemo } from "react";
import { ProductStat } from "../data/classifiedReviews";
import { AlertTriangle, TrendingDown, CheckCircle2, Search, ArrowUpDown, Flame, HelpCircle } from "lucide-react";
import { motion } from "motion/react";
import { useReviews } from "../context/ReviewsContext";

export default function ProductStatusTab() {
  const { weeklyReviews: reviewsData, productStats: productStatsData } = useReviews();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof ProductStat>("totalCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");


  // Aggregate stats for the 3 caution products dynamically based on reviews data
  const cautionProducts = useMemo(() => {
    const targets = [
      {
        id: "luckybox",
        title: "플라워 럭키박스",
        keyword: "럭키박스",
        tagline: "장미/리시안/수국 시들음 및 줄기 부러짐 발생",
        desc: "여름철 고온 다습한 배송 과정에서 꽃들의 시들음 증상과 줄기 꺾임 현상이 많이 지적되었습니다. 특히 세트로 구성된 꽃들의 관상 기간이 단축되는 경향이 관찰되어 보랭재 보완 및 이동 시간 단축이 시급합니다."
      },
      {
        id: "sunflower_mix",
        title: "해바라기 에이드 믹스",
        keyword: "해바라기 에이드 믹스",
        tagline: "테디베어 해바라기 시들음 및 잎 마름",
        desc: "여름 한정 패키지로 큰 인기를 끌고 있으나, 세부 구성인 '테디베어 해바라기'의 컨디션 저하(시들음, 썩음, 날파리 유입) 비율이 매우 높습니다. 특정 품종의 온도 민감도를 MD팀에서 재검토할 필요가 있습니다."
      },
      {
        id: "phytolacca",
        title: "자리공",
        keyword: "자리공",
        tagline: "배송 중 가지 꺾임 및 부러짐 집중 발생",
        desc: "대가 굵고 늘어지는 성질이 있는 여름 열매 소재임에도 불구하고 배송 중 가지가 완전히 꺾이거나 으깨져서 도착한다는 후기가 속출했습니다. 완충 포장 방식 보완 혹은 포장 패키지 개선이 수반되어야 합니다."
      }
    ];

    return targets.map(target => {
      const filteredReviews = reviewsData.filter(r => r.product.includes(target.keyword));
      const total = filteredReviews.length;
      const recommend = filteredReviews.filter(r => r.type === "추천").length;
      const neutral = filteredReviews.filter(r => r.type === "중립").length;
      const notRecommend = filteredReviews.filter(r => r.type === "비추천").length;
      
      const sumRating = filteredReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = total > 0 ? Math.round((sumRating / total) * 100) / 100 : 0;
      const recommendRate = total > 0 ? Math.round((recommend / total) * 100) : 0;

      return {
        ...target,
        total,
        recommend,
        neutral,
        notRecommend,
        avgRating,
        recommendRate
      };
    });
  }, [reviewsData]);

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
          <span className="text-xs text-slate-400">비추천 집중 발생 및 특정 문제 반복 지적</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cautionProducts.map((p, idx) => (
            <div 
              key={p.id}
              className="rounded-3xl border border-red-100 bg-red-50/10 p-6 shadow-sm flex flex-col justify-between hover:border-red-200 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">
                      품질 경고
                    </span>
                    <h4 className="text-base font-black text-slate-900">{p.title}</h4>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                </div>
                
                <p className="text-xs font-bold text-red-600 mt-1">{p.tagline}</p>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed font-medium">{p.desc}</p>
              </div>

              {/* Product Stats Grid with custom rounded corners */}
              <div className="mt-5 pt-3.5 border-t border-red-100/60 grid grid-cols-4 text-center gap-1 bg-white/80 rounded-2xl p-2.5 border border-red-100/40">
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
                  <p className="text-xs font-black text-red-600">{p.notRecommend}건</p>
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
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
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
                  onClick={() => handleSort("notRecommend")}
                  className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition"
                >
                  <div className="flex items-center justify-center gap-1">
                    비추천 <ArrowUpDown className="h-3 w-3" />
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
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs text-blue-600 font-semibold">
                        {item.recommend}건
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center text-xs text-rose-500 font-semibold">
                        {item.notRecommend}건
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
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
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
