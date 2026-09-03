import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Users, Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  Type,
} from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import {
  parseCSVToNpsResponses, NpsResponsesParseResult, NpsDetractorRow,
  parseNpsSummaryInput, computeNpsRates,
} from "../utils/csvParser";
import SchemaMismatchError from "./SchemaMismatchError";

// 리뷰 데이터(Review)엔 이메일 필드가 아예 없다(rawCustomerId/rawReviewer만 존재) — 그래서 "리뷰
// 미작성" 세그먼트는 이메일이 아니라 이름을 정규화해서 비교하는 근사치일 수밖에 없다. 동명이인/닉네임
// 표기 차이로 오탐(실제로는 리뷰를 남겼는데 "미작성"으로 잘못 뜨는 경우)이 있을 수 있어, 화면에
// 반드시 이 한계를 명시한다.
function normalizeName(name?: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "");
}

function formatWon(n: number): string {
  return `${n.toLocaleString()}원`;
}

type ViewMode = "highValue" | "noReview";
type ImportMode = "csv" | "summaryText";

export default function NpsWatchlistWidget() {
  const {
    npsSummary, importNpsSummary,
    npsDetractorRows, importNpsDetractorRows,
    npsContactedIds, toggleNpsContact,
    npsWatchlistThreshold, setNpsWatchlistThreshold,
    reviews,
  } = useReviews();

  const [viewMode, setViewMode] = useState<ViewMode>("highValue");
  const [showModal, setShowModal] = useState(false);
  // CSV 업로드가 기본 — ARES 내보내기를 사전 필터링 없이 그대로 올려도 파서가 알아서 promoter/
  // passive/detractor를 나눠준다(요약 갱신 + Detractor 워치리스트 추출을 한 번에). "요약 문구만
  // 빠르게"는 CSV 없이 화면에 보이는 요약 문장만 눈으로 복사해 누적 NPS 카드만 급히 갱신하고 싶을
  // 때 쓰는 보조 경로 — Detractor 워치리스트는 갱신되지 않는다.
  const [importMode, setImportMode] = useState<ImportMode>("csv");
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [parsedResult, setParsedResult] = useState<NpsResponsesParseResult | null>(null);
  const [applySummary, setApplySummary] = useState(true);
  const [summaryText, setSummaryText] = useState("");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryPreview, setSummaryPreview] = useState<ReturnType<typeof parseNpsSummaryInput>["summary"] | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModalState = () => {
    setParsedResult(null);
    setCsvRawText("");
    setSummaryText("");
    setSummaryPreview(null);
    setSummaryError(null);
  };

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setParsedResult(parseCSVToNpsResponses(event.target?.result as string));
      } catch (err) {
        alert("CSV 파싱 중 오류가 발생했습니다: " + (err as Error).message);
      } finally {
        setIsParsingCSV(false);
      }
    };
    reader.onerror = () => { alert("파일을 읽을 수 없습니다."); setIsParsingCSV(false); };
    reader.readAsText(file, "utf-8");
  };

  const handleTextParse = () => {
    if (!csvRawText.trim()) return;
    setIsParsingCSV(true);
    try {
      setParsedResult(parseCSVToNpsResponses(csvRawText));
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  const handleApplyCsv = () => {
    if (!parsedResult) return;
    importNpsDetractorRows(parsedResult.detractorRows);
    if (applySummary) importNpsSummary(parsedResult.summary);
    setImportSuccessMsg(
      applySummary
        ? `NPS 응답 ${parsedResult.validCount}건 반영 — 누적 NPS 요약과 Detractor ${parsedResult.detractorRows.length}건이 함께 갱신되었습니다!`
        : `Detractor ${parsedResult.detractorRows.length}건이 반영되었습니다(누적 NPS 요약은 갱신하지 않음).`
    );
    setTimeout(() => {
      resetModalState();
      setShowModal(false);
      setImportSuccessMsg(null);
    }, 2200);
  };

  const handleSummaryParse = () => {
    if (!summaryText.trim()) return;
    setSummaryError(null);
    setSummaryPreview(null);
    const result = parseNpsSummaryInput(summaryText);
    if (result.summary) setSummaryPreview(result.summary);
    else setSummaryError(result.error || "값을 인식하지 못했습니다.");
  };

  const handleApplySummary = () => {
    if (!summaryPreview) return;
    importNpsSummary(summaryPreview);
    setImportSuccessMsg(`누적 NPS 요약치가 반영되었습니다! (total ${summaryPreview.total.toLocaleString()}건)`);
    setTimeout(() => {
      resetModalState();
      setShowModal(false);
      setImportSuccessMsg(null);
    }, 1800);
  };

  // 우선순위 2 — 구매횟수 임계값 이상인 Detractor를 총구매비용 내림차순으로.
  const highValueList = useMemo(() => {
    return npsDetractorRows
      .filter(r => r.purchaseCount >= npsWatchlistThreshold)
      .sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount);
  }, [npsDetractorRows, npsWatchlistThreshold]);

  // 우선순위 5 — 리뷰 미작성 + NPS 저점수 교차. 이메일 조인 불가 → 이름 정규화 근사 매칭.
  const reviewedNameSet = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach(r => {
      const n1 = normalizeName(r.reviewer);
      const n2 = normalizeName(r.rawReviewer);
      if (n1) set.add(n1);
      if (n2) set.add(n2);
    });
    return set;
  }, [reviews]);

  const noReviewList = useMemo(() => {
    return npsDetractorRows
      .filter(r => {
        const n = normalizeName(r.customerName);
        return n.length > 0 && !reviewedNameSet.has(n);
      })
      .sort((a, b) => a.score - b.score || b.totalPurchaseAmount - a.totalPurchaseAmount);
  }, [npsDetractorRows, reviewedNameSet]);

  const activeList = viewMode === "highValue" ? highValueList : noReviewList;
  const previewRates = parsedResult ? computeNpsRates(parsedResult.summary) : null;
  const summaryPreviewRates = summaryPreview ? computeNpsRates(summaryPreview) : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-2">
          <Users className="h-5 w-5 text-rose-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">NPS Detractor 이탈 위험군 추적</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              NPS 응답 CSV를 사전 필터링 없이 그대로 올리면 누적 NPS 요약과 Detractor(0~6점) 워치리스트가 한 번에 갱신됩니다.
              {npsSummary.asOf && <span> 현재 누적 NPS 기준일: {npsSummary.asOf}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(!showModal)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Upload className="h-4 w-4" />
          <span>NPS 응답 업데이트</span>
        </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-rose-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-slate-900">NPS 응답 업데이트</h4>
                </div>
                <button
                  onClick={() => { setShowModal(false); resetModalState(); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportMode("csv")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    importMode === "csv" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  NPS 응답 CSV 업로드
                </button>
                <button
                  onClick={() => setImportMode("summaryText")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    importMode === "summaryText" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  요약 문구만 빠르게 (누적 NPS만 갱신)
                </button>
              </div>

              {importMode === "csv" && (
                <>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ARES III → 서베이 → NPS의 <span className="font-bold">"내보내기"를 사전 필터링 없이 그대로</span> 올려주세요. 이 파서가 점수(0~10)를 직접 세어 promoter/passive/detractor를 나누므로 미리 걸러서 올릴 필요가 없습니다. 지원 열: ID(선택), 고객명, 이메일, 점수, 구매횟수, 총구매비용, 최근구매상품, 피드백, CREATED AT.
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveImportTab("file")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeImportTab === "file" ? "bg-slate-800 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      파일 업로드 (.csv)
                    </button>
                    <button
                      onClick={() => setActiveImportTab("paste")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeImportTab === "paste" ? "bg-slate-800 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      CSV 텍스트 직접 붙여넣기
                    </button>
                  </div>

                  {activeImportTab === "file" && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files?.[0]) handleFileProcess(e.dataTransfer.files[0]);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                        isDragging ? "border-rose-500 bg-rose-50/50" : "border-slate-200 bg-slate-50/50 hover:border-rose-400 hover:bg-rose-50/20"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) handleFileProcess(e.target.files[0]); }}
                      />
                      <div className="flex flex-col items-center gap-2">
                        <div className="rounded-full p-3 bg-rose-100 text-rose-700">
                          <Upload className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">CSV 파일을 드래그하여 놓거나 클릭하여 업로드</p>
                      </div>
                    </div>
                  )}

                  {activeImportTab === "paste" && (
                    <div className="space-y-3">
                      <textarea
                        rows={5}
                        value={csvRawText}
                        onChange={(e) => setCsvRawText(e.target.value)}
                        placeholder={"id,고객명,이메일,점수,구매횟수,총구매비용,최근구매상품,피드백,created at\n1,홍길동,hong@example.com,3,8,1250000,테디베어 해바라기,\"꽃이 자주 시들어와요\",2026-08-20\n2,김영희,kim@example.com,9,10,900000,장미 부케,\"아주 좋아요\",2026-08-21"}
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

                  {parsedResult && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-5 space-y-4">
                      <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <h5 className="text-sm font-bold text-slate-900">
                          파싱 검증 완료: 총 <span className="text-rose-700 font-extrabold">{parsedResult.validCount}</span>건 응답
                        </h5>
                      </div>

                      {parsedResult.isLikelyWrongFileType ? (
                        <SchemaMismatchError
                          detectedColumns={parsedResult.detectedColumns}
                          guidance="ARES III NPS 응답 내보내기 CSV가 맞는지 확인해주세요."
                        />
                      ) : parsedResult.missingCriticalColumns.length > 0 && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-900 leading-relaxed">
                            <span className="font-bold">다음 필수 컬럼을 인식하지 못했습니다: {parsedResult.missingCriticalColumns.join(", ")}.</span>{" "}
                            CSV 헤더명을 확인해주세요.
                          </p>
                        </div>
                      )}

                      {previewRates && (
                        <div className="grid grid-cols-4 gap-1.5 text-center bg-white rounded-xl border border-rose-100 p-3">
                          <div><p className="text-[9px] text-slate-400 font-bold">NPS</p><p className="text-sm font-black text-slate-800">{previewRates.score}</p></div>
                          <div><p className="text-[9px] text-slate-400 font-bold">Promoter</p><p className="text-sm font-black text-slate-800">{parsedResult.summary.promoters}</p></div>
                          <div><p className="text-[9px] text-slate-400 font-bold">Passive</p><p className="text-sm font-black text-slate-800">{parsedResult.summary.passives}</p></div>
                          <div><p className="text-[9px] text-slate-400 font-bold">Detractor</p><p className="text-sm font-black text-rose-600">{parsedResult.summary.detractors}</p></div>
                        </div>
                      )}

                      <label className="flex items-start gap-2 text-xs text-slate-700 bg-white rounded-xl border border-rose-100 p-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applySummary}
                          onChange={(e) => setApplySummary(e.target.checked)}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <span>
                          <span className="font-bold">이 CSV는 전체 응답입니다</span> — 위 promoter/passive/detractor 건수로 누적 NPS 요약 카드도 함께 갱신합니다.
                          이미 0~6점만 걸러서 올리신 파일이라면 체크를 해제해주세요(그러면 Detractor 워치리스트만 갱신되고 누적 NPS는 그대로 유지됩니다).
                        </span>
                      </label>

                      <div className="flex items-center justify-between pt-2">
                        <button onClick={() => setParsedResult(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer">취소</button>
                        <button
                          onClick={handleApplyCsv}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>반영</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {importMode === "summaryText" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                    <Type className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>CSV 없이 ARES 화면 상단의 요약 문구만 복붙해 누적 NPS 카드만 빠르게 갱신합니다. Detractor 워치리스트는 갱신되지 않습니다.</span>
                  </p>
                  <textarea
                    rows={3}
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    placeholder="NPS 78 (total: 34,211 / promoters: 28,867 / detractors: 2,164 / passives: 3,180)"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSummaryParse}
                      disabled={!summaryText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>확인</span>
                    </button>
                  </div>

                  {summaryError && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 leading-relaxed">{summaryError}</p>
                    </div>
                  )}

                  {summaryPreview && summaryPreviewRates && (
                    <div className="rounded-xl border border-rose-100 bg-rose-50/20 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-slate-700">NPS {summaryPreviewRates.score} · total {summaryPreview.total.toLocaleString()}건</p>
                      <div className="flex justify-end">
                        <button
                          onClick={handleApplySummary}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 text-[11px] font-bold transition cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>반영</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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

      {npsDetractorRows.length === 0 ? (
        <div className="text-center py-10">
          <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">아직 업로드된 NPS Detractor 응답이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("highValue")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === "highValue" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                고액구매 이탈위험 ({highValueList.length})
              </button>
              <button
                onClick={() => setViewMode("noReview")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === "noReview" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                리뷰 미작성 세그먼트 ({noReviewList.length})
              </button>
            </div>

            {viewMode === "highValue" && (
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                구매횟수 임계값
                <input
                  type="number"
                  min={0}
                  value={npsWatchlistThreshold}
                  onChange={(e) => setNpsWatchlistThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                />
                회 이상
              </label>
            )}
          </div>

          {viewMode === "noReview" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-relaxed">
                리뷰 데이터에 이메일 필드가 없어(rawCustomerId만 존재) <span className="font-bold">고객명 정규화 일치</span>로만 판별한 근사치입니다. 동명이인·닉네임 표기 차이로 오탐이 있을 수 있으니 참고용으로만 활용해주세요.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">고객</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">점수</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">구매횟수</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-500">총구매비용</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">최근구매상품</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">피드백</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">응답일</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">컨택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeList.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">조건에 맞는 대상이 없습니다.</td></tr>
                ) : activeList.map((row: NpsDetractorRow) => {
                  const isContacted = npsContactedIds.has(row.id);
                  return (
                    <tr key={row.id} className={isContacted ? "bg-slate-50/40" : ""}>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-800">{row.customerName || "이름 없음"}</p>
                        <p className="text-[10px] text-slate-400">{row.email || "-"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-rose-600">{row.score}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">{row.purchaseCount}회</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatWon(row.totalPurchaseAmount)}</td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[140px] truncate">{row.lastPurchaseProduct || "-"}</td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-[220px]">
                        <span className="line-clamp-2">{row.feedback || "-"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-400">{row.respondedAt || "-"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => toggleNpsContact(row.id)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition cursor-pointer ${
                            isContacted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {isContacted && <CheckCircle2 className="h-3 w-3" />}
                          {isContacted ? "연락완료" : "미완료"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
