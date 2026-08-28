import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  PackageX, Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { parseCSVToDispatchFailure, DispatchFailureParseResult } from "../utils/csvParser";
import SchemaMismatchError from "./SchemaMismatchError";

// SCM(발송/재고) 계열이라는 걸 시각적으로 CS 쪽 위젯들(로즈/시안 계열)과 구분하기 위해 별도 색상 사용.
const DISPATCH_FAILURE_COLOR = "#f97316";

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs space-y-1">
      <p className="font-bold text-slate-800">{row.period}</p>
      <p className="text-slate-600">
        발송불가율 <span className="font-bold" style={{ color: DISPATCH_FAILURE_COLOR }}>{(row.dispatchFailureRate * 100).toFixed(2)}%</span>
      </p>
      <p className="text-slate-400">{row.dispatchFailedQty.toLocaleString()}개 / 총 {row.totalQty.toLocaleString()}개</p>
    </div>
  );
}

function TrendChart({ rows, height = 220 }: { rows: { period: string; totalQty: number; dispatchFailedQty: number; dispatchFailureRate: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
          tick={{ fontSize: 10, fill: "#898781" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="dispatchFailureRate"
          stroke={DISPATCH_FAILURE_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: DISPATCH_FAILURE_COLOR }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DispatchFailureWidget() {
  const {
    dispatchFailureWeekly, importDispatchFailureWeekly,
    dispatchFailureMonthly, importDispatchFailureMonthly,
  } = useReviews();

  const [showCSVModal, setShowCSVModal] = useState(false);
  const [granularity, setGranularity] = useState<"weekly" | "monthly">("weekly");
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [parsedResult, setParsedResult] = useState<DispatchFailureParseResult | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setParsedResult(parseCSVToDispatchFailure(event.target?.result as string, granularity));
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
      setParsedResult(parseCSVToDispatchFailure(csvRawText, granularity));
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  const handleApplyCurrent = () => {
    if (!parsedResult || parsedResult.rows.length === 0) return;
    if (granularity === "weekly") importDispatchFailureWeekly(parsedResult.rows, importMode === "replace");
    else importDispatchFailureMonthly(parsedResult.rows, importMode === "replace");
    setImportSuccessMsg(`발송불가율 ${granularity === "weekly" ? "주간" : "월간"} 데이터 ${parsedResult.validCount}건이 반영되었습니다!`);
    setTimeout(() => {
      setParsedResult(null);
      setShowCSVModal(false);
      setImportSuccessMsg(null);
    }, 2000);
  };

  const latest = useMemo(
    () => dispatchFailureWeekly.length > 0 ? dispatchFailureWeekly[dispatchFailureWeekly.length - 1] : undefined,
    [dispatchFailureWeekly]
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-2">
          <PackageX className="h-5 w-5 text-orange-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">발송불가율 (SCM)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              주별 발송(배송) 이행 실패율 — 2023년 11월 이후 데이터만 제공(추적 시스템 도입 전). 매주 수동 갱신.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCSVModal(!showCSVModal)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Upload className="h-4 w-4" />
          <span>발송불가율 CSV 업로드</span>
        </button>
      </div>

      <AnimatePresence>
        {showCSVModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-orange-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-orange-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-orange-600" />
                  <h4 className="text-xs font-bold text-slate-900">발송불가율 전용 CSV 임포터 (디비버 쿼리 결과)</h4>
                </div>
                <button
                  onClick={() => { setShowCSVModal(false); setParsedResult(null); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGranularity("weekly")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    granularity === "weekly" ? "bg-orange-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  주간(receipt_week)
                </button>
                <button
                  onClick={() => setGranularity("monthly")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    granularity === "monthly" ? "bg-orange-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  월간(receipt_month)
                </button>
              </div>

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
                    isDragging ? "border-orange-500 bg-orange-50/50" : "border-slate-200 bg-slate-50/50 hover:border-orange-400 hover:bg-orange-50/20"
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
                    <div className="rounded-full p-3 bg-orange-100 text-orange-700">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      {granularity === "weekly" ? "주간" : "월간"} 집계 CSV 파일을 드래그하여 놓거나 클릭하여 업로드
                    </p>
                    <p className="text-[11px] text-slate-400">
                      지원 열: {granularity === "weekly" ? "receipt_week" : "receipt_month"}, total_qty, dispatch_failed_qty, dispatch_failure_rate
                    </p>
                  </div>
                </div>
              )}

              {activeImportTab === "paste" && (
                <div className="space-y-3">
                  <textarea
                    rows={5}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder={
                      granularity === "weekly"
                        ? "receipt_week,total_qty,dispatch_failed_qty,dispatch_failure_rate\n2026-01,12500,138,0.0110"
                        : "receipt_month,total_qty,dispatch_failed_qty,dispatch_failure_rate\n2026-01,52000,540,0.0104"
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleTextParse}
                      disabled={isParsingCSV || !csvRawText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>텍스트 파싱 및 검증</span>
                    </button>
                  </div>
                </div>
              )}

              {parsedResult && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        파싱 검증 완료: 총 <span className="text-orange-700 font-extrabold">{parsedResult.validCount}</span>행({granularity === "weekly" ? "주간" : "월간"})
                      </h5>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                      <span>적용 방식:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="dispatchFailureImportMode" checked={importMode === "append"} onChange={() => setImportMode("append")} className="text-orange-600 focus:ring-orange-500" />
                        <span>기존 병합(같은 기간 갱신)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-2">
                        <input type="radio" name="dispatchFailureImportMode" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="text-orange-600 focus:ring-orange-500" />
                        <span>전체 교체</span>
                      </label>
                    </div>
                  </div>

                  {parsedResult.isLikelyWrongFileType ? (
                    <SchemaMismatchError
                      detectedColumns={parsedResult.detectedColumns}
                      guidance={`디비버에서 실행한 ${granularity === "weekly" ? "주간(receipt_week)" : "월간(receipt_month)"} 쿼리 결과 CSV가 맞는지, 그리고 위 토글이 그 쿼리 종류와 일치하는지 확인해주세요.`}
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

                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setParsedResult(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer">취소</button>
                    <button
                      onClick={handleApplyCurrent}
                      disabled={parsedResult.rows.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>반영 ({parsedResult.validCount}건)</span>
                    </button>
                  </div>
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

      {dispatchFailureWeekly.length === 0 ? (
        <div className="text-center py-10">
          <PackageX className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">아직 업로드된 발송불가율 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-4 sm:col-span-1">
              <p className="text-[11px] font-bold text-orange-700">최근 주 발송불가율</p>
              <p className="text-2xl font-black text-orange-950 mt-1">
                {latest ? `${(latest.dispatchFailureRate * 100).toFixed(2)}%` : "-"}
              </p>
              <p className="text-[10px] text-orange-700 mt-1">
                {latest ? `${latest.period} · ${latest.dispatchFailedQty.toLocaleString()}개 / ${latest.totalQty.toLocaleString()}개` : ""}
              </p>
            </div>
            <div className="sm:col-span-2">
              <TrendChart rows={dispatchFailureWeekly} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              2023년 11월 이후 데이터만 제공됩니다(대체발송/부분환불 추적 시스템 도입 전 데이터는 제외). 주 단위로 수동 갱신됩니다.
            </p>
          </div>

          {dispatchFailureMonthly.length > 0 && (
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setShowMonthly(!showMonthly)}
                className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-slate-50/60 transition"
              >
                <span className="text-xs font-bold text-slate-700">월별 추이 (참고용 보조 뷰)</span>
                {showMonthly ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              <AnimatePresence initial={false}>
                {showMonthly && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      <TrendChart rows={dispatchFailureMonthly} height={180} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
