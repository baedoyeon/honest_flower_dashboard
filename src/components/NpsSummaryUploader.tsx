import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Upload, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { parseNpsSummaryInput, computeNpsRates } from "../utils/csvParser";

// Part F 우선순위 1 — ARES III 원본 응답(3.4만 건+)은 절대 올리지 않고, 페이지 상단 요약 문구
// ("NPS 78 (total: 34211 / promoters: 28867 / detractors: 2164 / passives: 3180)")를 그대로
// 붙여넣거나 "total,promoters,passives,detractors" 한 줄짜리 CSV만 입력받는다. "금주 사진후기 vs
// 전사 누적 NPS" 비교 차트가 쓰는 npsSummary를 이 버튼으로만 갱신한다.
export default function NpsSummaryUploader() {
  const { npsSummary, importNpsSummary } = useReviews();
  const [showModal, setShowModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseNpsSummaryInput>["summary"] | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleParse = () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setPreview(null);
    try {
      const result = parseNpsSummaryInput(inputText);
      if (result.summary) setPreview(result.summary);
      else setParseError(result.error || "값을 인식하지 못했습니다.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = () => {
    if (!preview) return;
    importNpsSummary(preview);
    setSuccessMsg(`NPS 요약치가 반영되었습니다! (total ${preview.total.toLocaleString()}건)`);
    setTimeout(() => {
      setShowModal(false);
      setInputText("");
      setPreview(null);
      setSuccessMsg(null);
    }, 1600);
  };

  const previewRates = preview ? computeNpsRates(preview) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowModal(!showModal)}
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 transition cursor-pointer"
      >
        <Upload className="h-3 w-3" />
        <span>NPS 요약 업데이트</span>
        {npsSummary.asOf && <span className="text-slate-400 font-medium">· {npsSummary.asOf} 기준</span>}
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-20 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-slate-900">NPS 요약치 업데이트</h5>
              <button
                onClick={() => { setShowModal(false); setPreview(null); setParseError(null); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              ARES III → 서베이 → NPS 페이지 상단의 요약 문구를 그대로 붙여넣거나, "total,promoters,passives,detractors" 헤더의 CSV 한 줄을 입력하세요. 원본 응답 로우는 올리지 마세요.
            </p>
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="NPS 78 (total: 34211 / promoters: 28867 / detractors: 2164 / passives: 3180)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-[11px] font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-green"
            />
            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={isParsing || !inputText.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              >
                {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span>확인</span>
              </button>
            </div>

            {parseError && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-900 leading-relaxed">{parseError}</p>
              </div>
            )}

            {preview && previewRates && (
              <div className="rounded-xl border border-brand-green/20 bg-brand-green-light/10 p-3 space-y-2">
                <p className="text-[10px] font-bold text-slate-700">
                  NPS {previewRates.score} · total {preview.total.toLocaleString()}건
                </p>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div><p className="text-[9px] text-slate-400 font-bold">Promoter</p><p className="text-xs font-black text-slate-800">{previewRates.promoterRate}%</p></div>
                  <div><p className="text-[9px] text-slate-400 font-bold">Passive</p><p className="text-xs font-black text-slate-800">{previewRates.passiveRate}%</p></div>
                  <div><p className="text-[9px] text-slate-400 font-bold">Detractor</p><p className="text-xs font-black text-slate-800">{previewRates.detractorRate}%</p></div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleApply}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-green hover:bg-brand-green-dark text-white px-4 py-1.5 text-[11px] font-bold transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>반영</span>
                  </button>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl bg-emerald-600 text-white p-2.5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-bold">{successMsg}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
