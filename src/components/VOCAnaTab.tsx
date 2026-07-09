import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Award, ShieldAlert, Sparkles, Building2, Quote, AlertTriangle, BookOpen, Layers, CheckCircle2, HelpCircle } from "lucide-react";
import { motion } from "motion/react";
import { useReviews } from "../context/ReviewsContext";

export default function VOCAnaTab() {
  const { weeklyReviews: reviewsData } = useReviews();
  const [activeGuideTab, setActiveGuideTab] = useState<"categories" | "judgment" | "patterns">("categories");

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

      {/* 3. VOC Classification Guide & Recurring Patterns Section */}
      <div className="rounded-3xl border border-slate-100 bg-slate-50/40 p-6 shadow-xs mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              어니스트플라워 VOC 분류 가이드 & 이슈 패턴
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              고객 피드백 데이터를 정확하게 정량화하고 SCM/MD/플랫폼 협업을 촉진하기 위한 의사결정 표준 가이드라인입니다.
            </p>
          </div>
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
            <button
              onClick={() => setActiveGuideTab("categories")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeGuideTab === "categories"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              카테고리 정의
            </button>
            <button
              onClick={() => setActiveGuideTab("judgment")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeGuideTab === "judgment"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              중요 판정 포인트
            </button>
            <button
              onClick={() => setActiveGuideTab("patterns")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeGuideTab === "patterns"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              최근 반복 이슈 패턴
            </button>
          </div>
        </div>

        {/* Tab content 1: categories */}
        {activeGuideTab === "categories" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 품질/상태 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xs">품질/상태</span>
                <span className="text-[11px] font-bold text-slate-400">꽃 자체 상태 문제</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                꽃 자체의 생리적, 물리적 상태 및 신선도 저하 등 컨디션 결함에 관한 피드백입니다. (시듦, 고개 쳐짐, 줄기 휘어짐/꺾임, 해충 발견, 개화도 이상, 악취 등)
              </p>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">💡 실제 예시</span>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  &ldquo;거베라가 모두 휘어져 있고 고개가 축 처져 있어요.&rdquo;<br/>
                  &ldquo;열매수국에서 하수구 같은 악취가 너무 심하게 납니다.&rdquo;
                </p>
              </div>
            </div>

            {/* 상품구성/양 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs">상품구성/양</span>
                <span className="text-[11px] font-bold text-slate-400">수량, 옵션, 구성 문제</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                구성 요소, 수량, 약속된 옵션의 정보 불일치 혹은 포장 단위 줄기 분할 등에 관한 피드백입니다. (꽃의 품질이 아닌 정량적 구성에 초점을 둡니다.)
              </p>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">💡 실제 예시</span>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  &ldquo;갯수가 상세페이지 대표 사진보다 훨씬 적은 것 같아요.&rdquo;<br/>
                  &ldquo;동글타입을 주문했는데 길쭉한 타입이 잘못 배송되었습니다.&rdquo;
                </p>
              </div>
            </div>

            {/* 배송/포장 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg font-bold text-xs">배송/포장</span>
                <span className="text-[11px] font-bold text-slate-400">물류, 지연, 충격 문제</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                배송 과정에서의 물리적 충격, 새벽배송 미준수 지연, 오배송 또는 배송 박스/수분 공급용 물 처리 패키징 부실에 관한 피드백입니다.
              </p>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">💡 실제 예시</span>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  &ldquo;고정이 안되서 상자 안에서 위아래로 움직여서 다 상해있어요.&rdquo;<br/>
                  &ldquo;새벽배송인데 오전에 시들어서 왔습니다.&rdquo;
                </p>
              </div>
            </div>

            {/* 서비스/시스템 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg font-bold text-xs">서비스/시스템</span>
                <span className="text-[11px] font-bold text-slate-400">시스템 오류, 결제, CS</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                웹사이트/모바일 앱 UI/UX 사용성 불편, 후기 작성 오류, CS 응대, 결제 장애, 적립금 시스템 관련 등 전반적인 서비스 품질 불만족입니다.
              </p>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">💡 실제 예시</span>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  &ldquo;무슨 홈페이지가 후기 작성이 이렇게 복잡하고 오류가 많은지...&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab content 2: judgment */}
        {activeGuideTab === "judgment" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50">
              <AlertTriangle className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">⚠️ 중요 구분 가이드: &quot;사진과 실물이 다르다&quot;</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  고객들이 가장 많이 언급하는 애매한 피드백 중 하나인 &ldquo;사진과 다르다&rdquo;는 맥락 분석을 통해 다음과 같이 명확히 분리해서 판별합니다.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">색상, 신선도, 생육 상태 차이</span>
                    <p className="text-xs font-bold text-slate-800">품질/상태 카테고리</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">생화의 고유 생육 특성 혹은 입고 시기 컨디션 문제로 접근합니다.</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">양, 풍성함, 단수(송이 수), 옵션 차이</span>
                    <p className="text-xs font-bold text-slate-800">상품구성/양 카테고리</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">상품 판매 스펙(기획 정보) 대비 포장 기획 정량 오차로 판단합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab content 3: patterns */}
        {activeGuideTab === "patterns" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 플라워 럭키박스 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">📦 플라워 럭키박스</span>
                <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md font-bold">집중 관리</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                상세 페이지 사진과 실물 구성 간의 괴리에 대한 불만이 다수 수집되었습니다. 랜덤 믹스 구성 특성을 감안하더라도 고객 기대치 관리가 시급합니다.
              </p>
              <div className="pt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-100">
                <strong className="text-indigo-600">💡 개선 방향</strong>: 상세 페이지 내 다양한 믹스 사례 예시 범위를 더 상세히 안내하여 사전 기대 심리 조정.
              </div>
            </div>

            {/* 라그라스 / 침봉 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">🏷️ 라그라스 / 침봉 등 부자재</span>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md font-bold">오배송 주의</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                사이즈 불일치, 침봉 종류 및 수량 오배송, 라그라스 색상 옵션 불일치가 반복 관찰되었습니다. 포장/검수 상의 기계적 오차 요인이 주요 원인입니다.
              </p>
              <div className="pt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-100">
                <strong className="text-indigo-600">💡 개선 방향</strong>: 상품 출고 시 바코드 일치 여부 스티커 2중 전수 검수 도입으로 인간 오차 최소화.
              </div>
            </div>

            {/* 줄기 휘어짐 / 꺾임 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">🥀 줄기 휘어짐 / 꺾임 현상</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold">완충 강화</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                다양한 품종 전반에서 배송 과정 중 줄기 부러짐이나 고개 축 처짐 현상이 지속 발생하여 비추천 VOC의 큰 비중을 차지하고 있습니다.
              </p>
              <div className="pt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-100">
                <strong className="text-indigo-600">💡 개선 방향</strong>: 수령 박스 포장 내 지지 보강재 부착 방식 개선 및 취급 주의 상징적 표시 인쇄.
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
