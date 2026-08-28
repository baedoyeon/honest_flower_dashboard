import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Headphones, Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Percent, Timer, MessageCircle, PhoneMissed, Layers, Wallet, Flame, TrendingUp, Rocket
} from "lucide-react";
import { useReviews } from "../context/ReviewsContext";
import { parseCSVToChatRooms, ChatRoomParseResult } from "../utils/csvParser";
import {
  computeChatRoomSummary, computeHourlyBottleneck, computeChannelTrendByDay, computeFrtArtTrend,
  computeChannelMixAndCPO, computeChannelMixTrendByMonth, reconcileCallbacks, validateOperatingHoursColumn,
  compute2026ForecastTrendByMonth
} from "../utils/chatRoomEngine";
import HourlyBottleneckHeatmap from "./HourlyBottleneckHeatmap";
import ChannelTrendChart from "./ChannelTrendChart";
import FrtArtTrendChart from "./FrtArtTrendChart";
import ChannelMixTrendChart from "./ChannelMixTrendChart";
import Forecast2026Panel from "./Forecast2026Panel";
import HolidayCalendarSettings from "./HolidayCalendarSettings";
import SchemaMismatchError from "./SchemaMismatchError";

function formatMinutes(m?: number): string {
  if (m === undefined) return "-";
  if (m < 60) return `${Math.round(m)}분`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}시간 ${rem}분` : `${h}시간`;
}

type StatColor = "blue" | "cyan" | "amber" | "violet" | "rose" | "indigo" | "emerald";

const COLOR_MAP: Record<StatColor, { bg: string; border: string; icon: string; iconBg: string; text: string }> = {
  blue: { bg: "bg-white", border: "border-slate-200", icon: "text-blue-600", iconBg: "bg-blue-100", text: "text-slate-900" },
  cyan: { bg: "bg-white", border: "border-slate-200", icon: "text-cyan-600", iconBg: "bg-cyan-100", text: "text-slate-900" },
  amber: { bg: "bg-white", border: "border-slate-200", icon: "text-amber-600", iconBg: "bg-amber-100", text: "text-slate-900" },
  violet: { bg: "bg-white", border: "border-slate-200", icon: "text-violet-600", iconBg: "bg-violet-100", text: "text-slate-900" },
  rose: { bg: "bg-rose-50/30", border: "border-rose-200", icon: "text-rose-700", iconBg: "bg-rose-100", text: "text-rose-950" },
  indigo: { bg: "bg-white", border: "border-slate-200", icon: "text-indigo-600", iconBg: "bg-indigo-100", text: "text-slate-900" },
  emerald: { bg: "bg-white", border: "border-slate-200", icon: "text-emerald-600", iconBg: "bg-emerald-100", text: "text-slate-900" },
};

function StatTile({ label, value, subtext, icon, color }: { label: string; value: string; subtext?: string; icon: React.ReactNode; color: StatColor }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-3xl border ${c.border} ${c.bg} p-5 shadow-2xs flex items-center justify-between`}>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-400">{label}</p>
        <h3 className={`text-2xl font-black mt-1 ${c.text}`}>{value}</h3>
        {subtext && <p className="text-[10px] text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className={`rounded-2xl ${c.iconBg} p-3 ${c.icon} shrink-0`}>{icon}</div>
    </div>
  );
}

