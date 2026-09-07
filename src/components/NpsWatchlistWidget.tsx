import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Users, Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { parseNpsImportCsv, NpsImportResult, NpsDetractorRow, computeNpsRates, classifyCategory } from "../utils/csvParser";
import SchemaMismatchError from "./SchemaMismatchError";

function formatWon(n: number): string {
  return `${n.toLocaleString()}원`;
}

// VOCAnaTab의 "NPS Detractor 피드백 카테고리 분석"과 동일한 classifyCategory 기준을 행 단위로도
// 노출한다 — 집계 화면만 보고 워치리스트로 다시 넘어와 "이 사람이 왜 이탈위험인지" 찾아야 하는
// 왕복을 없애기 위함. 피드백이 없는 행은 분류 자체가 불가능하므로 "사유 미기재"로 구분한다.
const CATEGORY_BADGE_STYLE: Record<string, string> = {
  "품질/상태": "bg-rose-50 text-rose-700 border-rose-200",
  "배송/포장": "bg-amber-50 text-amber-700 border-amber-200",
  "상품구성/양": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "서비스/시스템": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function getDetractorCategory(feedback?: string): string {
  if (!feedback) return "사유 미기재";
  return classifyCategory(feedback, 0, undefined);
}

type ViewMode = "highValue" | "memberList";

export default function NpsWatchlistWidget() {
  const {
    npsSummary, npsDetractorRows, applyNpsImport,
    npsContactedIds, toggleNpsContact,
    npsWatchlistThreshold, setNpsWatchlistThreshold,
  } = useReviews();

  const [viewMode, setViewMode] = useState<ViewMode>("highValue");
  const [visibleCount, setVisibleCount] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [parsedResult, setParsedResult] = useState<NpsImportResult | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModalState = () => {
    setParsedResult(null);
    setCsvRawText("");
  };

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setParsedResult(parseNpsImportCsv(event.target?.result as string));
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
      setParsedResult(parseNpsImportCsv(csvRawText));
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  const handleApply = () => {
    if (!parsedResult) return;
    applyNpsImport(parsedResult);
    setImportSuccessMsg(
      `NPS 응답 ${parsedResult.validCount.toLocaleString()}건 반영 — 누적 NPS 요약, Detractor ${parsedResult.detractorRows.length.toLocaleString()}건, 월별 추이 ${parsedResult.trend.length}개월치가 함께 갱신되었습니다!`
    );
    setTimeout(() => {
      resetModalState();
      setShowModal(false);
      setImportSuccessMsg(null);
    }, 2400);
  };

  // 우선순위 2 — 구매횟수 임계값 이상인 Detractor를 총구매비용 내림차순으로. npsDetractorRows는
  // 파서 단계에서 이미 Detractor(0~6점 또는 점수 공란) 버킷만 담고 있으므로 점수 재필터링은 불필요.
  const highValueList = useMemo(() => {
    return npsDetractorRows
      .filter(r => r.purchaseCount >= npsWatchlistThreshold)
      .sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount);
  }, [npsDetractorRows, npsWatchlistThreshold]);

  // 우선순위 5 — 원래 "리뷰 미작성 교차세그먼트"(이메일 기준 매칭)를 스펙했으나, 실제 데이터 확인
  // 결과 NPS 원본 CSV엔 이메일만 있고 이름이 없고, 리뷰 데이터엔 고객ID/이름만 있고 이메일이 없어
  // 두 소스 간 공통 식별자가 존재하지 않는다(구조적 제약, 사용자 확인 후 기능 축소 결정). 그래서
  // "리뷰 미작성"이라는 특정 매칭 대신, 회원 Detractor 응답을 이메일 기준 dedup(최신 응답 1건만)한
  // 참고용 전체 목록만 제공한다 — 비회원(전체의 약 42.8%)은 이메일이 없어 원천적으로 제외된다.
  const memberDedupedList = useMemo(() => {
    const latestByEmail = new Map<string, NpsDetractorRow>();
    npsDetractorRows.forEach(r => {
      if (!r.isMember || !r.email) return;
      const existing = latestByEmail.get(r.email);
      if (!existing || (r.respondedAt || "") > (existing.respondedAt || "")) {
        latestByEmail.set(r.email, r);
      }
    });
    return Array.from(latestByEmail.values()).sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount);
  }, [npsDetractorRows]);

  const activeList = viewMode === "highValue" ? highValueList : memberDedupedList;
  const previewRates = parsedResult ? computeNpsRates(parsedResult.summary) : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-2">
          <Users className="h-5 w-5 text-rose-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">NPS Detractor 이탈 위험군 추적</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ARES III NPS 원본 응답 CSV를 사전 필터링 없이 그대로 올리면 누적 NPS 요약, Detractor 워치리스트, 월별 추이가 한 번에 갱신됩니다.
              {npsSummary.asOf && <span> 현재 누적 NPS 기준일: {npsSummary.asOf}</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(!showModal)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Upload className="h-4 w-4" />
          <span>NPS 응답 CSV 업데이트</span>
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
                  <h4 className="text-xs font-bold text-slate-900">NPS 응답 CSV 업데이트</h4>
                </div>
                <button
                  onClick={() => { setShowModal(false); resetModalState(); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                ARES III → 서베이 → NPS의 <span className="font-bold">"내보내기"를 사전 필터링 없이 그대로</span> 올려주세요. 이 파서가 점수(0~10, 공란 포함)를 직접 세어 promoter/passive/detractor를 나누고(점수 공란은 어드민과 동일하게 Detractor로 합산됩니다), 월별 NPS 추이까지 한 번에 계산합니다. 지원 열: id(선택), 생성일, 회원/비회원, 이메일, 구매 횟수, 총 구매 비용, 최근 구매 상품, 점수, 피드백.
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
                    placeholder={"id,생성일,회원/비회원,이메일,구매 횟수,총 구매 비용,최근 구매 상품,꽃 취향,기본 배송지,점수,피드백\n1,2026-08-20,회원,hong@example.com,8,1250000,테디베어 해바라기,파스텔,서울시 강남구,3,\"꽃이 자주 시들어와요\"\n2,2026-08-21,비회원,,1,90000,장미 부케,비비드,,,\n"}
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
                      파싱 검증 완료: 총 <span className="text-rose-700 font-extrabold">{parsedResult.validCount.toLocaleString()}</span>건 응답
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
                      <div><p className="text-[9px] text-slate-400 font-bold">Promoter</p><p className="text-sm font-black text-slate-800">{parsedResult.summary.promoters.toLocaleString()}</p></div>
                      <div><p className="text-[9px] text-slate-400 font-bold">Passive</p><p className="text-sm font-black text-slate-800">{parsedResult.summary.passives.toLocaleString()}</p></div>
                      <div><p className="text-[9px] text-slate-400 font-bold">Detractor</p><p className="text-sm font-black text-rose-600">{parsedResult.summary.detractors.toLocaleString()}</p></div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setParsedResult(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer">취소</button>
                    <button
                      onClick={handleApply}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>반영</span>
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
                onClick={() => { setViewMode("highValue"); setVisibleCount(20); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === "highValue" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                고액구매 이탈위험 ({highValueList.length})
              </button>
              <button
                onClick={() => { setViewMode("memberList"); setVisibleCount(20); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  viewMode === "memberList" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                회원 Detractor 전체 ({memberDedupedList.length})
              </button>
              {activeList.some(r => r.score === null) && (
                <span className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  점수 미입력 고객 {activeList.filter(r => r.score === null).length.toLocaleString()}명
                </span>
              )}
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

          {viewMode === "memberList" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-relaxed">
                원래 "리뷰 미작성" 교차 매칭을 목표했으나, NPS 응답엔 이메일만 있고 리뷰 데이터엔 고객ID/이름만 있어 두 소스 간 공통 식별자가 없습니다(구조적 제약). 그래서 <span className="font-bold">회원 응답만</span>(비회원은 이메일이 없어 제외) 이메일 기준 dedup(동일 이메일은 최신 응답 1건만) 처리한 참고용 전체 목록입니다 — 리뷰 작성 여부와는 무관합니다.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">이메일</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">점수</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">구매횟수</th>
                  <th className="px-3 py-2.5 text-right font-bold text-slate-500">총구매비용</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">최근구매상품</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">불만유형</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-500">피드백</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">응답일</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-500">컨택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeList.length === 0 ? (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">조건에 맞는 대상이 없습니다.</td></tr>
                ) : activeList.slice(0, visibleCount).map((row: NpsDetractorRow) => {
                  const isContacted = npsContactedIds.has(row.id);
                  return (
                    <tr key={row.id} className={isContacted ? "bg-slate-50/40" : ""}>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-800">{row.email || "이메일 없음"}</p>
                        <p className="text-[10px] text-slate-400">{row.isMember ? "회원" : "비회원"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-rose-600">{row.score === null ? "미기재" : row.score}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">{row.purchaseCount}회</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatWon(row.totalPurchaseAmount)}</td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[140px] truncate">{row.lastPurchaseProduct || "-"}</td>
                      <td className="px-3 py-2.5">
                        {(() => {
                          const cat = getDetractorCategory(row.feedback);
                          return (
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap ${CATEGORY_BADGE_STYLE[cat] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
                              {cat}
                            </span>
                          );
                        })()}
                      </td>
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

          {activeList.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs cursor-pointer transition"
              >
                더 보기 ({visibleCount} / {activeList.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
