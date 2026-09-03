import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  TrendingDown, Minus,
} from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { parseCSVToNpsTrend, NpsTrendParseResult } from "../utils/csvParser";
import SchemaMismatchError from "./SchemaMismatchError";

const NPS_TREND_COLOR = "#6366f1";

// ClaimCostTab의 "전년동월 대비 없으면 직전월 대비로 폴백" 컨벤션을 그대로 따른다 — period가
// "YYYY-MM"이든 "YYYY-WW"든 첫 "-" 앞을 연도로 보고 동일한 로직을 적용할 수 있다.
function splitYearAndRest(period: string): { year: string; rest: string } | null {
  const idx = period.indexOf("-");
  if (idx === -1) return null;
  return { year: period.slice(0, idx), rest: period.slice(idx + 1) };
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-3 text-xs space-y-1">
      <p className="font-bold text-slate-800">{row.period}</p>
      <p className="text-slate-600">
        NPS <span className="font-bold" style={{ color: NPS_TREND_COLOR }}>{row.score}</span>
      </p>
      {typeof row.total === "number" && <p className="text-slate-400">응답 {row.total.toLocaleString()}건</p>}
    </div>
  );
}

export default function NpsTrendWidget() {
  const { npsTrend, importNpsTrend } = useReviews();

  const [showModal, setShowModal] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [parsedResult, setParsedResult] = useState<NpsTrendParseResult | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setParsedResult(parseCSVToNpsTrend(event.target?.result as string));
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
      setParsedResult(parseCSVToNpsTrend(csvRawText));
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  const handleApply = () => {
    if (!parsedResult || parsedResult.rows.length === 0) return;
    importNpsTrend(parsedResult.rows, importMode === "replace");
    setImportSuccessMsg(`NPS 추이 데이터 ${parsedResult.validCount}건이 반영되었습니다!`);
    setTimeout(() => {
      setParsedResult(null);
      setCsvRawText("");
      setShowModal(false);
      setImportSuccessMsg(null);
    }, 2000);
  };

  const latest = npsTrend.length > 0 ? npsTrend[npsTrend.length - 1] : undefined;

  const comparison = useMemo(() => {
    if (!latest) return null;
    const parts = splitYearAndRest(latest.period);
    let base = undefined as typeof latest | undefined;
    let label = "직전기간 대비";

    if (parts) {
      const priorYear = (parseInt(parts.year, 10) - 1).toString();
      base = npsTrend.find(p => p.period === `${priorYear}-${parts.rest}`);
      if (base) label = "전년동기 대비";
    }
    if (!base && npsTrend.length >= 2) {
      base = npsTrend[npsTrend.length - 2];
      label = "직전기간 대비";
    }
    if (!base) return null;

    const diff = latest.score - base.score;
    return { label, diff, baseScore: base.score };
  }, [latest, npsTrend]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">NPS 스코어 추이</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">기간별로 이미 집계된 NPS 스코어 하나만 업로드합니다(원본 응답 불필요).</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(!showModal)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Upload className="h-4 w-4" />
          <span>NPS 추이 CSV 업로드</span>
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
            <div className="rounded-2xl border border-indigo-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900">NPS 추이(기간별 집계) CSV 임포터</h4>
                </div>
                <button
                  onClick={() => { setShowModal(false); setParsedResult(null); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
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
                    isDragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:bg-indigo-50/20"
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
                    <div className="rounded-full p-3 bg-indigo-100 text-indigo-700">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">월별/주별 집계 CSV 파일을 드래그하여 놓거나 클릭하여 업로드</p>
                    <p className="text-[11px] text-slate-400">지원 열: period, score, total(선택)</p>
                  </div>
                </div>
              )}

              {activeImportTab === "paste" && (
                <div className="space-y-3">
                  <textarea
                    rows={5}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder={"period,score,total\n2026-06,74,5200\n2026-07,76,5400\n2026-08,78,5600"}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleTextParse}
                      disabled={isParsingCSV || !csvRawText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>텍스트 파싱 및 검증</span>
                    </button>
                  </div>
                </div>
              )}

              {parsedResult && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        파싱 검증 완료: 총 <span className="text-indigo-700 font-extrabold">{parsedResult.validCount}</span>행
                      </h5>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                      <span>적용 방식:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="npsTrendImportMode" checked={importMode === "append"} onChange={() => setImportMode("append")} className="text-indigo-600 focus:ring-indigo-500" />
                        <span>기존 병합(같은 기간 갱신)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-2">
                        <input type="radio" name="npsTrendImportMode" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="text-indigo-600 focus:ring-indigo-500" />
                        <span>전체 교체</span>
                      </label>
                    </div>
                  </div>

                  {parsedResult.isLikelyWrongFileType ? (
                    <SchemaMismatchError
                      detectedColumns={parsedResult.detectedColumns}
                      guidance="period, score 컬럼을 가진 기간별 집계 CSV가 맞는지 확인해주세요."
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
                      onClick={handleApply}
                      disabled={parsedResult.rows.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
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

      {npsTrend.length === 0 ? (
        <div className="text-center py-10">
          <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">아직 업로드된 NPS 추이 데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 sm:col-span-1">
            <p className="text-[11px] font-bold text-indigo-700">최근 NPS 스코어</p>
            <p className="text-2xl font-black text-indigo-950 mt-1">{latest?.score ?? "-"}</p>
            {comparison && (
              <p className={`text-[10px] mt-1 flex items-center gap-1 font-bold ${
                comparison.diff > 0 ? "text-emerald-600" : comparison.diff < 0 ? "text-rose-600" : "text-slate-500"
              }`}>
                {comparison.diff > 0 ? <TrendingUp className="h-3 w-3" /> : comparison.diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {comparison.diff > 0 ? `+${comparison.diff}` : comparison.diff}pt {comparison.label}
              </p>
            )}
            <p className="text-[10px] text-indigo-700 mt-1">{latest?.period}</p>
          </div>
          <div className="sm:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={npsTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#898781" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={NPS_TREND_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: NPS_TREND_COLOR }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
