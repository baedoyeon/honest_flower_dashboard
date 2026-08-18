import { useMemo, useState, useRef } from "react";
import { 
  ShieldAlert, 
  AlertTriangle, 
  HelpCircle, 
  FileText, 
  Search, 
  ShieldCheck, 
  Clock, 
  ExternalLink, 
  Upload,
  Download,
  CheckCircle2,
  Loader2,
  X,
  FileSpreadsheet,
  Coins,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews } from "../context/ReviewsContext";
import { parseCSVToIncidents, IncidentParseResult } from "../utils/csvParser";

export default function AccidentIncidentsTab() {
  const { weeklyIncidents, incidents, importIncidents, isSyncing, weekFilter, setWeekFilter, weekRanges } = useReviews();

  // Filter and Search State
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<"전체" | "처리완료" | "반려됨" | "접수중">("전체");
  const [selectedCauseFilter, setSelectedCauseFilter] = useState<string>("전체");
  const [incidentSearchTerm, setIncidentSearchTerm] = useState("");
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<{ url: string; title: string } | null>(null);

  // CSV Importer Modal / Panel State
  const [showCSVModal, setShowCSVModal] = useState<boolean>(false);
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState<string>("");
  const [isParsingCSV, setIsParsingCSV] = useState<boolean>(false);
  const [parsedResult, setParsedResult] = useState<IncidentParseResult | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("replace");
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active incidents list (weekly by default)
  const activeIncidentList = weeklyIncidents;

  // Accident KPI Metrics
  const accidentMetrics = useMemo(() => {
    const total = activeIncidentList.length;
    const approved = activeIncidentList.filter(r => r.incidentStatus === "처리완료").length;
    const rejected = activeIncidentList.filter(r => r.incidentStatus === "반려됨").length;
    const pending = activeIncidentList.filter(r => r.incidentStatus === "접수중").length;

    let totalRefund = 0;
    activeIncidentList.forEach(r => {
      if (r.refundAmount) totalRefund += r.refundAmount;
    });

    // Breakdown by accident detail type
    const detailTypeCounts: Record<string, number> = {};
    activeIncidentList.forEach(r => {
      const typeKey = r.accidentDetail || r.accidentType || "기타 불만";
      detailTypeCounts[typeKey] = (detailTypeCounts[typeKey] || 0) + 1;
    });

    const chartData = Object.entries(detailTypeCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    return { total, approved, rejected, pending, totalRefund, chartData };
  }, [activeIncidentList]);

  // Unique cause types for filter
  const causeOptions = useMemo(() => {
    const set = new Set<string>();
    activeIncidentList.forEach(item => {
      if (item.accidentDetail) set.add(item.accidentDetail);
      else if (item.accidentType) set.add(item.accidentType);
    });
    return ["전체", ...Array.from(set)];
  }, [activeIncidentList]);

  // Filtered accident list by status, cause, and search
  const filteredAccidents = useMemo(() => {
    return activeIncidentList.filter(item => {
      if (incidentStatusFilter !== "전체" && item.incidentStatus !== incidentStatusFilter) return false;
      
      const itemCause = item.accidentDetail || item.accidentType || "기타 불만";
      if (selectedCauseFilter !== "전체" && itemCause !== selectedCauseFilter) return false;

      if (incidentSearchTerm.trim()) {
        const term = incidentSearchTerm.toLowerCase();
        const matchProduct = item.product.toLowerCase().includes(term);
        const matchReviewer = (item.reviewer || item.customerName || "").toLowerCase().includes(term);
        const matchText = (item.claimText || "").toLowerCase().includes(term);
        const matchType = itemCause.toLowerCase().includes(term);
        const matchId = (item.id || "").toLowerCase().includes(term);
        const matchOrder = (item.orderNumber || "").toLowerCase().includes(term);
        return matchProduct || matchReviewer || matchText || matchType || matchId || matchOrder;
      }
      return true;
    });
  }, [activeIncidentList, incidentStatusFilter, selectedCauseFilter, incidentSearchTerm]);

  // Export filtered incidents to CSV
  const handleExportCSV = () => {
    const headers = ["접수번호", "접수일자", "상품명", "고객명", "처리상태", "사고유형", "상세유형", "고객접수내용", "환불금액", "CS조치내용", "증빙사진URL"];
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [headers.join(",")];
    filteredAccidents.forEach(item => {
      rows.push([
        escapeCSV(item.id),
        escapeCSV(item.date),
        escapeCSV(item.product),
        escapeCSV(item.reviewer || item.customerName),
        escapeCSV(item.incidentStatus),
        escapeCSV(item.accidentType),
        escapeCSV(item.accidentDetail),
        escapeCSV(item.claimText),
        escapeCSV(item.refundAmount || 0),
        escapeCSV(item.csResponse || ""),
        escapeCSV(item.image_url || "")
      ].join(","));
    });

    const csvContent = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.download = `honestflower_incidents_export_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Process File CSV
  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCSVToIncidents(text);
        setParsedResult(result);
      } catch (err) {
        console.error("CS CSV Parsing Error:", err);
        alert("CSV 파싱 중 오류가 발생했습니다: " + (err as Error).message);
      } finally {
        setIsParsingCSV(false);
      }
    };
    reader.onerror = () => {
      alert("파일을 읽을 수 없습니다.");
      setIsParsingCSV(false);
    };
    reader.readAsText(file, "utf-8");
  };

  // Process Text CSV
  const handleTextParse = () => {
    if (!csvRawText.trim()) return;
    setIsParsingCSV(true);
    try {
      const result = parseCSVToIncidents(csvRawText);
      setParsedResult(result);
    } catch (err) {
      console.error("CS CSV Text Parse Error:", err);
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  // Apply CSV Incidents to State
  const handleApplyIncidents = async () => {
    if (!parsedResult || parsedResult.incidents.length === 0) return;
    try {
      await importIncidents(parsedResult.incidents, importMode === "replace");
      setImportSuccessMsg(`사고접수 데이터 ${parsedResult.validCount}건이 성공적으로 반영되었습니다! (사진 리뷰 데이터에 영향 없음)`);
      setTimeout(() => {
        setParsedResult(null);
        setShowCSVModal(false);
        setImportSuccessMsg(null);
      }, 2000);
    } catch (err) {
      console.error("Apply Incidents Error:", err);
      alert("사고접수 데이터 적용 중 오류: " + (err as Error).message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Top Banner */}
      <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/80 via-white to-amber-50/50 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-600 p-3 text-white shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                사고접수 현황 & CS/품질 처리 허브
                <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-200">
                  CS Incident Entity (독립 객체)
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                사진 후기와 완전히 분리된 전용 사고접수 파이프라인으로, 고객 클레임 접수 및 환불·보상 내역을 독립 관리합니다. (총 {incidents.length}건 데이터 보유)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCSVModal(!showCSVModal)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>사고접수 CSV 업로드</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>CSV 내보내기 ({filteredAccidents.length}건)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Period Selector & Active Scope Status Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-2 text-rose-600">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800">
                조회 기간: {weekFilter === "this" ? weekRanges.thisWeek.label : weekFilter === "last" ? weekRanges.lastWeek.label : "전체 기간 (전체 데이터)"}
              </span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                해당 기간 사고접수 {activeIncidentList.length}건
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              승인(처리완료) {accidentMetrics.approved}건 · 반려(미인정) {accidentMetrics.rejected}건 · 검수대기(접수중) {accidentMetrics.pending}건
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1 self-start md:self-auto border border-slate-200/50">
          <button
            onClick={() => setWeekFilter("this")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              weekFilter === "this"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {weekRanges.thisWeek.label}
          </button>
          <button
            onClick={() => setWeekFilter("last")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              weekFilter === "last"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {weekRanges.lastWeek.label}
          </button>
          <button
            onClick={() => setWeekFilter("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              weekFilter === "all"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            전체 기간 ({incidents.length}건)
          </button>
        </div>
      </div>

      {/* CSV Importer Modal / Expandable Box */}
      <AnimatePresence>
        {showCSVModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-rose-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    CS 사고접수 전용 CSV 데이터 임포터
                  </h4>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    사진 리뷰 데이터 보존 보장
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowCSVModal(false);
                    setParsedResult(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveImportTab("file")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeImportTab === "file" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  파일 업로드 (.csv)
                </button>
                <button
                  onClick={() => setActiveImportTab("paste")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeImportTab === "paste" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  CSV 텍스트 직접 붙여넣기
                </button>
              </div>

              {/* File Dropzone */}
              {activeImportTab === "file" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileProcess(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                    isDragging ? "border-rose-500 bg-rose-50/50" : "border-slate-200 hover:border-rose-400 bg-slate-50/50 hover:bg-rose-50/20"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileProcess(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-rose-100 p-3 text-rose-600">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      사고접수 CSV 파일을 드래그하여 놓거나 클릭하여 업로드
                    </p>
                    <p className="text-[11px] text-slate-400">
                      지원 열: 접수번호, 접수시간, 상품명, 고객명, 처리상태, 사고유형, 상세유형, 사고설명, 환불금액 등
                    </p>
                  </div>
                </div>
              )}

              {/* Paste Text Area */}
              {activeImportTab === "paste" && (
                <div className="space-y-3">
                  <textarea
                    rows={5}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder="접수번호,접수일,상품명,고객명,상태,사고유형,상세유형,사고설명,환불금액&#10;INC-001,2026.06.25,자리공,김*진,처리완료,품질 불량,꺾임/파손,가지가 부러져 왔습니다,18500"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleTextParse}
                      disabled={isParsingCSV || !csvRawText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>텍스트 파싱 및 검증</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedResult && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        파싱 검증 완료: 총 <span className="text-rose-600 font-extrabold">{parsedResult.validCount}</span>건 사고접수
                      </h5>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                      <span>적용 방식:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="incidentImportMode"
                          checked={importMode === "replace"}
                          onChange={() => setImportMode("replace")}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span>전체 교체 (Replace)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="incidentImportMode"
                          checked={importMode === "append"}
                          onChange={() => setImportMode("append")}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <span>기존 병합 (Append)</span>
                      </label>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">총 건수</span>
                      <span className="text-sm font-bold text-slate-900">{parsedResult.validCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">처리완료 (승인)</span>
                      <span className="text-sm font-bold text-emerald-950">{parsedResult.approvedCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 border border-amber-100">
                      <span className="text-[10px] text-amber-700 font-bold block uppercase">반려 / 접수중</span>
                      <span className="text-sm font-bold text-amber-950">{parsedResult.rejectedCount + parsedResult.pendingCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-purple-50 p-3 border border-purple-100">
                      <span className="text-[10px] text-purple-700 font-bold block uppercase">총 환불 금액</span>
                      <span className="text-sm font-bold text-purple-950">{parsedResult.totalRefundAmount.toLocaleString()} 원</span>
                    </div>
                  </div>

                  {/* Preview Rows */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">접수번호</th>
                          <th className="py-2 px-3">접수일</th>
                          <th className="py-2 px-3">상품명</th>
                          <th className="py-2 px-3">고객명</th>
                          <th className="py-2 px-3">처리상태</th>
                          <th className="py-2 px-3">상세유형</th>
                          <th className="py-2 px-3">환불금액</th>
                          <th className="py-2 px-3">사고설명</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedResult.incidents.slice(0, 5).map((inc) => (
                          <tr key={inc.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-500 font-bold">{inc.id}</td>
                            <td className="py-2 px-3 text-slate-700">{inc.date}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{inc.product}</td>
                            <td className="py-2 px-3 text-slate-600">{inc.reviewer || inc.customerName}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                inc.incidentStatus === "처리완료" ? "bg-emerald-100 text-emerald-800" :
                                inc.incidentStatus === "반려됨" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800"
                              }`}>
                                {inc.incidentStatus}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-rose-700 font-medium">{inc.accidentDetail}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {inc.refundAmount ? `${inc.refundAmount.toLocaleString()}원` : "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate">{inc.claimText}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setParsedResult(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleApplyIncidents}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>사고접수 대시보드에 즉시 반영 ({parsedResult.validCount}건)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {importSuccessMsg && (
                <div className="rounded-2xl bg-emerald-600 text-white p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-bold">{importSuccessMsg}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 사고접수 KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Incidents */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">총 사고접수 건수</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{accidentMetrics.total}건</h3>
            <p className="text-[10px] text-slate-400 mt-1">CS 및 웹폼 수집 사고 데이터</p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        {/* Approved / 처리완료 */}
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800">사고 승인 (처리완료)</p>
            <h3 className="text-2xl font-black text-emerald-950 mt-1">{accidentMetrics.approved}건</h3>
            <p className="text-[10px] text-emerald-700 mt-1 font-bold">
              총 환불: {accidentMetrics.totalRefund.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        {/* Rejected / 반려됨 */}
        <div className="rounded-3xl border border-amber-200 bg-amber-50/30 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800">사고 미인정 (반려됨)</p>
            <h3 className="text-2xl font-black text-amber-950 mt-1">{accidentMetrics.rejected}건</h3>
            <p className="text-[10px] text-amber-700 mt-1">생물 특성 안내 및 반려 처리</p>
          </div>
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <HelpCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Pending / 접수중 */}
        <div className="rounded-3xl border border-blue-200 bg-blue-50/30 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-800">검수 대기 (접수중)</p>
            <h3 className="text-2xl font-black text-blue-950 mt-1">{accidentMetrics.pending}건</h3>
            <p className="text-[10px] text-blue-700 mt-1">실시간 CS 확인 대기 항목</p>
          </div>
          <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Accident Detail Type Cause Distribution */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              사고 세부 원인(상세 유형)별 정밀 분포
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              `상세 유형` 데이터(물내림/시듦, 꺾임/파손, 꽃잎 탈락, 갈변, 구성 누락 등) 기준 발생 빈도 분석입니다.
            </p>
          </div>
          {accidentMetrics.chartData.length > 0 && (
            <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-xl">
              최다 원인: {accidentMetrics.chartData[0]?.name} ({accidentMetrics.chartData[0]?.count}건)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {accidentMetrics.chartData.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedCauseFilter(selectedCauseFilter === item.name ? "전체" : item.name)}
              className={`p-4 rounded-2xl border text-left transition cursor-pointer space-y-2 ${
                selectedCauseFilter === item.name ? "bg-rose-50 border-rose-300 ring-2 ring-rose-500" : "bg-slate-50 border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">{item.name}</span>
                <span className="text-xs font-black text-rose-600 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {item.count}건
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (item.count / (accidentMetrics.total || 1)) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right">
                전체 사고의 {((item.count / (accidentMetrics.total || 1)) * 100).toFixed(1)}% 비중
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Accident Cases Management List Table */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              사고접수 상세 내역 및 CS 처리 결과 ({filteredAccidents.length}건)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              고객 입력 사고 설명, 환불 보상액, CS 조치 답변 내역을 세부 모니터링합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Status Buttons */}
            {(["전체", "처리완료", "반려됨", "접수중"] as const).map(st => (
              <button
                key={st}
                onClick={() => setIncidentStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                  incidentStatusFilter === st
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}

            {/* Cause Dropdown Filter */}
            <select
              value={selectedCauseFilter}
              onChange={(e) => setSelectedCauseFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            >
              {causeOptions.map(c => (
                <option key={c} value={c}>{c === "전체" ? "전체 원인" : c}</option>
              ))}
            </select>

            {/* Search Bar */}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="상품명/고객명/원인/번호..."
                value={incidentSearchTerm}
                onChange={(e) => setIncidentSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-rose-500 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Incident Cards */}
        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
          {filteredAccidents.length > 0 ? (
            filteredAccidents.map((item) => {
              let statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
              let statusText = "처리완료 (승인)";
              if (item.incidentStatus === "반려됨") {
                statusBadgeClass = "bg-slate-100 text-slate-700 border-slate-200";
                statusText = "반려됨 (사고미인정)";
              } else if (item.incidentStatus === "접수중") {
                statusBadgeClass = "bg-amber-100 text-amber-800 border-amber-200 animate-pulse";
                statusText = "접수중 (검수대기)";
              }

              return (
                <div key={item.id} className="p-4 rounded-2xl border border-slate-100 hover:border-slate-300 bg-slate-50/40 transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                        {item.id}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold border ${statusBadgeClass}`}>
                        {statusText}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {item.product}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        | {item.reviewer || item.customerName} ({item.date})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      {item.refundAmount ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                          <Coins className="h-3 w-3 text-purple-600" />
                          환불: {item.refundAmount.toLocaleString()}원
                        </span>
                      ) : null}

                      {item.accidentDetail || item.accidentType ? (
                        <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-md">
                          원인: {item.accidentDetail || item.accidentType}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Customer Claim Text Box */}
                  <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                    <p className="text-[11px] font-bold text-slate-500">고객 입력 사고 내용:</p>
                    <p className="text-xs text-slate-700 leading-relaxed italic">
                      &ldquo;{item.claimText}&rdquo;
                    </p>
                  </div>

                  {/* CS Response / Action Box */}
                  {item.csResponse && (
                    <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-900 mr-1">CS 처리 내용:</span>
                        <span className="text-emerald-800">{item.csResponse}</span>
                      </div>
                    </div>
                  )}

                  {/* Evidence Photo Link */}
                  {item.image_url && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedPhotoPreview({ url: item.image_url!, title: `${item.product} 사고 증빙 사진 (${item.id})` })}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:underline bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg cursor-pointer transition"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>사고 증빙 사진 보기</span>
                      </button>
                      <a 
                        href={item.image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-400 hover:text-indigo-600 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>새 탭에서 열기</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-xs text-slate-400">
              해당 조건에 일치하는 사고접수 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Photo Preview Lightbox Modal */}
      <AnimatePresence>
        {selectedPhotoPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs"
            onClick={() => setSelectedPhotoPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full rounded-3xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900">{selectedPhotoPreview.title}</h4>
                <button
                  onClick={() => setSelectedPhotoPreview(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl bg-slate-100 max-h-[70vh] flex items-center justify-center">
                <img
                  src={selectedPhotoPreview.url}
                  alt="사고 증빙"
                  className="max-h-[65vh] w-auto object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
