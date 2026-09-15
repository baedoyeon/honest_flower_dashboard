import React, { useState, useMemo, useEffect } from "react";
import { Review } from "../data/classifiedReviews";
import { Star, Filter, ArrowUpDown, RefreshCw, MessageSquare, ShieldCheck, HelpCircle, AlertOctagon, Calendar, ChevronDown, ChevronUp, Database, Plus, Check, Loader2, Download, Search, Upload, FileSpreadsheet, FileText, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Eye, Trash2, BarChart2, PieChart, AlertTriangle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews, getGroupKeysMap, findIntegrityIssues, getDeduplicatedReviews, areReviewsSamePost } from "../context/ReviewsContext";
import { rawReviewsCSV } from "../data/rawReviews";
import { parseCSVToReviews, parseCSVToIncidents, detectCSVType, CSVParseResult } from "../utils/csvParser";
import SchemaMismatchError from "./SchemaMismatchError";

export default function ReviewArchiveTab() {
  const { 
    reviews: reviewsData,
    isLoading,
    addReview,
    isSyncing,
    importParsedReviews,
    importIncidents,
    resetToInitialData,
    setActiveTab,
    highlightTargetId,
    setHighlightTargetId
  } = useReviews();

  // Precompute group keys mapping for all reviews using high-precision similarity logic
  const groupKeysMap = useMemo(() => getGroupKeysMap(reviewsData), [reviewsData]);

  // Data Integrity Audit States
  const [showIntegrityPanel, setShowIntegrityPanel] = useState(false);
  const [integritySuccessMsg, setIntegritySuccessMsg] = useState<string | null>(null);
  const integrityIssues = useMemo(() => findIntegrityIssues(reviewsData), [reviewsData]);

  const handleFixIntegrity = async () => {
    const deduplicated = getDeduplicatedReviews(reviewsData);
    await importParsedReviews(deduplicated, false);
    setIntegritySuccessMsg(`정합성 보정이 완료되었습니다! 동일 내용의 리뷰 ${reviewsData.length - deduplicated.length}건이 단건으로 통합 및 작성자 명칭이 수렴되었습니다.`);
  };

  // States
  const [selectedType, setSelectedType] = useState<"전체" | "추천" | "중립" | "비추천">("전체");
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [searchTarget, setSearchTarget] = useState<"전체" | "리뷰내용" | "상품명" | "리뷰어">("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"id-desc" | "id-asc" | "rating-desc" | "rating-asc">("id-desc");
  const [visibleCount, setVisibleCount] = useState(12);

  // Time Archive States
  const [selectedYear, setSelectedYear] = useState<string>("전체");
  const [selectedMonth, setSelectedMonth] = useState<string>("전체");
  const [selectedDay, setSelectedDay] = useState<string>("전체");
  const [dateFilterType, setDateFilterType] = useState<"dropdown" | "calendar">("dropdown");
  const [calendarStart, setCalendarStart] = useState<string>("");
  const [calendarEnd, setCalendarEnd] = useState<string>("");
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);

  // Add Live Review Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [newCategory, setNewCategory] = useState("품질/상태");
  const [newReviewText, setNewReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // CSV Importer & Parser States
  const [showCSVPanel, setShowCSVPanel] = useState(false);
  const [csvRawInput, setCsvRawInput] = useState("");
  const [parsedCSVResult, setParsedCSVResult] = useState<CSVParseResult | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<"file" | "sample" | "paste" | "api">("file");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // CSV File Upload Handler
  const handleCSVFileChange = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      alert("CSV 파일(.csv) 형식만 업로드 가능합니다.");
      return;
    }
    setSelectedFileName(file.name);
    setIsParsingCSV(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
        setCsvRawInput(text);
        const csvType = detectCSVType(text);
        if (csvType === "incidents") {
          const incResult = parseCSVToIncidents(text);
          setIsParsingCSV(false);
          if (confirm(`업로드하신 파일은 'CS 사고접수' 전용 CSV 데이터(${incResult.validCount}건)로 감지되었습니다.\n\n사진 후기 데이터와 분리된 '사고접수 현황' 전용 파이프라인으로 안전하게 반영하시겠습니까?`)) {
            await importIncidents(incResult.incidents, true);
            setActiveTab("incidents");
            setShowCSVPanel(false);
            return;
          }
        }
        const result = parseCSVToReviews(text);
        setParsedCSVResult(result);
      }
      setIsParsingCSV(false);
    };
    reader.onerror = () => {
      alert("파일을 읽는 중 오류가 발생했습니다.");
      setIsParsingCSV(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  // Load Sample CSV Handler
  const handleLoadSampleCSV = () => {
    setIsParsingCSV(true);
    setSelectedFileName("honestflower_raw_reviews_sample.csv");
    setCsvRawInput(rawReviewsCSV);
    const result = parseCSVToReviews(rawReviewsCSV);
    setParsedCSVResult(result);
    setIsParsingCSV(false);
  };

  // Parse Pasted Text Handler
  const handleParsePastedText = async () => {
    if (!csvRawInput.trim()) {
      alert("파싱할 CSV 텍스트를 입력해주세요.");
      return;
    }
    setIsParsingCSV(true);
    setSelectedFileName("직접 입력된 CSV 데이터");

    const csvType = detectCSVType(csvRawInput);
    if (csvType === "incidents") {
      const incResult = parseCSVToIncidents(csvRawInput);
      setIsParsingCSV(false);
      if (confirm(`입력하신 텍스트는 'CS 사고접수' CSV 데이터(${incResult.validCount}건)로 감지되었습니다.\n\n사진 후기 데이터와 분리된 '사고접수 현황' 전용 파이프라인으로 안전하게 반영하시겠습니까?`)) {
        await importIncidents(incResult.incidents, true);
        setActiveTab("incidents");
        setShowCSVPanel(false);
        return;
      }
    }

    const result = parseCSVToReviews(csvRawInput);
    setParsedCSVResult(result);
    setIsParsingCSV(false);
  };

  // Apply to Dashboard Handler
  const handleApplyCSVToDashboard = async () => {
    if (!parsedCSVResult || parsedCSVResult.reviews.length === 0) {
      alert("파싱된 리뷰 데이터가 없습니다.");
      return;
    }
    try {
      setIsParsingCSV(true);
      await importParsedReviews(parsedCSVResult.reviews, importMode === "append");
      setCsvImportSuccess(`CSV 리뷰 데이터 ${parsedCSVResult.reviews.length}건이 성공적으로 파싱되어 상태에 저장되었습니다! 대시보드 지표 및 분석 탭에서 즉시 확인 가능합니다.`);
      setParsedCSVResult(null);
      setCsvRawInput("");
      setSelectedFileName(null);
    } catch (err) {
      alert("대시보드 반영 중 오류가 발생했습니다: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

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
      list = list.filter(r => {
        const reviewText = (r.review || "").toLowerCase();
        const productName = (r.product || "").toLowerCase();
        const reviewerName = (r.reviewer || "").toLowerCase();
        const customerIdText = `고객#${r.id}`.toLowerCase();

        if (searchTarget === "리뷰내용") {
          return reviewText.includes(q);
        }
        if (searchTarget === "상품명") {
          return productName.includes(q);
        }
        if (searchTarget === "리뷰어") {
          return reviewerName.includes(q) || customerIdText.includes(q);
        }
        // "전체"
        return (
          reviewText.includes(q) ||
          productName.includes(q) ||
          reviewerName.includes(q) ||
          customerIdText.includes(q)
        );
      });
    }

    // 3.5 Filter by Date (Dropdown or Calendar Range)
    if (dateFilterType === "calendar") {
      if (calendarStart) {
        const startDot = calendarStart.replace(/-/g, ".");
        list = list.filter(r => r.date >= startDot);
      }
      if (calendarEnd) {
        const endDot = calendarEnd.replace(/-/g, ".");
        list = list.filter(r => r.date <= endDot);
      }
    } else {
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
    }

    // 4. Sorting
    // To keep reviews from the same post (same reviewer, same date, and highly similar content) consecutive:
    // First, let's identify the group representative values.
    const groupRepresentatives = new Map<string, { maxId: number; minId: number; maxRating: number; minRating: number; date: string }>();
    
    // High-precision helper to get group key
    const getGroupKey = (r: any) => {
      return groupKeysMap.get(r.id) || `group_fallback_${r.id}`;
    };

    list.forEach(r => {
      const groupKey = getGroupKey(r);
      const current = groupRepresentatives.get(groupKey);
      if (!current) {
        groupRepresentatives.set(groupKey, {
          maxId: Number(r.id),
          minId: Number(r.id),
          maxRating: r.rating,
          minRating: r.rating,
          date: r.date
        });
      } else {
        current.maxId = Math.max(current.maxId, Number(r.id));
        current.minId = Math.min(current.minId, Number(r.id));
        current.maxRating = Math.max(current.maxRating, r.rating);
        current.minRating = Math.min(current.minRating, r.rating);
      }
    });

    list.sort((a, b) => {
      const aGroupKey = getGroupKey(a);
      const bGroupKey = getGroupKey(b);

      // If they belong to the same group (same post), keep them together
      if (aGroupKey === bGroupKey) {
        // Within the same group, sort by ID descending to show newest product in post first
        return Number(b.id) - Number(a.id);
      }

      // If they are in different groups, sort the groups themselves by their representative values
      const aRep = groupRepresentatives.get(aGroupKey)!;
      const bRep = groupRepresentatives.get(bGroupKey)!;

      if (sortBy === "id-desc") {
        if (bRep.date !== aRep.date) {
          return bRep.date.localeCompare(aRep.date);
        }
        return bRep.maxId - aRep.maxId;
      }
      if (sortBy === "id-asc") {
        if (aRep.date !== bRep.date) {
          return aRep.date.localeCompare(bRep.date);
        }
        return aRep.minId - bRep.minId;
      }
      if (sortBy === "rating-desc") {
        if (bRep.maxRating !== aRep.maxRating) {
          return bRep.maxRating - aRep.maxRating;
        }
        if (bRep.date !== aRep.date) {
          return bRep.date.localeCompare(aRep.date);
        }
        return bRep.maxId - aRep.maxId; // Fallback to ID desc
      }
      if (sortBy === "rating-asc") {
        if (aRep.minRating !== bRep.minRating) {
          return aRep.minRating - bRep.minRating;
        }
        if (aRep.date !== bRep.date) {
          return aRep.date.localeCompare(bRep.date);
        }
        return aRep.minId - bRep.minId; // Fallback to ID asc
      }

      return 0;
    });

    return list;
  }, [reviewsData, selectedType, selectedCategory, searchTarget, searchQuery, sortBy, selectedYear, selectedMonth, selectedDay, dateFilterType, calendarStart, calendarEnd]);

  // 알림센터에서 특정 리뷰로 이동해왔을 때: 기본 필터(전체/전체/빈 검색어)로 마운트된 상태를
  // 가정하고, 목록에서 대상 리뷰를 찾아 펼치고 보이는 범위(visibleCount)를 넓혀 스크롤 위치를 맞춘다.
  useEffect(() => {
    if (!highlightTargetId) return;
    const targetIdNum = Number(highlightTargetId);
    if (Number.isNaN(targetIdNum)) return;
    const idx = filteredAndSortedReviews.findIndex(r => r.id === targetIdNum);
    if (idx === -1) return;
    setVisibleCount(v => (idx + 1 > v ? idx + 1 : v));
    setExpandedReviewId(targetIdNum);
  }, [highlightTargetId, filteredAndSortedReviews]);

  useEffect(() => {
    if (!highlightTargetId) return;
    const els = document.querySelectorAll(`[data-review-row="${highlightTargetId}"]`);
    const visibleEl = Array.from(els).find(el => (el as HTMLElement).offsetParent !== null) || els[0];
    visibleEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightTargetId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightTargetId, visibleCount]);

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
    setSearchTarget("전체");
    setSearchQuery("");
    setSortBy("id-desc");
    setSelectedYear("전체");
    setSelectedMonth("전체");
    setSelectedDay("전체");
    setDateFilterType("dropdown");
    setCalendarStart("");
    setCalendarEnd("");
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
    if (rating <= 0) {
      return <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">평점 없음 (CS 접수건)</span>;
    }
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
      {/* 0. Database Control & CSV Setup Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Sync Status Banner */}
        <div className="rounded-3xl p-6 border border-amber-200 bg-amber-50/50 text-amber-900 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-sm">데이터베이스 로컬 모드</h3>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800">
                로컬 백업 모드
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 font-medium">
              브라우저 IndexedDB에 저장됩니다(서버 DB 연동 아님). 아래 CSV 파싱기로 후기 데이터셋을 업로드할 수 있습니다. (총 {reviewsData.length}건 저장됨)
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                if (confirm("CSV 업로드 이전의 원본 기본 데이터셋으로 되돌리시겠습니까?\n업로드된 CSV 및 커스텀 데이터가 초기화됩니다.")) {
                  resetToInitialData();
                }
              }}
              disabled={isSyncing}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-2 text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>업로드 전 초기 데이터로 되돌리기</span>
            </button>
          </div>
        </div>

        {/* CSV File Parser & VOC Classifier Card */}
        <div className="rounded-3xl p-6 border border-emerald-100 bg-emerald-50/30 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-emerald-100/80 p-1.5 text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm text-emerald-950">CSV 파싱 & 어드민 API</h3>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                VOC 가이드 자동분류
              </span>
            </div>
            <p className="text-xs leading-relaxed text-emerald-800/80 font-medium">
              CSV 파일 데이터를 파싱하거나 어드민 REST/웹훅 API 명세를 통해 대시보드 상태에 실시간 동기화합니다.
            </p>
          </div>

          <div className="mt-4">
            <button
              onClick={() => {
                setShowCSVPanel(!showCSVPanel);
                if (showAddForm) setShowAddForm(false);
                if (showIntegrityPanel) setShowIntegrityPanel(false);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>CSV 파싱 및 임포터 도구 {showCSVPanel ? "닫기" : "열기"}</span>
            </button>
          </div>
        </div>

        {/* Data Integrity Audit & Deduplication Engine Card */}
        <div className="rounded-3xl p-6 border border-indigo-100 bg-indigo-50/30 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm text-indigo-950">리뷰 데이터 정합성 모니터링</h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                integrityIssues.length > 0 ? "bg-rose-100 text-rose-800" : "bg-indigo-100 text-indigo-800"
              }`}>
                {integrityIssues.length > 0 ? `이슈 ${integrityIssues.length}건` : "정합성 정상"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-indigo-900/80 font-medium">
              동일 후기 내용인데 작성자명이 다르게 파싱되었거나 중복 등록된 데이터 정합성 이슈를 진단하고 자동 보정합니다.
            </p>
          </div>

          <div className="mt-4">
            <button
              onClick={() => {
                setShowIntegrityPanel(!showIntegrityPanel);
                if (showCSVPanel) setShowCSVPanel(false);
                if (showAddForm) setShowAddForm(false);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>정합성 검사 및 자동 보정 {showIntegrityPanel ? "닫기" : "열기"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Integrity Audit Panel Component */}
      <AnimatePresence>
        {showIntegrityPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-indigo-200 bg-indigo-50/20 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      리뷰 데이터 정합성 검사 및 동일 후기/리뷰어 자동 보정 도구
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                        Data Integrity Audit Engine
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      어드민 DB / CSV 내보내기 시 동일한 리뷰 내용(`review`)에 대해 리뷰어명(`reviewer`)이 다르게 생성되었거나 다중 이미지 행으로 중복 등록된 항목을 진단 및 자동 보정합니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIntegrityPanel(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  닫기 ✕
                </button>
              </div>

              {integritySuccessMsg && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{integritySuccessMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs">
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      진단 결과: {integrityIssues.length > 0 ? `총 ${integrityIssues.length}건의 동일 내용/리뷰어 불일치 및 중복 건 발견` : "데이터 정합성 이상 없음 (모든 리뷰 정상)"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      원인 분석: 동일 날짜/상품에 수집된 리뷰 중 텍스트가 100% 동일하지만 작성자 마스킹(`id % 20`) 차이로 다른 이름이 할당된 케이스
                    </p>
                  </div>
                  {integrityIssues.length > 0 && (
                    <button
                      onClick={handleFixIntegrity}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>1-클릭 정합성 자동 보정 (중복 단건 통합 & 리뷰어 통일)</span>
                    </button>
                  )}
                </div>

                {integrityIssues.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {integrityIssues.map((issue, idx) => (
                      <div key={idx} className="bg-white border border-indigo-100 rounded-xl p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                            {issue.date} | {issue.product}
                          </span>
                          <span className="text-[10px] text-indigo-600 font-semibold">
                            중복 감지: {issue.reviews.length}건 (통합 작성자: {issue.suggestedReviewer})
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium text-[11px] italic bg-slate-50 p-2 rounded">
                          "{issue.reviewText}"
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>감지된 작성자 명칭:</span>
                          {issue.reviews.map(r => (
                            <span key={r.id} className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                              {r.reviewer || `고객#${r.id}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSV Importer & Parser Panel Component */}
      <AnimatePresence>
        {showCSVPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/20 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-emerald-600 p-2 text-white shadow-sm">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      CSV 데이터 파싱 및 VOC 분류 엔진
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        ReviewArchiveTab State Engine
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      업로드된 CSV의 항목(id, 작성일, 상품명, 평점, 후기내용)을 파싱하여 어니스트플라워 가이드라인 기반으로 카테고리/담당부서를 자동 분류 및 상태 저장합니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCSVPanel(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-1 rounded-lg hover:bg-slate-100 transition"
                >
                  닫기 ✕
                </button>
              </div>

              {/* Input Mode Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                <button
                  onClick={() => setActiveInputTab("file")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeInputTab === "file"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>CSV 파일 업로드 (드래그앤드롭)</span>
                </button>
                <button
                  onClick={() => setActiveInputTab("sample")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeInputTab === "sample"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>원천 샘플 CSV (200여건) 1-클릭 로드</span>
                </button>
                <button
                  onClick={() => setActiveInputTab("paste")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeInputTab === "paste"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>CSV 텍스트 직접 붙여넣기</span>
                </button>
                <button
                  onClick={() => setActiveInputTab("api")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeInputTab === "api"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
                  }`}
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>자사 어드민 API 연동 설계 (Future Integration)</span>
                </button>
              </div>

              {/* File Upload Mode */}
              {activeInputTab === "file" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleCSVFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition ${
                    isDragOver 
                      ? "border-emerald-500 bg-emerald-100/50 scale-[0.99]" 
                      : "border-emerald-300 bg-white hover:border-emerald-400"
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCSVFileChange(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <div className="rounded-full bg-emerald-100 p-3 text-emerald-600">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      CSV 파일을 이곳에 끌어다 놓거나 클릭하여 선택하세요
                    </p>
                    <p className="text-xs text-slate-400">
                      지원 형식: UTF-8 인코딩된 .csv 파일 (열 헤더: id, 작성일, 상품명, 평점, 후기내용 등)
                    </p>
                    {selectedFileName && (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-900">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        <span>선택된 파일: {selectedFileName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sample Loader Mode */}
              {activeInputTab === "sample" && (
                <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">내장 원천 rawReviewsCSV 데이터셋 (200여건)</h5>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        `src/data/rawReviews.ts`에 내장된 실제 어니스트플라워 고객 VOC 파이프라인 CSV 원천 데이터를 1-클릭으로 자동 파싱합니다.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLoadSampleCSV}
                    disabled={isParsingCSV}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    <span>원천 CSV 데이터 파싱 실행</span>
                  </button>
                </div>
              )}

              {/* Paste Text Mode */}
              {activeInputTab === "paste" && (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={csvRawInput}
                    onChange={(e) => setCsvRawInput(e.target.value)}
                    placeholder="id,date,product,rating,review,type,category&#10;1,2026.06.25,거베라,1,거베라 고개가 축 처져서 왔어요,,&#10;2,2026.06.25,플라워 럭키박스,5,구성 풍성하고 너무 예뻐요,추천,상품구성/양"
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-xs font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleParsePastedText}
                      disabled={isParsingCSV || !csvRawInput.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      <span>입력한 CSV 텍스트 파싱 및 분석</span>
                    </button>
                  </div>
                </div>
              )}

              {/* API Integration Direct Sync Mode */}
              {activeInputTab === "api" && (
                <div className="rounded-2xl bg-white border border-indigo-200 p-6 space-y-5 shadow-2xs">
                  <div className="flex items-start justify-between border-b border-indigo-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          어니스트플라워 자사 어드민 API 자동 연동 파이프라인
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                            RESTful / Webhook API Spec
                          </span>
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          CSV 수동 업로드 대신 자사 어드민 백엔드 REST API 또는 웹훅(Webhook)을 통해 실시간 동기화하기 위한 명세 및 가이드입니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">1. REST API 새로고침 동기화 (Pull, 우선 적용)</span>
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">GET /api/v1/voc/reviews/sync</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        대시보드의 '새로고침' 버튼 클릭 시, 그리고 백그라운드에서 5분 주기로 어드민 API를 당겨와(pull) 변경분만 반영합니다.
                        `updated_since` 커서를 써서 신규 리뷰뿐 아니라 노출여부/평점이 나중에 수정된 기존 리뷰도 놓치지 않고 갱신합니다.
                      </p>
                      <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[10px] overflow-x-auto">
                        {`Authorization: Bearer <ADMIN_API_TOKEN>
GET https://admin.honestflower.kr/api/v1/voc/reviews/sync?updated_since=2026-08-20T09:00:00Z&limit=500`}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">2. 실시간 웹훅 연동 (향후 확장, 지금 범위 아님)</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">POST /api/voc/webhook (계획)</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        어드민이 이벤트 발신 인프라를 갖추면, 폴링 대신 review.created / review.updated / review.hidden 이벤트를 실시간으로 수신하도록
                        전환할 수 있습니다. 지금 단계에서는 구현 범위가 아니고 향후 옵션으로만 남겨둡니다.
                      </p>
                      <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[10px] overflow-x-auto">
                        {`POST /api/voc/webhook
Content-Type: application/json
{ "event": "review.updated", "data": { "id": "59615", "노출여부": false, "updated_at": "2026-08-20T10:15:00Z" } }`}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h6 className="text-xs font-bold text-indigo-950">어드민 API 토큰 테스트 mock 콜백</h6>
                      <p className="text-[11px] text-indigo-700">실제 연동 전, 위 `GET .../sync` 응답 스키마(CSV export와 동일한 컬럼명 사용)와 동일한 형태의 mock 데이터로 새로고침 동작을 미리 검증할 수 있습니다.</p>
                    </div>
                    <button
                      onClick={() => {
                        handleLoadSampleCSV();
                        setActiveInputTab("sample");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>mock API 데이터 연동 수신 테스트</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Parsed Results Preview Section */}
              {parsedCSVResult && (
                <div className="rounded-2xl bg-white border border-emerald-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        CSV 파싱 완료: 총 <span className="text-emerald-600 font-extrabold">{parsedCSVResult.validCount}</span>건 검증됨
                      </h5>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span>적용 방식:</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === "append"}
                            onChange={() => setImportMode("append")}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>기존 병합 (Append)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer ml-2">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === "replace"}
                            onChange={() => setImportMode("replace")}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>전체 교체 (Replace)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {parsedCSVResult.isLikelyWrongFileType ? (
                    <SchemaMismatchError
                      detectedColumns={parsedCSVResult.detectedColumns}
                      guidance={`어드민 리뷰 목록의 "내보내기" 버튼으로 받은 CSV가 맞는지 확인해주세요. 사고접수 CSV라면 "사고접수" 탭에 올려야 합니다.`}
                    />
                  ) : parsedCSVResult.missingCriticalColumns.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">다음 필수 컬럼을 인식하지 못했습니다: {parsedCSVResult.missingCriticalColumns.join(", ")}.</span>{" "}
                        CSV 헤더명을 확인해주세요 — 인식 못한 값은 리뷰 텍스트 키워드 추정이나 기본값으로 채워져 실제와 다를 수 있습니다.
                      </p>
                    </div>
                  )}

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">파싱 행 수</span>
                      <span className="text-sm font-bold text-slate-800">{parsedCSVResult.validCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-emerald-50/50 p-3 border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 font-bold block uppercase">VOC가이드 자동 분류</span>
                      <span className="text-sm font-bold text-emerald-900">{parsedCSVResult.autoClassifiedCount} 건 처리</span>
                    </div>
                    <div className="rounded-xl bg-blue-50/50 p-3 border border-blue-100">
                      <span className="text-[10px] text-blue-600 font-bold block uppercase">수집 기간 Span</span>
                      <span className="text-xs font-bold text-blue-900">{parsedCSVResult.dateRange.start || "N/A"} ~ {parsedCSVResult.dateRange.end || "N/A"}</span>
                    </div>
                    <div className="rounded-xl bg-purple-50/50 p-3 border border-purple-100">
                      <span className="text-[10px] text-purple-600 font-bold block uppercase">카테고리 구성비</span>
                      <span className="text-xs font-bold text-purple-900">
                        품질({parsedCSVResult.categoriesSummary["품질/상태"] || 0}) / 배송({parsedCSVResult.categoriesSummary["배송/포장"] || 0}) / 구성({parsedCSVResult.categoriesSummary["상품구성/양"] || 0})
                      </span>
                    </div>
                  </div>

                  {/* Preview Table of First 6 Rows */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">ID</th>
                          <th className="py-2.5 px-3">작성일</th>
                          <th className="py-2.5 px-3">상품명</th>
                          <th className="py-2.5 px-3">평점</th>
                          <th className="py-2.5 px-3">추천구분</th>
                          <th className="py-2.5 px-3">VOC 카테고리(자동)</th>
                          <th className="py-2.5 px-3">담당부서</th>
                          <th className="py-2.5 px-3">후기 내용 요약</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedCSVResult.reviews.slice(0, 6).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-mono text-slate-400">#{item.id}</td>
                            <td className="py-2 px-3 font-medium text-slate-700">{item.date}</td>
                            <td className="py-2 px-3 font-bold text-slate-900 max-w-[120px] truncate">{item.product}</td>
                            <td className="py-2 px-3 text-amber-500 font-bold">★ {item.rating}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.type === "추천" ? "bg-emerald-100 text-emerald-800" :
                                item.type === "중립" ? "bg-slate-100 text-slate-700" : "bg-rose-100 text-rose-800"
                              }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px] font-medium">{item.department}</td>
                            <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">{item.review}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Main Action Button */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => setParsedCSVResult(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleApplyCSVToDashboard}
                      disabled={isParsingCSV}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>ReviewArchiveTab 상태로 저장 및 대시보드 전체에 반영 ({parsedCSVResult.validCount}건)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Success Notification Banner */}
              {csvImportSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-emerald-600 text-white p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-white shrink-0" />
                    <div>
                      <h5 className="font-bold text-sm">파싱 및 대시보드 상태 저장 완료!</h5>
                      <p className="text-xs text-emerald-100 mt-0.5">{csvImportSuccess}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-500">
                    <span className="text-[11px] text-emerald-100 self-center font-bold mr-1">즉시 분석 탭으로 이동:</span>
                    <button
                      onClick={() => setActiveTab("metrics")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      <span>주간 핵심 지표 탭</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("products")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      <span>상품별 현황 탭</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("voc")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <PieChart className="h-3.5 w-3.5" />
                      <span>VOC 카테고리 분석 탭</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-brand-green"
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
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-green hover:bg-brand-green-dark px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
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
          <div className="flex items-center gap-1.5 flex-1 max-w-xl">
            <select
              value={searchTarget}
              onChange={(e) => {
                setSearchTarget(e.target.value as any);
                setVisibleCount(12);
              }}
              className="text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green shrink-0 cursor-pointer hover:bg-slate-100 transition"
            >
              <option value="전체">전체 검색</option>
              <option value="리뷰내용">리뷰 내용</option>
              <option value="상품명">상품명</option>
              <option value="리뷰어">리뷰어 (작성자)</option>
            </select>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={
                  searchTarget === "리뷰내용" ? "리뷰 내용 검색..." :
                  searchTarget === "상품명" ? "상품명 검색..." :
                  searchTarget === "리뷰어" ? "리뷰어 이름 또는 고객#번호 검색..." :
                  "리뷰 내용, 상품명, 리뷰어 검색..."
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(12); // Reset visible count on search
                }}
                className="w-full pl-8 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green bg-white"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
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
                className="text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green"
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
              let activeColorClass = "bg-brand-green text-white border-brand-green";
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

        {/* Row 4: Time Archives with Toggle (Dropdown / Calendar Range) */}
        <div className="space-y-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
              <Calendar className="h-4 w-4 text-brand-green" />
              <span>시점별 아카이브 탐색</span>
            </div>
            
            {/* Toggle tabs for filter mode */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setDateFilterType("dropdown");
                  setVisibleCount(12);
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  dateFilterType === "dropdown"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                드롭다운 방식
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFilterType("calendar");
                  setVisibleCount(12);
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  dateFilterType === "calendar"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                캘린더 범위 지정 (직접 선택)
              </button>
            </div>
          </div>

          {dateFilterType === "dropdown" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Year Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">연도</label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green cursor-pointer"
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
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green cursor-pointer"
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
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green cursor-pointer"
                >
                  <option value="전체">일자 전체</option>
                  {availableDates.days.map(d => (
                    <option key={d} value={d}>{parseInt(d, 10)}일</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                {/* Start Date */}
                <div className="w-full sm:w-auto flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">시작일</label>
                  <input
                    type="date"
                    value={calendarStart}
                    onChange={(e) => {
                      setCalendarStart(e.target.value);
                      setVisibleCount(12);
                    }}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green cursor-pointer text-slate-700"
                  />
                </div>

                {/* Separator */}
                <div className="text-slate-400 text-xs font-bold pb-2.5 hidden sm:block">~</div>

                {/* End Date */}
                <div className="w-full sm:w-auto flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">종료일</label>
                  <input
                    type="date"
                    value={calendarEnd}
                    onChange={(e) => {
                      setCalendarEnd(e.target.value);
                      setVisibleCount(12);
                    }}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-brand-green focus:border-brand-green cursor-pointer text-slate-700"
                  />
                </div>

                {/* Quick Shortcuts */}
                <div className="w-full sm:w-auto pb-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarStart("2026-07-06");
                      setCalendarEnd("2026-07-12");
                      setVisibleCount(12);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    최근 7일
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarStart("2026-06-28");
                      setCalendarEnd("2026-07-12");
                      setVisibleCount(12);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    최근 15일
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarStart("2026-07-01");
                      setCalendarEnd("2026-07-31");
                      setVisibleCount(12);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    7월 전체
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarStart("");
                      setCalendarEnd("");
                      setVisibleCount(12);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  const isHighlighted = highlightTargetId === String(item.id);

                  // Check if this review belongs to the same post (same reviewer, date, and identical multi-product review text) as the previous one
                  const prevItem = index > 0 ? arr[index - 1] : null;
                  const isSamePostAsPrev = Boolean(prevItem && areReviewsSamePost(item, prevItem) && item.review && prevItem.review && item.review === prevItem.review);

                  let typeLabelColor = "bg-brand-green-light text-brand-green-dark ring-brand-green/20";
                  let typeIcon = <ShieldCheck className="h-3 w-3 text-brand-green" />;
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
                        data-review-row={item.id}
                        onClick={() => setExpandedReviewId(isExpanded ? null : item.id)}
                        className={`hover:bg-slate-50/50 transition cursor-pointer select-none ${isExpanded ? "bg-brand-green-light/10" : ""} ${isSamePostAsPrev ? "bg-slate-50/10" : ""} ${isHighlighted ? "ring-2 ring-amber-400 ring-inset" : ""}`}
                      >
                        <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-700 border-r border-slate-50">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span>
                                {item.reviewer ? `${item.reviewer}님의 후기` : `고객#${item.id}님의 후기`}
                              </span>
                              {item.incidentStatus === "처리완료" && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5 text-[9px] font-extrabold shadow-2xs">
                                  🚨 사고접수완료
                                </span>
                              )}
                              {item.incidentStatus === "반려됨" && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold">
                                  사고접수(반려)
                                </span>
                              )}
                              {item.incidentStatus === "접수중" && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold animate-pulse">
                                  ⏳ 사고접수대기
                                </span>
                              )}
                              {item.exposed === false && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-extrabold" title="CX가 비공개 처리로 대응 완료한 리뷰 — 고객에게는 노출되지 않으며 내부 VOC로만 확인 가능">
                                  ✅ CX 조치완료 (비공개 처리)
                                </span>
                              )}
                              {item.image_urls && item.image_urls.length > 0 ? (
                                <div className="inline-flex gap-1 items-center flex-wrap">
                                  {item.image_urls.map((url, imgIdx) => (
                                    <a 
                                      key={imgIdx}
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center h-5 shrink-0 bg-slate-100 hover:bg-brand-green-light text-slate-500 hover:text-brand-green-dark transition text-[10px] font-bold px-1 py-0.5 rounded border border-slate-200"
                                      title={`사진 후기 ${imgIdx + 1} 보기 (새 창)`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      📷 #{imgIdx + 1}
                                    </a>
                                  ))}
                                </div>
                              ) : item.image_url && (
                                <a 
                                  href={item.image_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center shrink-0 text-slate-500 hover:text-brand-green-dark transition hover:scale-110"
                                  title="사진 후기 보기 (새 창)"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📷
                                </a>
                              )}
                            </div>
                            {isSamePostAsPrev && (
                              <span className="text-[10px] text-slate-400 font-semibold italic flex items-center justify-center gap-1 bg-slate-50/50 px-2 py-0.5 rounded-md mt-0.5 border border-slate-100">
                                ↳ <span className="opacity-80">위와 동일한 게시글</span>
                              </span>
                            )}
                          </div>
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
                            {item.image_urls && item.image_urls.length > 0 ? (
                              <div className="flex gap-1 items-center shrink-0">
                                {item.image_urls.map((url, imgIdx) => (
                                  <a 
                                    key={imgIdx}
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center shrink-0 text-slate-500 hover:text-brand-green-dark transition hover:scale-110"
                                    title={`사진 후기 ${imgIdx + 1} 보기 (새 창)`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    📷
                                  </a>
                                ))}
                              </div>
                            ) : item.image_url && (
                              <a 
                                href={item.image_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center shrink-0 text-slate-500 hover:text-brand-green-dark transition hover:scale-110"
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
                                  <a
                                    href={`https://server.honestflower.kr/bloom/reviews/review/${item.id}/change/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                    title="어드민에서 이 리뷰 원본 보기 (새 창)"
                                  >
                                    <ExternalLink className="h-3 w-3" /> 어드민에서 보기
                                  </a>
                                  <div className="h-3 w-px bg-slate-200" />
                                  <span className="text-xs font-bold text-slate-700">
                                    {item.reviewer ? `${item.reviewer}님의 후기` : "익명 고객님의 후기"}
                                  </span>
                                  {item.image_urls && item.image_urls.length > 0 ? (
                                    <>
                                      <div className="h-3 w-px bg-slate-200" />
                                      <span className="text-xs font-bold text-slate-400">사진 첨부:</span>
                                      {item.image_urls.map((url, imgIdx) => (
                                        <a 
                                          key={imgIdx}
                                          href={url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs font-bold text-brand-green-dark hover:text-brand-green hover:underline bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100"
                                          title={`사진 후기 ${imgIdx + 1} 보기 (새 창)`}
                                        >
                                          📷 <span className="text-[11px] font-semibold">#{imgIdx + 1}</span>
                                        </a>
                                      ))}
                                    </>
                                  ) : item.image_url && (
                                    <>
                                      <div className="h-3 w-px bg-slate-200" />
                                      <a 
                                        href={item.image_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-green-dark hover:text-brand-green hover:underline"
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
                                  <span className="text-xs font-bold text-slate-600">{item.rating > 0 ? `(${item.rating}점)` : ""}</span>
                                </div>
                              </div>

                              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs relative">
                                <div className="absolute top-2 right-2 text-[9px] font-bold text-slate-300">
                                  등록일: {item.date}
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed font-medium pl-2 border-l-2 border-brand-green">
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
              const isHighlighted = highlightTargetId === String(item.id);

              // Check if this review belongs to the same post (same reviewer, date, and highly similar content) as the previous one
              const prevItem = index > 0 ? arr[index - 1] : null;
              const isSamePostAsPrev = prevItem && groupKeysMap.get(item.id) === groupKeysMap.get(prevItem.id);

              let typeLabelColor = "bg-brand-green-light text-brand-green-dark ring-brand-green/20";
              let typeIcon = <ShieldCheck className="h-3 w-3 text-brand-green" />;
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
                  data-review-row={item.id}
                  className={`p-4 transition ${isExpanded ? "bg-brand-green-light/10" : "bg-white"} ${isSamePostAsPrev ? "bg-slate-50/5" : ""} ${isHighlighted ? "ring-2 ring-amber-400 ring-inset" : ""}`}
                >
                  <div 
                    onClick={() => setExpandedReviewId(isExpanded ? null : item.id)}
                    className="flex items-start justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-700">
                          {item.reviewer ? `${item.reviewer}님의 후기` : `고객#${item.id}님의 후기`}
                        </span>
                        <span className="text-[10px] text-slate-400">|</span>
                        <span className="text-[10px] text-slate-400">{item.date}</span>
                        {item.image_urls && item.image_urls.length > 0 ? (
                          <>
                            <span className="text-[10px] text-slate-400">|</span>
                            <div className="inline-flex gap-1 items-center flex-wrap">
                              {item.image_urls.map((url, imgIdx) => (
                                <a 
                                  key={imgIdx}
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] bg-slate-100 hover:bg-brand-green-light border border-slate-200 hover:scale-110 active:scale-95 transition inline-flex items-center justify-center shrink-0 px-1 rounded font-bold text-slate-600 hover:text-brand-green-dark"
                                  onClick={(e) => e.stopPropagation()}
                                  title={`사진 후기 ${imgIdx + 1} 보기 (새 창)`}
                                >
                                  📷 #{imgIdx + 1}
                                </a>
                              ))}
                            </div>
                          </>
                        ) : item.image_url && (
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
                        {isSamePostAsPrev && (
                          <>
                            <span className="text-[10px] text-slate-400">|</span>
                            <span className="text-[10px] text-slate-400 font-semibold italic bg-slate-100 px-1 rounded-sm">
                              ↳ 위와 동일
                            </span>
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

                      {item.image_urls && item.image_urls.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-bold">첨부 이미지 ({item.image_urls.length}장):</span>
                          {item.image_urls.map((url, imgIdx) => (
                            <a 
                              key={imgIdx}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green-dark hover:text-brand-green hover:underline bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100"
                              title={`사진 후기 ${imgIdx + 1} 보기 (새 창)`}
                            >
                              📷 #{imgIdx + 1}
                            </a>
                          ))}
                        </div>
                      ) : item.image_url && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">첨부 이미지:</span>
                          <a 
                            href={item.image_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green-dark hover:text-brand-green hover:underline"
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