function AccordionSection({
  title, subtitle, icon, defaultOpen = false, children,
}: { title: string; subtitle: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left cursor-pointer hover:bg-slate-50/60 transition"
      >
        <div className="flex items-start gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-slate-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatResponseTab() {
  const {
    chatRooms, importChatRooms, problemForms, orderItems, companyHolidays, setCompanyHolidays,
    monthlyCsLaborCostAllocation, setMonthlyCsLaborCostAllocation, isSyncing
  } = useReviews();

  const [showCSVModal, setShowCSVModal] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [parsedResult, setParsedResult] = useState<ChatRoomParseResult | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">("replace");
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setParsedResult(parseCSVToChatRooms(text));
      } catch (err) {
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

  const handleTextParse = () => {
    if (!csvRawText.trim()) return;
    setIsParsingCSV(true);
    try {
      setParsedResult(parseCSVToChatRooms(csvRawText));
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  const handleApplyCurrent = async () => {
    if (!parsedResult || parsedResult.chatRooms.length === 0) return;
    await importChatRooms(parsedResult.chatRooms, importMode === "replace");
    setImportSuccessMsg(`상담(채팅/전화) 데이터 ${parsedResult.validCount}건이 반영되었습니다!`);
    setTimeout(() => {
      setParsedResult(null);
      setShowCSVModal(false);
      setImportSuccessMsg(null);
    }, 2000);
  };

  // 인바운드 부재중 → 같은 고객의 아웃바운드 성공 콜백 재분류(reconcileCallbacks)를 가장 먼저 적용하고,
  // 이후 모든 지표는 이 보정된 목록을 기준으로 계산한다 — 그래야 응대율/부재중율/총문의량이 전부 일관된다.
  const { rooms: reconciledRooms, reconciledCount } = useMemo(() => reconcileCallbacks(chatRooms), [chatRooms]);
  const holidaySet = useMemo(() => new Set(companyHolidays), [companyHolidays]);
  const opValidation = useMemo(() => validateOperatingHoursColumn(chatRooms, holidaySet), [chatRooms, holidaySet]);

  const summary = useMemo(() => computeChatRoomSummary(reconciledRooms, holidaySet), [reconciledRooms, holidaySet]);
  const hourlyBottleneck = useMemo(() => computeHourlyBottleneck(reconciledRooms, holidaySet), [reconciledRooms, holidaySet]);
  const channelTrend = useMemo(() => computeChannelTrendByDay(reconciledRooms), [reconciledRooms]);
  const frtArtTrend = useMemo(() => computeFrtArtTrend(reconciledRooms, holidaySet), [reconciledRooms, holidaySet]);
  const channelMixTrend = useMemo(() => computeChannelMixTrendByMonth(reconciledRooms, problemForms, orderItems), [reconciledRooms, problemForms, orderItems]);
  const latestMonth = channelMixTrend.length > 0 ? channelMixTrend[channelMixTrend.length - 1].month : undefined;
  const cpo = useMemo(() => computeChannelMixAndCPO(reconciledRooms, problemForms, orderItems, latestMonth), [reconciledRooms, problemForms, orderItems, latestMonth]);

  const forecastTrend = useMemo(
    () => compute2026ForecastTrendByMonth(reconciledRooms, problemForms, orderItems, monthlyCsLaborCostAllocation),
    [reconciledRooms, problemForms, orderItems, monthlyCsLaborCostAllocation]
  );

  const chatPct = summary.channelMix.find(c => c.label === "채팅")?.pct || 0;
  const callPct = summary.channelMix.find(c => c.label === "전화")?.pct || 0;

  const showOperatingHoursWarning = opValidation.markedOperatingButOutsideHoursRatePct >= 10 || opValidation.markedNonOperatingButInsideHoursRatePct >= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* 상단 배너 */}
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-cyan-50/40 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-sm">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                CS 응대 현황
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ChatRoom 실데이터 연동
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                채팅 {summary.chatCount}건 · 전화 {summary.callCount}건 데이터 보유
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCSVModal(!showCSVModal)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>상담(ChatRoom) CSV 업로드</span>
          </button>
        </div>
      </div>

      {/* CSV 임포터 모달 */}
      <AnimatePresence>
        {showCSVModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">상담(ChatRoom) 전용 CSV 데이터 임포터</h4>
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
                  onClick={() => setActiveImportTab("file")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeImportTab === "file" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  파일 업로드 (.csv)
                </button>
                <button
                  onClick={() => setActiveImportTab("paste")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeImportTab === "paste" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                    isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20"
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
                    <div className="rounded-full p-3 bg-blue-100 text-blue-700">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">ChatRoom CSV 파일을 드래그하여 놓거나 클릭하여 업로드</p>
                    <p className="text-[11px] text-slate-400">
                      지원 열: key, 고객 이름, 유저챗 상태, 유저챗 처음 오픈된 시간, 매지너 최초 답변 시간, 구분, 전화 상태 등
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
                    placeholder="key,고객 이름,유저챗 상태,유저챗 처음 오픈된 시간,매지너 최초 답변 시간,구분,전화 상태&#10;abc123,김*진,closed,2026-08-01 10:00,2026-08-01 10:05,채팅,"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleTextParse}
                      disabled={isParsingCSV || !csvRawText.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>텍스트 파싱 및 검증</span>
                    </button>
                  </div>
                </div>
              )}

              {parsedResult && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/20 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        파싱 검증 완료: 총 <span className="text-blue-700 font-extrabold">{parsedResult.validCount}</span>건 상담
                      </h5>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                      <span>적용 방식:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="chatRoomImportMode" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="text-blue-600 focus:ring-blue-500" />
                        <span>전체 교체 (Replace)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-2">
                        <input type="radio" name="chatRoomImportMode" checked={importMode === "append"} onChange={() => setImportMode("append")} className="text-blue-600 focus:ring-blue-500" />
                        <span>기존 병합 (Append)</span>
                      </label>
                    </div>
                  </div>

                  {parsedResult.isLikelyWrongFileType ? (
                    <SchemaMismatchError
                      detectedColumns={parsedResult.detectedColumns}
                      guidance={`어드민 상담(ChatRoom) 목록의 "내보내기" 버튼으로 받은 CSV가 맞는지 확인해주세요.`}
                    />
                  ) : parsedResult.missingCriticalColumns.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">다음 필수 컬럼을 인식하지 못했습니다: {parsedResult.missingCriticalColumns.join(", ")}.</span>{" "}
                        CSV 헤더명을 확인해주세요("매지너 최초 답변 시간"의 오탈자는 어드민 원본 그대로여야 합니다).
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">총 건수</span>
                      <span className="text-sm font-bold text-slate-900">{parsedResult.validCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3 border border-blue-100">
                      <span className="text-[10px] text-blue-700 font-bold block uppercase">채팅</span>
                      <span className="text-sm font-bold text-blue-950">{parsedResult.chatRooms.filter(r => r.category === "채팅").length} 건</span>
                    </div>
                    <div className="rounded-xl bg-cyan-50 p-3 border border-cyan-100">
                      <span className="text-[10px] text-cyan-700 font-bold block uppercase">전화</span>
                      <span className="text-sm font-bold text-cyan-950">{parsedResult.chatRooms.filter(r => r.category !== "채팅").length} 건</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setParsedResult(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer">취소</button>
                    <button
                      onClick={handleApplyCurrent}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>CS 응대 현황에 즉시 반영 ({parsedResult.validCount}건)</span>
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

      {chatRooms.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
          <Headphones className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">업로드된 상담(ChatRoom) 데이터가 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">상단의 "상담(ChatRoom) CSV 업로드" 버튼으로 데이터를 올려주세요.</p>
        </div>
      ) : (
        <>
          <HolidayCalendarSettings holidays={companyHolidays} setHolidays={setCompanyHolidays} />

          {showOperatingHoursWarning && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <p className="font-bold mb-1">"운영 상태" 컬럼과 실제 영업시간(월~금 10-17시, 점심 12-13시 제외)이 다소 어긋납니다</p>
                <p>
                  운영중 표시 {opValidation.markedOperatingCount}건 중 실제 영업시간 밖 비율{" "}
                  <span className="font-bold">{opValidation.markedOperatingButOutsideHoursRatePct.toFixed(1)}%</span> ·
                  비운영중 표시 {opValidation.markedNonOperatingCount}건 중 실제 영업시간 안 비율{" "}
                  <span className="font-bold">{opValidation.markedNonOperatingButInsideHoursRatePct.toFixed(1)}%</span>.
                  참고로 평균 FRT/평균 RT·ART는 이 컬럼이 아니라 오픈~응답 시각을 직접 요일/시간으로 환산해 계산하므로 이 불일치의 영향은 받지 않습니다 — 이 컬럼을 곧이곧대로 믿기 어렵다면 알려주세요(다른 용도로 참고 중일 수 있어서요).
                </p>
              </div>
            </div>
          )}

          {reconciledCount > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-900">
                콜백 응대 인정: 인바운드 부재중 {reconciledCount}건이 같은 고객의 이후 아웃바운드 성공 통화로 재분류되어 응대율/부재중율에 반영됐습니다.
              </p>
            </div>
          )}

          {/* KPI 카드 — 탭 진입 시 항상 스크롤 없이 바로 보이는 최상단 고정 배치 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="응대율"
              value={`${summary.responseRatePct.toFixed(1)}%`}
              subtext={`${summary.answeredCount}건 / 전체 ${summary.totalInquiries}건`}
              icon={<Percent className="h-6 w-6" />}
              color="blue"
            />
            <StatTile
              label="평균 FRT (최초 응답)"
              value={formatMinutes(summary.avgFrtMinutes)}
              subtext={`중앙값 ${formatMinutes(summary.medianFrtMinutes)} · 채팅 ${summary.frtSampleSize}건 · 영업시간(월~금 10-17시, 점심 12-13시 제외) 경과분만 환산`}
              icon={<Timer className="h-6 w-6" />}
              color="amber"
            />
            <StatTile
              label="평균 RT/ART"
              value={formatMinutes(summary.avgArtMinutes)}
              subtext={`중앙값 ${formatMinutes(summary.medianArtMinutes)} · 채팅 ${summary.artSampleSize}건 · 영업시간(월~금 10-17시, 점심 12-13시 제외) 경과분만 환산`}
              icon={<Timer className="h-6 w-6" />}
              color="violet"
            />
            <StatTile
              label="총 문의량 (채팅+전화)"
              value={`${summary.totalInquiries}건`}
              subtext={`채팅 ${summary.chatCount}건 · 전화 ${summary.callCount}건`}
              icon={<MessageCircle className="h-6 w-6" />}
              color="indigo"
            />
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs">
              <p className="text-xs font-bold text-slate-400 mb-2">채널 비중</p>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-2">
                <div style={{ width: `${chatPct}%`, backgroundColor: "#3b82f6" }} />
                <div style={{ width: `${callPct}%`, backgroundColor: "#06b6d4" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-blue-700">채팅 {chatPct.toFixed(1)}%</span>
                <span className="text-cyan-700">전화 {callPct.toFixed(1)}%</span>
              </div>
            </div>
            <StatTile
              label="전화 부재중율"
              value={`${summary.phoneMissedRatePct.toFixed(1)}%`}
              subtext={`부재중 ${summary.phoneMissedCount}건 / 전화 ${summary.phoneTotal}건`}
              icon={<PhoneMissed className="h-6 w-6" />}
              color="rose"
            />
            <StatTile
              label="CPO%"
              value={`${cpo.cpoPct.toFixed(1)}%`}
              subtext={cpo.month ? `${cpo.month} · 이슈 ${cpo.totalIssues}건 / 주문 ${cpo.orderCount}건` : "데이터 부족"}
              icon={<Wallet className="h-6 w-6" />}
              color="emerald"
            />
          </div>

          {/* 상세 아코디언 — 기본 접힘 */}
          <div className="space-y-3">
            <AccordionSection
              title="응대 시간대별 병목"
              subtitle="요일 × 시간대 문의량/평균 FRT 히트맵"
              icon={<Flame className="h-4 w-4 text-blue-600 mt-0.5" />}
            >
              <HourlyBottleneckHeatmap cells={hourlyBottleneck} />
            </AccordionSection>

            <AccordionSection
              title="채널별 문의량 추이"
              subtitle="채팅/전화 일별 문의량"
              icon={<TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />}
            >
              <ChannelTrendChart points={channelTrend} />
            </AccordionSection>

            <AccordionSection
              title="FRT/RT/ART 추이선"
              subtitle="채팅 일별 평균 응답 소요시간"
              icon={<Timer className="h-4 w-4 text-amber-600 mt-0.5" />}
            >
              <FrtArtTrendChart points={frtArtTrend} />
            </AccordionSection>

            <AccordionSection
              title="채널 믹스 추이 (챗/콜/사고접수/플라워고)"
              subtitle="월별 4종 채널 비중 100% 누적"
              icon={<Layers className="h-4 w-4 text-fuchsia-600 mt-0.5" />}
            >
              <ChannelMixTrendChart points={channelMixTrend} />
            </AccordionSection>

            <AccordionSection
              title="2026년 예측"
              subtitle="CPO 예상 / 일평균·월평균 문의량 예상 / 건당 코스트 예상"
              icon={<Rocket className="h-4 w-4 text-emerald-600 mt-0.5" />}
            >
              <Forecast2026Panel
                trend={forecastTrend}
                monthlyCsLaborCostAllocation={monthlyCsLaborCostAllocation}
                setMonthlyCsLaborCostAllocation={setMonthlyCsLaborCostAllocation}
              />
            </AccordionSection>
          </div>
        </>
      )}
    </motion.div>
  );
}
