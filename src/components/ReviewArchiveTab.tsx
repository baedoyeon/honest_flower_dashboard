import React, { useState, useMemo } from "react";
import { Review } from "../data/classifiedReviews";
import { Star, Filter, ArrowUpDown, RefreshCw, MessageSquare, ShieldCheck, HelpCircle, AlertOctagon, Calendar, ChevronDown, ChevronUp, Database, Plus, Check, Loader2, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews } from "../context/ReviewsContext";

export default function ReviewArchiveTab() {
  const { 
    reviews: reviewsData, 
    isLoading, 
    isUsingLocalData, 
    syncWithFirestore, 
    addReview, 
    isSyncing 
  } = useReviews();

  // States
  const [selectedType, setSelectedType] = useState<"전체" | "추천" | "중립" | "비추천">("전체");
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"id-desc" | "id-asc" | "rating-desc" | "rating-asc">("id-desc");
  const [visibleCount, setVisibleCount] = useState(12);

  // Time Archive States
  const [selectedYear, setSelectedYear] = useState<string>("전체");
  const [selectedMonth, setSelectedMonth] = useState<string>("전체");
  const [selectedDay, setSelectedDay] = useState<string>("전체");
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);

  // Add Live Review Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newCategory, setNewCategory] = useState("품질/상태");
  const [newReviewText, setNewReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Constants
  const categories = ["전체", "품질/상태", "배송/포장", "상품구성/양", "서비스/시스템"];

  // Popular products list for dropdown auto-select
  const popularProducts = [
    "테디베어 해바라기",
    "플라워 럭키박스",
    "엔카이셔스+화병 세트",
    "알스트로메리아 외 1",
    "프릴 리시안셔스 외 1",
    "자리공",
    "유칼립투스 블랙잭",
    "버터플라이 라넌큘러스",
    "마트리카리아"
  ];

  // Dynamically calculate available dates based on selection to prevent empty results and offer seamless drilling
  const availableDates = useMemo(() => {
    const yearsSet = new Set<string>();
    const monthsSet = new Set<string>();
    const daysSet = new Set<string>();

    reviewsData.forEach(r => {
      if (!r.date) return;
      const parts = r.date.split('.');
      if (parts.length !== 3) return;

      const [y, m, d] = parts;
      yearsSet.add(y);

      // Filter months based on selected year
      if (selectedYear === "전체" || y === selectedYear) {
        monthsSet.add(m);
      }

      // Filter days based on selected year & month
      const matchYear = selectedYear === "전체" || y === selectedYear;
      const matchMonth = selectedMonth === "전체" || m === selectedMonth;
      if (matchYear && matchMonth) {
        daysSet.add(d);
      }
    });

    return {
      years: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
      months: Array.from(monthsSet).sort((a, b) => a.localeCompare(b)),
      days: Array.from(daysSet).sort((a, b) => a.localeCompare(b)),
    };
  }, [reviewsData, selectedYear, selectedMonth]);

  // Handle drilldowns smartly to avoid contradictory date combos
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth("전체");
    setSelectedDay("전체");
    setVisibleCount(12);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setSelectedDay("전체");
    setVisibleCount(12);
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    setVisibleCount(12);
  };

  // Filter and sort computation
  const filteredAndSortedReviews = useMemo(() => {
    let list = [...reviewsData];

    // 1. Filter by Type
    if (selectedType !== "전체") {
      list = list.filter(r => r.type === selectedType);
    }

    // 2. Filter by Category
    if (selectedCategory !== "전체") {
      list = list.filter(r => r.category === selectedCategory);
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.review.toLowerCase().includes(q) || 
        r.product.toLowerCase().includes(q)
      );
    }

    // 3.5 Filter by Date (Year, Month, Day)
    if (selectedYear !== "전체") {
      list = list.filter(r => r.date.startsWith(selectedYear));
    }
    if (selectedMonth !== "전체") {
      list = list.filter(r => {
        const parts = r.date.split('.');
        return parts.length === 3 && parts[1] === selectedMonth;
      });
    }
    if (selectedDay !== "전체") {
      list = list.filter(r => {
        const parts = r.date.split('.');
        return parts.length === 3 && parts[2] === selectedDay;
      });
    }

    // 4. Sorting
    // To keep reviews from the same post (same reviewer and same date) consecutive:
    // First, let's identify the group representative values.
    const groupRepresentatives = new Map<string, { maxId: number; minId: number; maxRating: number; minRating: number }>();
    
    list.forEach(r => {
      const reviewerName = r.reviewer || `고객#${r.id}`;
      const groupKey = `${reviewerName}_${r.date}`;
      const current = groupRepresentatives.get(groupKey);
      if (!current) {
        groupRepresentatives.set(groupKey, {
          maxId: Number(r.id),
          minId: Number(r.id),
          maxRating: r.rating,
          minRating: r.rating
        });
      } else {
        current.maxId = Math.max(current.maxId, Number(r.id));
        current.minId = Math.min(current.minId, Number(r.id));
        current.maxRating = Math.max(current.maxRating, r.rating);
        current.minRating = Math.min(current.minRating, r.rating);
      }
    });

    list.sort((a, b) => {
      const aReviewer = a.reviewer || `고객#${a.id}`;
      const bReviewer = b.reviewer || `고객#${b.id}`;
      const aGroupKey = `${aReviewer}_${a.date}`;
      const bGroupKey = `${bReviewer}_${b.date}`;

      // If they belong to the same group (same post), keep them together
      if (aGroupKey === bGroupKey) {
        // Within the same group, sort by ID descending to show newest product in post first
        return Number(b.id) - Number(a.id);
      }

      // If they are in different groups, sort the groups themselves by their representative values
      const aRep = groupRepresentatives.get(aGroupKey)!;
      const bRep = groupRepresentatives.get(bGroupKey)!;

      if (sortBy === "id-desc") {
        return bRep.maxId - aRep.maxId;
      }
      if (sortBy === "id-asc") {
        return aRep.minId - bRep.minId;
      }
      if (sortBy === "rating-desc") {
        if (bRep.maxRating !== aRep.maxRating) {
          return bRep.maxRating - aRep.maxRating;
        }
        return bRep.maxId - aRep.maxId; // Fallback to ID desc
      }
      if (sortBy === "rating-asc") {
        if (aRep.minRating !== bRep.minRating) {
          return aRep.minRating - bRep.minRating;
        }
        return aRep.minId - bRep.minId; // Fallback to ID asc
      }

      return 0;
    });

    return list;
  }, [reviewsData, selectedType, selectedCategory, searchQuery, sortBy, selectedYear, selectedMonth, selectedDay]);

  // Dynamic badge counts based on CURRENT filter status (or overall)
  const statsCounts = useMemo(() => {
    return {
      전체: reviewsData.length,
      추천: reviewsData.filter(r => r.type === "추천").length,
      중립: reviewsData.filter(r => r.type === "중립").length,
      비추천: reviewsData.filter(r => r.type === "비추천").length,
    };
  }, [reviewsData]);

  // Reset filters
  const resetFilters = () => {
    setSelectedType("전체");
    setSelectedCategory("전체");
    setSearchQuery("");
    setSortBy("id-desc");
    setSelectedYear("전체");
    setSelectedMonth("전체");
    setSelectedDay("전체");
    setExpandedReviewId(null);
    setVisibleCount(12);
  };

  // Export current filtered reviews to CSV
  const handleExportToCSV = () => {
    const headers = ["id", "date", "reviewer", "product", "rating", "type", "category", "department", "review", "image_url"];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Double up any quotes, and wrap in double quotes if it has comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.join(",")];

    filteredAndSortedReviews.forEach(r => {
      const resolvedReviewer = r.reviewer || `고객#${r.id}`;
      const resolvedDept = r.category === "상품구성/양" ? "MD" : r.category === "서비스/시스템" ? "프로덕트" : r.department;
      
      const row = [
        escapeCSV(r.id),
        escapeCSV(r.date),
        escapeCSV(resolvedReviewer),
        escapeCSV(r.product),
        escapeCSV(r.rating),
        escapeCSV(r.type),
        escapeCSV(r.category),
        escapeCSV(resolvedDept),
        escapeCSV(r.review),
        escapeCSV(r.image_url || "")
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.setAttribute("download", `honestflower_reviews_export_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Submit new review
  const handleAddReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.trim()) {
      alert("상품명을 입력하거나 선택해주세요.");
      return;
    }
    if (!newReviewText.trim()) {
      alert("후기 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine type based on rating
      let type: "추천" | "중립" | "비추천" = "추천";
      if (newRating === 3) type = "중립";
      else if (newRating <= 2) type = "비추천";

      // Determine department based on category
      let department = "SCM & MD";
      if (newCategory === "배송/포장") department = "SCM & CS";
      else if (newCategory === "상품구성/양") department = "MD";
      else if (newCategory === "서비스/시스템") department = "프로덕트";

      // Get current date formatted in YYYY.MM.DD
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const formattedDate = `${year}.${month}.${day}`;

      await addReview({
        date: formattedDate,
        product: newProduct.trim(),
        rating: newRating,
        type,
        category: newCategory,
        department,
        review: newReviewText.trim()
      });

      // Show success
      setSubmitSuccess(true);
      setNewProduct("");
      setNewReviewText("");
      setNewRating(5);
      setNewCategory("품질/상태");
      
      // Clear success state after 3s
      setTimeout(() => {
        setSubmitSuccess(false);
        setShowAddForm(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      alert("리뷰 등록 오류: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Star elements generator
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-3 w-3 ${
            i <= rating 
              ? rating === 5 
                ? "text-blue-500 fill-blue-500" 
                : rating === 4 
                  ? "text-amber-500 fill-amber-500" 
                  : "text-red-500 fill-red-500"
              : "text-slate-200"
          }`}
        />
      );
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* 0. Database Control & Setup Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Sync Status Banner */}
        <div className={`md:col-span-2 rounded-3xl p-6 border flex flex-col justify-between shadow-sm transition ${
          isUsingLocalData 
            ? "bg-amber-50/50 border-amber-200 text-amber-900" 
            : "bg-blue-50/40 border-blue-100 text-slate-800"
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className={`h-5 w-5 ${isUsingLocalData ? "text-amber-500" : "text-blue-600"}`} />
              <h3 className="font-bold text-sm">
                {isUsingLocalData ? "데이터베이스 초기 동기화 필요" : "Cloud Firestore 실시간 연동 중"}
              </h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                isUsingLocalData ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
              }`}>
                {isUsingLocalData ? "로컬 백업 모드" : "실시간 클라우드 DB"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 font-medium">
              {isUsingLocalData 
                ? "현재 Firestore가 비어있어 로컬 캐시 데이터를 조회 중입니다. 단 한 번의 클릭으로 200여 건의 고품질 분석 후기 데이터를 Firestore 클라우드 데이터베이스에 즉시 동기화(시딩)할 수 있습니다." 
                : `현재 Google Cloud Firestore의 'reviews' 컬렉션에 완벽하게 바인딩되어 실시간 데이터 연동 중입니다. (총 ${reviewsData.length}건 로드됨) 리뷰를 작성하면 화면 고침 없이 실시간(onSnapshot)으로 대시보드 전체가 업데이트됩니다.`
              }
            </p>
          </div>

          {isUsingLocalData && (
            <div className="mt-4">
              <button
                onClick={syncWithFirestore}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Firestore 클라우드 동기화 중...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>전체 데이터 Firestore로 마이그레이션 (1회성)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Live Adding Action Trigger */}
        <div className="rounded-3xl p-6 border border-slate-100 bg-white flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                <Plus className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">실시간 데이터 갱신 테스트</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-400 font-medium">
              새로운 고객 후기(VOC)를 가상으로 추가하고, 해당 내용이 대시보드 지표 및 원본 아카이브에 실시간으로 자동 분류·반영되는 과정을 테스트해 볼 수 있습니다.
            </p>
          </div>

          <div className="mt-4">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-xs font-bold transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>새로운 후기 추가 폼 {showAddForm ? "닫기" : "열기"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Review Form Component */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form 
              onSubmit={handleAddReviewSubmit}
              className="rounded-3xl border border-blue-100 bg-blue-50/10 p-6 shadow-sm space-y-4"
            >
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-blue-600" /> 신규 VOC (후기) 등록하기
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Product Name Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500">상품명</label>
                  <input
                    type="text"
                    list="popular-products"
                    placeholder="예: 플라워 럭키박스"
                    value={newProduct}
                    onChange={(e) => setNewProduct(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                    required
                  />
                  <datalist id="popular-products">
                    {popularProducts.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>

                {/* Rating Select */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500">만족도 (별점)</label>
                  <select
                    value={newRating}
                    onChange={(e) => setNewRating(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  >
                    <option value={5}>★★★★★ (5점 - 추천)</option>
                    <option value={4}>★★★★☆ (4점 - 추천)</option>
                    <option value={3}>★★★☆☆ (3점 - 중립)</option>
                    <option value={2}>★★☆☆☆ (2점 - 비추천)</option>
                    <option value={1}>★☆☆☆☆ (1점 - 비추천)</option>
                  </select>
                </div>

                {/* Category Select */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500">이슈 유형 (카테고리)</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="품질/상태">품질/상태 (담당: SCM & MD)</option>
                    <option value="배송/포장">배송/포장 (담당: SCM & CS)</option>
                    <option value="상품구성/양">상품구성/양 (담당: MD)</option>
                    <option value="서비스/시스템">서비스/시스템 (담당: 프로덕트)</option>
                  </select>
                </div>
              </div>

              {/* Review Text Area */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">고객 리뷰 내용</label>
                <textarea
                  rows={2}
                  placeholder="예: 배송 중 꽃잎이 시들어서 왔어요. 날씨가 너무 더워서 그런 것 같네요."
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2">
                {submitSuccess ? (
                  <span className="inline-flex items-center gap-1 rounded-xl bg-green-50 px-4 py-2 text-xs font-bold text-green-700 border border-green-200">
                    <Check className="h-4 w-4" />
                    <span>실시간 DB에 성공적으로 등록되었습니다!</span>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>등록 중...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>VOC 등록하기</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Controller Box */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">

        
        {/* Row 1: Search & Sort & Reset */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-lg">
            <input
              type="text"
              placeholder="리뷰 내용 또는 상품명 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(12); // Reset visible count on search
              }}
              className="w-full pl-4 pr-10 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Select */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> 정렬
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              >
                <option value="id-desc">최신순</option>
                <option value="id-asc">과거순</option>
                <option value="rating-desc">별점 높은순</option>
                <option value="rating-asc">별점 낮은순</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" /> 필터 초기화
            </button>

            {/* CSV Export Button */}
            <button
              onClick={handleExportToCSV}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 transition cursor-pointer shadow-2xs"
              title="현재 필터가 적용된 화면상의 리뷰 데이터를 CSV 파일로 내보냅니다."
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              CSV로 내보내기
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Row 2: Type Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-2">유형 구분</span>
            
            {/* Type Buttons */}
            {(["전체", "추천", "중립", "비추천"] as const).map(type => {
              const isActive = selectedType === type;
              const count = statsCounts[type];
              
              // Colors matching ratings
              let activeColorClass = "bg-blue-600 text-white border-blue-600";
              if (type === "중립") activeColorClass = "bg-amber-600 text-white border-amber-600";
              if (type === "비추천") activeColorClass = "bg-red-600 text-white border-red-600";

              return (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setVisibleCount(12);
                  }}
                  className={`px-3 py-1 text-xs rounded-full border transition flex items-center gap-1.5 cursor-pointer ${
                    isActive 
                      ? activeColorClass 
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{type}</span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 font-medium"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-2">카테고리</span>
          
          {categories.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(12);
                }}
                className={`px-2.5 py-0.8 text-xs rounded-md border transition cursor-pointer ${
                  isActive 
                    ? "bg-slate-800 border-slate-800 text-white font-semibold" 
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="h-px bg-slate-100" />

        {/* Row 4: Time Archives (Year/Month/Day Drilldown Dropdowns) */}
        <div className="space-y-3 bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
            <Calendar className="h-4 w-4 text-blue-600" />
            <span>시점별 아카이브 탐색 (드롭다운 필터)</span>
            <span className="text-[10px] text-slate-400 font-medium">(원하는 연도, 월, 일을 순서대로 선택하여 상세히 필터링할 수 있습니다)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Year Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">연도</label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
              >
                <option value="전체">연도 전체</option>
                {availableDates.years.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>

            {/* Month Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">월</label>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
              >
                <option value="전체">월 전체</option>
                {availableDates.months.map(m => (
                  <option key={m} value={m}>{parseInt(m, 10)}월</option>
                ))}
              </select>
            </div>

            {/* Day Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">일자</label>
              <select
                value={selectedDay}
                onChange={(e) => handleDayChange(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600 cursor-pointer"
              >
                <option value="전체">일자 전체</option>
                {availableDates.days.map(d => (
                  <option key={d} value={d}>{parseInt(d, 10)}일</option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* Reviews Board (List Table) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            총 <strong className="text-slate-700">{filteredAndSortedReviews.length}</strong>건의 리뷰가 조건에 맞게 검색되었습니다.
            <span className="ml-2 text-[10px] text-slate-400 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
              💡 동일한 후기(리뷰어+날짜)에서 등록된 상품평들은 자동으로 묶여 정렬됩니다.
            </span>
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center w-36 bg-slate-100/30">리뷰어</th>
                  <th className="py-3 px-3 w-20">구분</th>
                  <th className="py-3 px-3 w-24">날짜</th>
                  <th className="py-3 px-4 w-48">상품명</th>
                  <th className="py-3 px-4">리뷰 내용</th>
                  <th className="py-3 px-3 w-28">카테고리</th>
                  <th className="py-3 px-3 w-24">담당부서</th>
                  <th className="py-3 px-4 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedReviews.slice(0, visibleCount).map((item, index, arr) => {
                  const isExpanded = expandedReviewId === item.id;
                  
                  // Check if this review belongs to the same post (same reviewer & date) as the previous one
                  const prevItem = index > 0 ? arr[index - 1] : null;
                  const itemReviewer = item.reviewer || `고객#${item.id}`;
                  const prevReviewer = prevItem ? (prevItem.reviewer || `고객#${prevItem.id}`) : null;
                  const isSamePostAsPrev = prevItem && (itemReviewer === prevReviewer) && (item.date === prevItem.date);

                  let typeLabelColor = "bg-blue-50 text-blue-700 ring-blue-700/10";
                  let typeIcon = <ShieldCheck className="h-3 w-3 text-blue-600" />;
                  if (item.type === "중립") {
                    typeLabelColor = "bg-amber-50 text-amber-700 ring-amber-700/10";
                    typeIcon = <HelpCircle className="h-3 w-3 text-amber-500" />;
                  } else if (item.type === "비추천") {
                    typeLabelColor = "bg-red-50 text-red-700 ring-red-700/10";
                    typeIcon = <AlertOctagon className="h-3 w-3 text-red-600" />;
                  }

                  const dept = item.category === "상품구성/양" ? "MD" : item.category === "서비스/시스템" ? "프로덕트" : item.department;

                  return (
                    <React.Fragment key={item.id}>
                      {/* Row */}
                      <tr 
                        onClick={() => setExpandedReviewId(isExpanded ? null : item.id)}
                        className={`hover:bg-slate-50/50 transition cursor-pointer select-none ${isExpanded ? "bg-blue-50/10" : ""} ${isSamePostAsPrev ? "bg-slate-50/10" : ""}`}
                      >
                        <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-700 border-r border-slate-50">
                          {isSamePostAsPrev ? (
                            <span className="text-[10px] text-slate-400 font-semibold italic flex items-center justify-center gap-1 bg-slate-50/30 py-1 rounded-md">
                              ↳ <span className="opacity-70">위와 동일한 게시글</span>
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span>
                                {item.reviewer ? `${item.reviewer}님의 후기` : `고객#${item.id}님의 후기`}
                              </span>
                              {item.image_url && (
                                <a 
                                  href={item.image_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center shrink-0 text-slate-500 hover:text-blue-600 transition hover:scale-110"
                                  title="사진 후기 보기 (새 창)"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📷
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${typeLabelColor}`}>
                              {typeIcon}
                              {item.type}
                            </span>
                            {item.archived ? (
                              <span className="inline-flex items-center text-[9px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.2 rounded-sm whitespace-nowrap">
                                아카이브
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.2 rounded-sm whitespace-nowrap animate-pulse">
                                금주 집계중
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-400">
                          {item.date}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-800 max-w-[12rem] truncate">
                          {item.product}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-600 max-w-sm truncate">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.image_url && (
                              <a 
                                href={item.image_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center shrink-0 text-slate-500 hover:text-blue-600 transition hover:scale-110"
                                title="사진 후기 보기 (새 창)"
                                onClick={(e) => e.stopPropagation()}
                              >
                                📷
                              </a>
                            )}
                            <span className="truncate">{item.review}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-600/10 ring-inset">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                            {dept}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </td>
                      </tr>

                      {/* Collapsible details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50/30 px-6 py-4 border-t border-b border-slate-100">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400">리뷰 상세 정보 (ID: #{item.id})</span>
                                  <div className="h-3 w-px bg-slate-200" />
                                  <span className="text-xs font-bold text-slate-700">
                                    {item.reviewer ? `${item.reviewer}님의 후기` : "익명 고객님의 후기"}
                                  </span>
                                  {item.image_url && (
                                    <>
                                      <div className="h-3 w-px bg-slate-200" />
                                      <a 
                                        href={item.image_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                        title="사진 후기 보기 (새 창)"
                                      >
                                        📷 <span className="text-[11px] font-semibold">사진 후기</span>
                                      </a>
                                    </>
                                  )}
                                  <div className="h-3 w-px bg-slate-200" />
                                  <span className="text-xs font-semibold text-slate-700">{item.product}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 font-bold">고객 만족도 별점:</span>
                                  {renderStars(item.rating)}
                                  <span className="text-xs font-bold text-slate-600">({item.rating}점)</span>
                                </div>
                              </div>

                              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs relative">
                                <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-300">
                                  등록일: {item.date}
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed font-medium pl-2 border-l-2 border-blue-500">
                                  &ldquo;{item.review}&rdquo;
                                </p>
                              </div>

                              <div className="flex gap-2 text-[10px] text-slate-400 font-medium">
                                <span>• <strong>대분류:</strong> {item.category}</span>
                                <span>• <strong>담당 부서:</strong> {dept}</span>
                                <span>• <strong>감정 상태:</strong> {item.type}</span>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredAndSortedReviews.slice(0, visibleCount).map((item, index, arr) => {
              const isExpanded = expandedReviewId === item.id;
              
              // Check if this review belongs to the same post (same reviewer & date) as the previous one
              const prevItem = index > 0 ? arr[index - 1] : null;
              const itemReviewer = item.reviewer || `고객#${item.id}`;
              const prevReviewer = prevItem ? (prevItem.reviewer || `고객#prevItem.id`) : null;
              const isSamePostAsPrev = prevItem && (itemReviewer === prevReviewer) && (item.date === prevItem.date);

              let typeLabelColor = "bg-blue-50 text-blue-700 ring-blue-700/10";
              let typeIcon = <ShieldCheck className="h-3 w-3 text-blue-600" />;
              if (item.type === "중립") {
                typeLabelColor = "bg-amber-50 text-amber-700 ring-amber-700/10";
                typeIcon = <HelpCircle className="h-3 w-3 text-amber-500" />;
              } else if (item.type === "비추천") {
                typeLabelColor = "bg-red-50 text-red-700 ring-red-700/10";
                typeIcon = <AlertOctagon className="h-3 w-3 text-red-600" />;
              }

              const dept = item.category === "상품구성/양" ? "MD" : item.category === "서비스/시스템" ? "프로덕트" : item.department;

              return (
                <div 
                  key={item.id} 
                  className={`p-4 transition ${isExpanded ? "bg-blue-50/10" : "bg-white"} ${isSamePostAsPrev ? "bg-slate-50/5" : ""}`}
                >
                  <div 
                    onClick={() => setExpandedReviewId(isExpanded ? null : item.id)}
                    className="flex items-start justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isSamePostAsPrev ? (
                          <span className="text-[10px] text-slate-400 font-semibold italic">
                            ↳ 위와 동일한 게시글 후기
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold text-slate-700">
                              {item.reviewer ? `${item.reviewer}님의 후기` : `고객#${item.id}님의 후기`}
                            </span>
                            <span className="text-[10px] text-slate-400">|</span>
                            <span className="text-[10px] text-slate-400">{item.date}</span>
                            {item.image_url && (
                              <>
                                <span className="text-[10px] text-slate-400">|</span>
                                <a 
                                  href={item.image_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs hover:scale-110 active:scale-95 transition inline-flex items-center shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                  title="사진 후기 보기 (새 창)"
                                >
                                  📷
                                </a>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.product}</h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{item.review}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${typeLabelColor}`}>
                        {typeIcon}
                        {item.type}
                      </span>
                      {item.archived ? (
                        <span className="inline-flex items-center text-[9px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.2 rounded-sm">
                          아카이브
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-sm animate-pulse">
                          금주 집계중
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-slate-100 space-y-3"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-bold">별점:</span>
                        {renderStars(item.rating)}
                      </div>

                      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          &ldquo;{item.review}&rdquo;
                        </p>
                      </div>

                      {item.image_url && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">첨부 이미지:</span>
                          <a 
                            href={item.image_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                            title="사진 후기 보기 (새 창)"
                          >
                            📷 사진 링크 열기
                          </a>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-600/10 ring-inset">
                          {item.category}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                          {dept}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Load More Trigger */}
        {filteredAndSortedReviews.length > visibleCount && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => setVisibleCount(prev => prev + 12)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs cursor-pointer transition"
            >
              후기 더 보기 ({visibleCount} / {filteredAndSortedReviews.length})
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
