import { useState, useMemo, useRef, useEffect } from "react";
import type { ReactNode, RefObject } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList
} from "recharts";
import {
  Info, TrendingUp, TrendingDown, ShoppingCart, Receipt, Coins,
  AlertOctagon, PackageSearch, Wallet, Sparkles, Upload, X,
  FileSpreadsheet, CheckCircle2, Loader2, Hourglass, Scale, ChevronDown, ChevronUp, Truck,
  ListChecks, Search, ArrowUpDown, AlertTriangle, Layers, PieChart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useReviews } from "../context/ReviewsContext";
import { OrderItem } from "../data/orderItems";
import {
  parseCSVToOrderItems, OrderItemParseResult, parseCSVToProblemForms, ProblemFormParseResult,
  parseCSVToCsCostExport, CsCostExportParseResult, parseCSVToIncidents
} from "../utils/csvParser";
import {
  computeMonthlyStats, computeDailyTrend, computeHandlingMethodStats, computeProductClaimStats,
  computeSalesSkuStats, computeMethodBreakdownByWeek, computeItemDailyAccidentPivot,
  verifyAccidentScopeReflectsRefund, verifyClaimCostAgainstCsExport,
  calcClaimRate, calcClaimCostPerSales, won, MonthlyClaimStat, ProductClaimStat,
  computeProductMonthAggregates, computeSeasonalCompareMonths, resolveYoyAggregateSource, ProductMonthAggregate
} from "../utils/claimCostEngine";
import MethodBreakdownTrendChart from "./MethodBreakdownTrendChart";
import ItemWeeklyClaimHeatmap from "./ItemWeeklyClaimHeatmap";
import DispatchFailureWidget from "./DispatchFailureWidget";
import SchemaMismatchError from "./SchemaMismatchError";

const COURIER_ADJUSTMENT_STORAGE_KEY = "claimCost_courierAdjustments";

// ============================================================================
// 위젯별 메타 정보 툴팁 (기능 / 소스 / 수집(집계) 방법 / 계산식)
// ============================================================================
interface WidgetMeta {
  기능: string;
  소스: string;
  수집방법: string;
  계산식: string;
}

function WidgetInfoTip({ meta }: { meta: WidgetMeta }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer shrink-0"
        aria-label="위젯 정보"
      >
        <Info className="h-3 w-3" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-7 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-2.5"
          >
            {(Object.keys(meta) as (keyof WidgetMeta)[]).map((key) => (
              <div key={key}>
                <p className="text-[10px] font-black text-brand-green-dark uppercase tracking-wide">{key}</p>
                <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{meta[key]}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WidgetHeader({ title, subtitle, meta, icon }: { title: string; subtitle?: string; meta: WidgetMeta; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-4">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <WidgetInfoTip meta={meta} />
    </div>
  );
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================
export default function ClaimCostTab() {
  const { orderItems, importOrderItems, problemForms, importProblemForms, importIncidents, isSyncing } = useReviews();

  // CSV 업로드 패널 상태 (목업엔 없던 부분 — 실데이터 연동을 위해 추가).
  // OrderItem/ProblemForm 두 CSV 종류를 같은 모달에서 토글로 전환해 올린다(전용 아카이브 UI는 별도 작업).
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvKind, setCsvKind] = useState<"orderItem" | "problemForm">("orderItem");
  const [activeImportTab, setActiveImportTab] = useState<"file" | "paste">("file");
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsingCSV, setIsParsingCSV] = useState(false);
  const [orderParsedResult, setOrderParsedResult] = useState<OrderItemParseResult | null>(null);
  const [pfParsedResult, setPfParsedResult] = useState<ProblemFormParseResult | null>(null);
  // 기본값을 "기존 병합(append)"으로 둔다 — 실제 어드민 export가 매번 전체 이력이 아니라 최근
  // 며칠치만 담긴 좁은 범위 파일인 경우가 흔한데(실측으로 확인됨), "전체 교체"가 기본이면 그런
  // 파일을 무심코 올릴 때마다 그동안 쌓인 전체 이력이 조용히 사라져버린다 — 실제로 이 문제로
  // "히트맵/전체현황이 반영이 안 된다"는 보고가 있었음(사실은 새 데이터가 아니라 기존 데이터가
  // 통째로 사라진 것). "전체 교체"는 사용자가 명시적으로 선택해야만 쓰이게 한다.
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // ProblemForm CSV는 "사고접수" 탭의 Incident 데이터와도 동기화한다(같은 파일을 두 파서에 모두
  // 돌려 incidents/problemForms를 함께 채움) — 업로드 지점이 어디든 대시보드 전체에 반영되도록.
  const [lastPfRawText, setLastPfRawText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ProblemForm CSV 업로드 시 사용자가 지정하는 수집 채널 — 일반 사고접수 CSV와 플라워고 사고접수
  // CSV는 스키마가 거의 같아(채널 구분 컬럼이 없음) 업로드 UI에서 직접 태그해야 한다.
  const [pfImportChannel, setPfImportChannel] = useState<"일반" | "플라워고">("일반");

  // 택배사 정산 발생 시 해당 상품 클레임코스트에 수동으로 마이너스 조정하는 입력값 —
  // "참고: 적립금 지급 총액"과 같은 수동입력 패턴(로컬 저장, 계산에 자동 반영 안 함, 화면 표시만 조정).
  const [courierAdjustments, setCourierAdjustments] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(COURIER_ADJUSTMENT_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem(COURIER_ADJUSTMENT_STORAGE_KEY, JSON.stringify(courierAdjustments));
  }, [courierAdjustments]);

  const openCsvModal = (kind: "orderItem" | "problemForm") => {
    setCsvKind(kind);
    setShowCSVModal(true);
  };

  const handleFileProcess = (file: File) => {
    if (!file) return;
    setIsParsingCSV(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (csvKind === "orderItem") {
          setOrderParsedResult(parseCSVToOrderItems(text));
        } else {
          setPfParsedResult(parseCSVToProblemForms(text, pfImportChannel));
          setLastPfRawText(text);
        }
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
      if (csvKind === "orderItem") {
        setOrderParsedResult(parseCSVToOrderItems(csvRawText));
      } else {
        setPfParsedResult(parseCSVToProblemForms(csvRawText, pfImportChannel));
        setLastPfRawText(csvRawText);
      }
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsingCSV(false);
    }
  };

  const handleApplyCurrent = async () => {
    if (csvKind === "orderItem") {
      if (!orderParsedResult || orderParsedResult.orderItems.length === 0) return;
      if (importMode === "replace" && orderItems.length > 0) {
        const ok = window.confirm(
          `"전체 교체"를 선택하셨습니다. 지금 저장된 주문(OrderItem) ${orderItems.length.toLocaleString()}건이 전부 사라지고 이번에 올린 ${orderParsedResult.validCount.toLocaleString()}건으로 완전히 대체됩니다.\n\n보통은 "기존 병합"이 맞습니다 — 정말 전체 교체하시겠습니까?`
        );
        if (!ok) return;
      }
      await importOrderItems(orderParsedResult.orderItems, importMode === "replace");
      setImportSuccessMsg(`주문 데이터 ${orderParsedResult.validCount}건이 반영되었습니다!`);
      setTimeout(() => {
        setOrderParsedResult(null);
        setShowCSVModal(false);
        setImportSuccessMsg(null);
      }, 2000);
    } else {
      if (!pfParsedResult || pfParsedResult.problemForms.length === 0) return;
      if (importMode === "replace" && problemForms.length > 0) {
        const ok = window.confirm(
          `"전체 교체"를 선택하셨습니다. 지금 저장된 사고접수(ProblemForm) ${problemForms.length.toLocaleString()}건이 전부 사라지고 이번에 올린 ${pfParsedResult.validCount.toLocaleString()}건으로 완전히 대체됩니다.\n\n보통은 "기존 병합"이 맞습니다 — 정말 전체 교체하시겠습니까?`
        );
        if (!ok) return;
      }
      await importProblemForms(pfParsedResult.problemForms, importMode === "replace");

      // 같은 CSV를 사고접수 탭의 Incident 파서로도 돌려서 함께 반영 — 업로드 지점이 어디든
      // 대시보드 전체(주간 핵심 지표/사고접수 탭 포함)에 동일하게 반영되도록 동기화한다.
      let syncedIncidentCount = 0;
      try {
        const incidentResult = parseCSVToIncidents(lastPfRawText, pfImportChannel);
        if (incidentResult.incidents.length > 0) {
          await importIncidents(incidentResult.incidents, importMode === "replace");
          syncedIncidentCount = incidentResult.validCount;
        }
      } catch (err) {
        console.error("ProblemForm -> Incident 동기화 오류:", err);
      }

      setImportSuccessMsg(
        `사고접수 데이터 ${pfParsedResult.validCount}건이 반영되었습니다!` +
        (syncedIncidentCount > 0 ? ` (사고접수 탭에도 ${syncedIncidentCount}건 동기화됨)` : "")
      );
      setTimeout(() => {
        setPfParsedResult(null);
        setShowCSVModal(false);
        setImportSuccessMsg(null);
      }, 2500);
    }
  };

  // ------------------------------------------------------------------------
  // 실데이터 집계 (claimCostDummyData.ts 대신 claimCostEngine.ts의 실계산 함수 사용)
  // ------------------------------------------------------------------------
  const [monthRangeCount, setMonthRangeCount] = useState<6 | 8>(8);

  const problemFormFlowergoCount = useMemo(
    () => problemForms.filter(p => p.importChannel === "플라워고").length,
    [problemForms]
  );

  const monthlyStats = useMemo(() => computeMonthlyStats(orderItems, problemForms), [orderItems, problemForms]);
  const dailyData = useMemo(() => computeDailyTrend(orderItems, problemForms, 14), [orderItems, problemForms]);
  const maxDailySales = useMemo(() => Math.max(0, ...dailyData.map(d => d.salesAmount)), [dailyData]);
  const handlingMethodStats = useMemo(() => computeHandlingMethodStats(orderItems, problemForms), [orderItems, problemForms]);
  const allProductClaimStats = useMemo(() => computeProductClaimStats(orderItems, problemForms), [orderItems, problemForms]);
  const top3SkuClaims = useMemo(() => allProductClaimStats.slice(0, 3), [allProductClaimStats]);
  const accidentScopeCheck = useMemo(() => verifyAccidentScopeReflectsRefund(orderItems, problemForms), [orderItems, problemForms]);
  // "상품 × 일자 사고접수 히트맵" — 사고접수 탭에 있다가 여기로 다시 옮김. 셀 자체(일자별 건수)는
  // 여전히 ProblemForm 접수일 기준이라 이 탭의 다른 표(결제월 귀속)와 숫자가 안 맞을 수 있지만,
  // 클레임율(orderCount 대비)을 보여주려면 OrderItem이 필요해서 이 탭이 자연스러운 위치다.
  const itemDailyAccidentPivot = useMemo(() => computeItemDailyAccidentPivot(problemForms, orderItems), [problemForms, orderItems]);

  const years = useMemo(
    () => Array.from(new Set(monthlyStats.map(m => m.month.split("-")[0]))).sort(),
    [monthlyStats]
  );
  const latestYear = years[years.length - 1];
  const priorYear = years.length > 1 ? years[years.length - 2] : undefined;

  const thisYear = useMemo(
    () => monthlyStats.filter(m => m.month.startsWith(`${latestYear}-`)).slice(-monthRangeCount),
    [monthlyStats, latestYear, monthRangeCount]
  );
  const priorYearByMonth = useMemo(() => {
    const map = new Map<string, MonthlyClaimStat>();
    if (priorYear) {
      monthlyStats.filter(m => m.month.startsWith(`${priorYear}-`)).forEach(m => map.set(m.month.split("-")[1], m));
    }
    return map;
  }, [monthlyStats, priorYear]);

  const latest = thisYear[thisYear.length - 1];
  // KPI 카드의 "8월 매출" 등과 동일한 "이번달" 기준(latest.month) — 상단 카드와 스코프를 통일한다.
  const productClaimStatsThisMonth = useMemo(
    () => computeProductClaimStats(orderItems, problemForms, latest?.month),
    [orderItems, problemForms, latest?.month]
  );
  const salesSkuStats = useMemo(
    () => computeSalesSkuStats(orderItems, problemForms, latest?.month),
    [orderItems, problemForms, latest?.month]
  );
  const methodBreakdownByWeek = useMemo(() => computeMethodBreakdownByWeek(orderItems, problemForms), [orderItems, problemForms]);
  const latestPrior = latest ? priorYearByMonth.get(latest.month.split("-")[1]) : undefined;
  const comparisonLabel = latestPrior ? "전년동월 대비" : "직전월 대비";
  const latestPriorFallback = !latestPrior && thisYear.length >= 2 ? thisYear[thisYear.length - 2] : undefined;
  const comparisonBase = latestPrior || latestPriorFallback;

  const latestClaimRate = latest ? calcClaimRate(latest.claimCount, latest.orderCount) : 0;
  const baseClaimRate = comparisonBase ? calcClaimRate(comparisonBase.claimCount, comparisonBase.orderCount) : undefined;
  const claimRateDiff = baseClaimRate !== undefined ? Math.round((latestClaimRate - baseClaimRate) * 10) / 10 : undefined;

  const claimCostTotalLatest = latest ? latest.refundAmountTotal + latest.reshipCostTotal : 0;
  const claimCostRatioLatest = latest ? calcClaimCostPerSales(claimCostTotalLatest, latest.salesAmount) : 0;

  const salesDiffPct = latest && comparisonBase && comparisonBase.salesAmount > 0
    ? Math.round(((latest.salesAmount - comparisonBase.salesAmount) / comparisonBase.salesAmount) * 1000) / 10
    : undefined;

  const claimCountDiff = latest && comparisonBase ? latest.claimCount - comparisonBase.claimCount : undefined;

  // 연도별 매출 비교 차트 데이터 (최근 N개월, 전년 동월 데이터가 있으면 나란히 표시)
  const yoyChartData = thisYear.map(m => {
    const mm = m.month.split("-")[1];
    const priorM = priorYearByMonth.get(mm);
    return {
      label: m.label,
      [`매출(${latestYear})`]: m.salesAmount,
      [`매출(${priorYear || "전년 데이터 없음"})`]: priorM?.salesAmount ?? 0,
      클레임율: calcClaimRate(m.claimCount, m.orderCount)
    };
  });
  const salesKeyLatest = `매출(${latestYear})`;
  const salesKeyPrior = `매출(${priorYear || "전년 데이터 없음"})`;

  const claimCostTrendData = thisYear.map(m => ({
    label: m.label,
    환불금액: m.refundAmountTotal,
    재발송비용: m.reshipCostTotal
  }));

  const handlingTotal = handlingMethodStats.reduce((s, h) => s + h.count, 0);

  if (orderItems.length === 0) {
    return (
      <ClaimCostShell
        showCSVModal={showCSVModal} setShowCSVModal={setShowCSVModal}
        csvKind={csvKind} openCsvModal={openCsvModal}
        activeImportTab={activeImportTab} setActiveImportTab={setActiveImportTab}
        csvRawText={csvRawText} setCsvRawText={setCsvRawText}
        isParsingCSV={isParsingCSV}
        orderParsedResult={orderParsedResult} setOrderParsedResult={setOrderParsedResult}
        pfParsedResult={pfParsedResult} setPfParsedResult={setPfParsedResult}
        pfImportChannel={pfImportChannel} setPfImportChannel={setPfImportChannel}
        importMode={importMode} setImportMode={setImportMode}
        importSuccessMsg={importSuccessMsg} isDragging={isDragging} setIsDragging={setIsDragging}
        fileInputRef={fileInputRef} handleFileProcess={handleFileProcess} handleTextParse={handleTextParse}
        handleApplyCurrent={handleApplyCurrent} isSyncing={isSyncing}
        orderItemCount={0} problemFormCount={problemForms.length} problemFormFlowergoCount={problemFormFlowergoCount}
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
          <PackageSearch className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">업로드된 주문(OrderItem) 데이터가 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">상단의 "주문(OrderItem) CSV 업로드" 버튼으로 데이터를 올려주세요.</p>
        </div>

        <DispatchFailureWidget />
      </ClaimCostShell>
    );
  }

  return (
    <ClaimCostShell
      showCSVModal={showCSVModal} setShowCSVModal={setShowCSVModal}
      csvKind={csvKind} openCsvModal={openCsvModal}
      activeImportTab={activeImportTab} setActiveImportTab={setActiveImportTab}
      csvRawText={csvRawText} setCsvRawText={setCsvRawText}
      isParsingCSV={isParsingCSV}
      orderParsedResult={orderParsedResult} setOrderParsedResult={setOrderParsedResult}
      pfParsedResult={pfParsedResult} setPfParsedResult={setPfParsedResult}
      pfImportChannel={pfImportChannel} setPfImportChannel={setPfImportChannel}
      importMode={importMode} setImportMode={setImportMode}
      importSuccessMsg={importSuccessMsg} isDragging={isDragging} setIsDragging={setIsDragging}
      fileInputRef={fileInputRef} handleFileProcess={handleFileProcess} handleTextParse={handleTextParse}
      handleApplyCurrent={handleApplyCurrent} isSyncing={isSyncing}
      orderItemCount={orderItems.length} problemFormCount={problemForms.length} problemFormFlowergoCount={problemFormFlowergoCount}
    >
      {problemForms.length === 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 flex items-start gap-3">
          <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-bold mb-1">⚠️ 사고접수(ProblemForm) 데이터가 아직 없습니다</p>
            <p>
              정확한 처리방법(재발송/결제 수단으로 환불/교환/반품/적립금 환불) 5종 구분과 상품별 주요 사고유형은
              상단의 "사고접수(ProblemForm) CSV 업로드"로 데이터를 올려야 채워집니다. 지금은 OrderItem만으로 계산 가능한 근사치만 표시 중입니다.
            </p>
          </div>
        </div>
      )}

      {accidentScopeCheck.matchedCount > 0 && accidentScopeCheck.divergentCount > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex items-start gap-2 text-xs text-slate-700">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            사고 범위(%) 검증: {accidentScopeCheck.matchedCount}건 비교 중 {accidentScopeCheck.divergentCount}건이 "가격×사고범위%" 기대값과
            실제 환불금액이 5% 이상 차이납니다. 환불금액이 사고 범위를 그대로 반영하지 않는 케이스가 섞여 있을 수 있어, 클레임 비용 합산 방식(현재는
            환불금액을 그대로 합산, 사고범위 재곱연산 없음)이 맞는지 실데이터로 한 번 더 확인해 주세요.
          </span>
        </div>
      )}

      {latest?.isProvisional && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 flex items-center gap-2 text-xs text-blue-900">
          <Hourglass className="h-4 w-4 text-blue-600 shrink-0" />
          <span><b>{latest.label}</b>은 아직 성숙 윈도우(수령일+7일)가 지나지 않은 잠정치입니다. 접수될 사고가 더 남아있을 수 있습니다.</span>
        </div>
      )}

      <CsCostVerificationPanel orderItems={orderItems} />

      {/* KPI 카드 6개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile
          label={`${latest?.label ?? "-"} 매출`}
          value={won(latest?.salesAmount ?? 0)}
          delta={salesDiffPct}
          deltaUnit="%"
          deltaGoodDirection="up"
          deltaLabel={comparisonLabel}
          icon={<TrendingUp className="h-5 w-5" />}
          color="indigo"
          meta={{
            기능: "선택된 최신 결제월의 총 매출액과 비교 기간 대비 증감률을 보여주는 KPI 카드",
            소스: "orderItem CSV (가격 필드 합계)",
            수집방법: "월별 orderItem 합계 집계",
            계산식: "당월 매출 합계, 증감% = (당월-비교월)/비교월 × 100",
          }}
        />
        <StatTile
          label={`${latest?.label ?? "-"} 클레임 건수`}
          value={`${latest?.claimCount ?? 0}건`}
          delta={claimCountDiff}
          deltaUnit="건"
          deltaGoodDirection="down"
          deltaLabel={comparisonLabel}
          icon={<AlertOctagon className="h-5 w-5" />}
          color="rose"
          meta={{
            기능: "환불 또는 재발송이 발생한 주문 건수(OrderItem 기준 근사치)와 비교 기간 대비 증감",
            소스: "orderItem CSV (환불금액 > 0 이거나 재발송(-CS) 매칭된 주문)",
            수집방법: "ProblemForm 미연동 상태의 근사치 — 정확한 사고접수 건수는 ProblemForm 연동 후 제공 예정",
            계산식: "환불금액 > 0 또는 재발송 매칭 주문 수",
          }}
        />
        <StatTile
          label="클레임율"
          value={`${latestClaimRate}%`}
          delta={claimRateDiff}
          deltaUnit="%p"
          deltaGoodDirection="down"
          deltaLabel={comparisonLabel}
          icon={<PackageSearch className="h-5 w-5" />}
          color="amber"
          meta={{
            기능: "주문건수 대비 클레임 발생 비율. 값이 낮을수록 품질/배송 안정성이 좋다는 뜻",
            소스: "orderItem CSV",
            수집방법: "월별 주문건수·클레임건수를 각각 집계 후 나눔",
            계산식: "클레임율(%) = 클레임건수 / 주문건수 × 100",
          }}
        />
        <StatTile
          label="클레임비용/매출 비율"
          value={`${claimCostRatioLatest}%`}
          icon={<Coins className="h-5 w-5" />}
          color="emerald"
          meta={{
            기능: "매출 대비 클레임비용(환불금액+재발송비용 합산)이 차지하는 비율. 생산자정산·택배사 정산은 스코프 제외로 확정되어 포함되지 않음",
            소스: "orderItem CSV",
            수집방법: "환불금액 + 재발송 정산가격 합산 후 매출로 나눔",
            계산식: "(환불금액+재발송비용) / 매출액 × 100",
          }}
        />
        <StatTile
          label="판매 SKU 수"
          value={`${salesSkuStats.salesSkuCount}종`}
          icon={<Layers className="h-5 w-5" />}
          color="sky"
          meta={{
            기능: "선택된 최신 결제월에 실제로 판매된 상품(SKU)의 고유 종류 수",
            소스: "orderItem CSV (상품 상세 명)",
            수집방법: "해당 결제월 orderItem의 상품명 고유값 개수 집계",
            계산식: "distinct(orderItem.상품명) 개수",
          }}
        />
        <StatTile
          label="클레임 발생 SKU 비율"
          value={`${salesSkuStats.claimSkuRatio}%`}
          subtext={`${salesSkuStats.claimSkuCount}종 / ${salesSkuStats.salesSkuCount}종`}
          icon={<PieChart className="h-5 w-5" />}
          color="violet"
          meta={{
            기능: "판매 SKU 중 클레임(ProblemForm)이 한 건이라도 발생한 SKU의 비율. 구글시트 'claim per sales sku'와 동일 개념",
            소스: "orderItem CSV + problemForm CSV (\"주문번호\" FK 조인)",
            수집방법: "클레임 발생 SKU 고유값 개수 / 판매 SKU 고유값 개수",
            계산식: `클레임 SKU 비율(%) = ${salesSkuStats.claimSkuCount}종 / ${salesSkuStats.salesSkuCount}종 × 100`,
          }}
        />
      </div>

      {/* 매출 비교 + 클레임율 */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <WidgetHeader
            title="월별 매출 비교 + 클레임율"
            subtitle={priorYear ? `${priorYear} vs ${latestYear} 동월 매출 비교(막대) · 클레임율 추이(선)` : `${latestYear} 매출 추이(막대) · 클레임율 추이(선) — 전년 데이터 없음`}
            icon={<TrendingUp className="h-4 w-4 text-indigo-600 mt-0.5" />}
            meta={{
              기능: "이번 해와 지난 해 동월 매출을 막대로 비교하고, 클레임율(선)을 함께 표시해 매출 성장과 품질 리스크를 같이 보기 위한 차트",
              소스: "orderItem CSV",
              수집방법: "월별 매출/주문건수/클레임건수를 각각 집계",
              계산식: "매출 = 월별 orderItem 합계 / 클레임율(%) = 클레임건수÷주문건수×100",
            }}
          />
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-4 -mt-2">
            {([6, 8] as const).map((n) => (
              <button
                key={n}
                onClick={() => setMonthRangeCount(n)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  monthRangeCount === n ? "bg-white shadow-2xs text-indigo-700" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                최근 {n}개월
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={yoyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => `${Math.round(v / 10_000_000)}천만`}
              tick={{ fontSize: 10, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "클레임율" ? [`${value}%`, name] : [won(value), name]
              }
              contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey={salesKeyPrior} fill="#c3c2b7" radius={[4, 4, 0, 0]} barSize={16} />
            <Bar yAxisId="left" dataKey={salesKeyLatest} fill="#7cb342" radius={[4, 4, 0, 0]} barSize={16} />
            <Line yAxisId="right" type="monotone" dataKey="클레임율" stroke="#e34948" strokeWidth={2} dot={{ r: 4, fill: "#e34948", stroke: "#fff", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 클레임비용 구성 트렌드 (환불금액 / 재발송비용 — 실제 산출 가능한 2개만) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <WidgetHeader
          title="클레임비용 구성 트렌드"
          subtitle="환불금액 / 재발송비용"
          icon={<Receipt className="h-4 w-4 text-rose-600 mt-0.5" />}
          meta={{
            기능: "클레임비용을 구성하는 환불금액/재발송비용을 각각 라인으로 표시. 생산자정산·택배사 정산은 스코프 제외로 확정됨",
            소스: "orderItem CSV",
            수집방법: "월별 환불금액 합계, 재발송(-CS) 주문의 정산가격 합계를 각각 집계",
            계산식: "환불금액 = Σ orderItem.환불금액 / 재발송비용 = Σ (-CS 매칭 orderItem).정산가격",
          }}
        />
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={claimCostTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 10_000)}만`} tick={{ fontSize: 10, fill: "#898781" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(value: number, name: string) => [won(value), name]} contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="환불금액" stroke="#2a78d6" strokeWidth={2} dot={{ r: 4, fill: "#2a78d6", stroke: "#fff", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="재발송비용" stroke="#eb6834" strokeWidth={2} dot={{ r: 4, fill: "#eb6834", stroke: "#fff", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 처리방법 breakdown */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <WidgetHeader
            title="처리방법 비중"
            subtitle={problemForms.length > 0 ? "재발송/결제 수단으로 환불/교환/반품/적립금 환불 5종" : "재발송 vs 그 외 환불 근사치 — ProblemForm 업로드 시 5종으로 세분화"}
            icon={<ShoppingCart className="h-4 w-4 text-emerald-600 mt-0.5" />}
            meta={{
              기능: "클레임이 어떤 방식으로 처리됐는지 비중을 보여주는 위젯. ProblemForm이 있으면 실제 처리방법 5종, 없으면 OrderItem 근사치 2종",
              소스: problemForms.length > 0 ? "problemForm CSV (처리 방법), \"주문 아이템\" FK로 orderItem과 조인" : "orderItem CSV (재발송(-CS) 매칭 여부, 환불금액 유무)",
              수집방법: problemForms.length > 0 ? "조인된 problemForm의 처리 방법 컬럼 기준 group by count" : "재발송 그룹키 매칭 주문과 환불금액>0 주문을 각각 카운트",
              계산식: "각 처리방법 건수 / 전체 클레임 건수 × 100",
            }}
          />
          {handlingTotal > 0 ? (
            <div className="space-y-3">
              {handlingMethodStats.map((h, idx) => {
                const pct = Math.round((h.count / handlingTotal) * 1000) / 10;
                const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-slate-400"];
                return (
                  <div key={h.method}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">{h.method}</span>
                      <span className="font-mono text-slate-500">{h.count}건 ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div className={`${colors[idx % colors.length]} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">아직 클레임(환불/재발송) 데이터가 없습니다.</p>
          )}
        </div>

        {/* Top3 SKU 클레임 */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <WidgetHeader
            title="Top3 상품 클레임"
            subtitle="전체 업로드 기간 기준, 클레임건수 순"
            icon={<Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />}
            meta={{
              기능: "클레임(환불)이 가장 많이 발생한 상품 3개의 클레임율/환불액/주요 사고유형을 보여주는 표",
              소스: "orderItem CSV (상품 상세 명) + problemForm CSV (사고 유형/상세 유형, \"주문 아이템\" FK 조인)",
              수집방법: "상품별 group by, 환불금액>0 주문 수 기준 상위 3개 추출 후 조인된 problemForm 중 최다 사고유형 선택",
              계산식: "상품별 클레임건수 내림차순 Top3, 클레임율 = 상품별 클레임건수/상품별 주문건수×100",
            }}
          />
          {top3SkuClaims.length > 0 ? (
            <div className="space-y-2">
              {top3SkuClaims.map((s, idx) => {
                const adjustmentRaw = courierAdjustments[s.sku] || "";
                const adjustment = Number(adjustmentRaw) || 0;
                const adjustedTotal = s.refundAmountSum - adjustment;
                return (
                  <div key={s.sku} className="rounded-2xl border border-purple-100 bg-purple-50/30 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black bg-purple-600 text-white rounded-full h-5 w-5 flex items-center justify-center shrink-0">{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-800 truncate flex-1">{s.sku}</span>
                      <span className="text-xs font-black text-purple-700 shrink-0">{s.claimCount}건</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                      <span>클레임율 {s.claimRate}%</span>
                      <span>·</span>
                      <span>환불 {won(s.refundAmountSum)}</span>
                      <span>·</span>
                      <span className="text-slate-400 italic">{s.mainCause}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-purple-100/70">
                      <Truck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">택배사 정산 조정(-)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={adjustmentRaw}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, "");
                          setCourierAdjustments(prev => ({ ...prev, [s.sku]: v }));
                        }}
                        placeholder="0"
                        className="w-20 text-[11px] font-mono text-right bg-white border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                      />
                      <span className="text-[10px] text-slate-400">원</span>
                      {adjustment > 0 && (
                        <span className="text-[11px] font-bold text-purple-700 ml-auto">조정후 {won(adjustedTotal)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">아직 클레임(환불) 데이터가 없습니다.</p>
          )}
        </div>

      </div>

      <ProductClaimTable stats={productClaimStatsThisMonth} monthLabel={latest?.label ?? "이번달"} />

      <ItemWeeklyClaimHeatmap rows={itemDailyAccidentPivot.rows} dates={itemDailyAccidentPivot.dates} />

      {/* 14일 일별 트렌드 */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <WidgetHeader
          title="최근 14일 일별 주문 · 매출 · 클레임비용 트렌드"
          subtitle="주문건수(막대, 배경) 대비 매출·클레임비용(선, 강조 — 둘 다 원 단위라 같은 오른쪽 축 공유)"
          icon={<TrendingDown className="h-4 w-4 text-slate-600 mt-0.5" />}
          meta={{
            기능: "최근 14일간 일별 주문건수를 배경으로, 매출과 클레임비용(환불+재발송비용 합산) 흐름을 겹쳐 이상 급증 구간을 빠르게 포착하기 위한 위젯. 매출/클레임비용은 둘 다 원 단위라 오른쪽 축 하나를 공유(축을 3개로 늘리지 않음)",
            소스: "orderItem CSV (결제일 기준)",
            수집방법: "결제일별 주문건수, 가격(매출)·환불금액·재발송비용 합계를 각각 집계",
            계산식: "클레임비용(일별) = 환불금액+재발송비용 합산 / 매출(일별) = Σ orderItem.가격",
          }}
        />
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e1e0d9" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#898781" }} axisLine={false} tickLine={false} width={32} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${Math.round(v / 10_000)}만`} tick={{ fontSize: 10, fill: "#898781" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(value: number, name: string) => (name === "주문건수" ? [`${value}건`, name] : [won(value), name])}
              contentStyle={{ borderRadius: 12, border: "1px solid #e1e0d9", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="orderCount" fill="#e1e0d9" radius={[4, 4, 0, 0]} barSize={14} name="주문건수" />
            <Line yAxisId="right" type="monotone" dataKey="salesAmount" stroke="#7cb342" strokeWidth={2} dot={{ r: 4, fill: "#7cb342", stroke: "#fff", strokeWidth: 2 }} name="매출">
              <LabelList dataKey="salesAmount" position="top" formatter={(v: number) => (v >= maxDailySales * 0.85 && v > 0 ? won(v) : "")} style={{ fontSize: 10, fill: "#7cb342", fontWeight: 700 }} />
            </Line>
            <Line yAxisId="right" type="monotone" dataKey="claimCost" stroke="#e34948" strokeWidth={2} dot={{ r: 4, fill: "#e34948", stroke: "#fff", strokeWidth: 2 }} name="클레임비용">
              <LabelList dataKey="claimCost" position="top" formatter={(v: number) => (v > 350_000 ? won(v) : "")} style={{ fontSize: 10, fill: "#e34948", fontWeight: 700 }} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <MethodBreakdownTrendChart weeks={methodBreakdownByWeek} />

      <DispatchFailureWidget />
    </ClaimCostShell>
  );
}

type ProductSortKey = "claimCount" | "claimRate" | "refundAmountSum" | "reshipCostSum" | "totalCost";

const productSortValue = (s: ProductClaimStat, key: ProductSortKey) =>
  key === "totalCost" ? s.refundAmountSum + s.reshipCostSum : s[key];

// ============================================================================
// ProductClaimTable — "이번달 상품별 클레임 전체 현황". Top3 위젯과 달리 slice 없이 전체 상품을
// 보여주는 조회 전용 표(택배사 정산 조정 입력은 Top3 위젯에만 있음, 여기엔 없음).
// ============================================================================
function ProductClaimTable({ stats, monthLabel }: { stats: ProductClaimStat[]; monthLabel: string }) {
  const { orderItems, problemForms, yoyReferenceAggregates } = useReviews();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ProductSortKey>("claimCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let list = stats;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.sku.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const diff = productSortValue(a, sortKey) - productSortValue(b, sortKey);
      return sortDir === "desc" ? -diff : diff;
    });
  }, [stats, search, sortKey, sortDir]);

  // 검색어로 걸러진 행들이 전부 같은 기준상품(사이즈/색상 앞부분)이면, 그 상품의 이번달/전월/작년
  // 동월 클레임율을 한눈에 보여주는 상세 패널을 띄운다 — 표에 컬럼을 항상 추가하는 대신 검색했을
  // 때만 나타나서 평소엔 표가 지저분해지지 않는다.
  const searchedProductDetail = useMemo(() => {
    if (!search.trim() || filtered.length === 0) return null;
    const baseNames = new Set(filtered.map(s => s.sku.split("/")[0].trim()));
    if (baseNames.size !== 1) return null;
    const baseName = Array.from(baseNames)[0];

    const { currentMonth, priorMonth, yoyMonth } = computeSeasonalCompareMonths();
    const currentAndPrior = computeProductMonthAggregates(orderItems, problemForms);
    const yoySource = resolveYoyAggregateSource(currentAndPrior, yoyReferenceAggregates, yoyMonth);
    const find = (arr: ProductMonthAggregate[], month: string) => arr.find(a => a.product === baseName && a.month === month);

    return {
      baseName,
      current: { label: `이번달(${currentMonth})`, agg: find(currentAndPrior, currentMonth) },
      prior: { label: `전월(${priorMonth})`, agg: find(currentAndPrior, priorMonth) },
      yoy: { label: `작년 동월(${yoyMonth})`, agg: find(yoySource, yoyMonth) },
    };
  }, [search, filtered, orderItems, problemForms, yoyReferenceAggregates]);

  const handleSort = (key: ProductSortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const totalClaimCount = stats.reduce((s, x) => s + x.claimCount, 0);
  const totalRefundAmount = stats.reduce((s, x) => s + x.refundAmountSum, 0);
  const totalReshipCost = stats.reduce((s, x) => s + x.reshipCostSum, 0);
  const totalClaimCost = totalRefundAmount + totalReshipCost;

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: ProductSortKey }) => (
    <button
      onClick={() => handleSort(sortKeyName)}
      className="inline-flex items-center gap-1 hover:text-purple-700 transition cursor-pointer"
    >
      <span>{label}</span>
      <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyName ? "text-purple-600" : "text-slate-300"}`} />
    </button>
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <WidgetHeader
        title={`${monthLabel} 상품별 클레임 전체 현황`}
        subtitle={`클레임건수 순, 전체 ${stats.length}개 상품 (총 ${totalClaimCount}건 · 총 클레임비용 ${won(totalClaimCost)})`}
        icon={<ListChecks className="h-4 w-4 text-purple-600 mt-0.5" />}
        meta={{
          기능: "이번달(결제일 기준) 전체 상품의 클레임 현황을 Top3 제한 없이 모두 보여주는 표. Top3 위젯과 동일한 계산 로직을 월 필터만 다르게 재사용",
          소스: "orderItem CSV + problemForm CSV (\"주문 아이템\" FK 조인)",
          수집방법: "computeProductClaimStats(orderItems, problemForms, 이번달)로 상품별 group by, 클레임건수 내림차순 전체 반환",
          계산식: "클레임율(%) = 상품별 클레임건수/상품별 주문건수×100 — Top3 위젯과 동일 공식. 총 클레임비용 = 환불액 합계 + 재발송비용 합계(순수 재발송·교환은 환불액이 0이라도 재발송비용이 발생함)",
        }}
      />

      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-900 leading-relaxed">
          "사고접수" 탭과 이 표의 건수가 다르게 보일 수 있는 이유 두 가지: ① 이 표는 <b>원주문의
          결제월</b> 기준입니다 — 사고가 이번 달에 접수됐어도 원주문이 지난달에 결제됐다면 지난달
          표에 잡힙니다("사고접수" 탭은 반대로 <b>접수일</b> 기준). ② 이번달처럼 아직 <b>성숙
          윈도우(수령일+7일)</b>가 안 지난 상품은 사고접수 기한이 남아있어 앞으로 건수가 더 늘어날
          수 있는 잠정치입니다(위 "잠정치" 안내 참고). 둘 다 계산이 틀린 게 아니라 보는 기준·시점이
          다른 것뿐입니다.
        </p>
      </div>

      <div className="relative max-w-xs mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="상품명 검색..."
          className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white"
        />
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
      </div>

      {searchedProductDetail && (
        <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50/50 p-3">
          <p className="text-[11px] font-bold text-purple-800 mb-2">"{searchedProductDetail.baseName}" 기간별 클레임율</p>
          <div className="grid grid-cols-3 gap-2">
            {[searchedProductDetail.prior, searchedProductDetail.yoy, searchedProductDetail.current].map((period, i) => (
              <div key={i} className={`rounded-lg bg-white px-2.5 py-1.5 border ${period === searchedProductDetail.current ? "border-purple-300" : "border-slate-100"}`}>
                <p className={`text-[9px] font-bold ${period === searchedProductDetail.current ? "text-purple-500" : "text-slate-400"}`}>{period.label}</p>
                {period.agg ? (
                  <p className={`text-[11px] font-bold ${period === searchedProductDetail.current ? "text-purple-700" : "text-slate-600"}`}>
                    {period.agg.orderCount > 0 ? Math.round((period.agg.accidentCount / period.agg.orderCount) * 1000) / 10 : 0}%{" "}
                    <span className="text-slate-400 font-medium">({period.agg.accidentCount}/{period.agg.orderCount}건)</span>
                  </p>
                ) : (
                  <p className="text-[11px] font-medium text-slate-300">데이터 없음</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-12">{monthLabel}에 접수된 클레임이 없습니다.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-12">검색 결과가 없습니다.</p>
      ) : (
        <div className="max-h-[480px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3">순위</th>
                <th className="py-2 px-3">상품명</th>
                <th className="py-2 px-3"><SortHeader label="클레임건수" sortKeyName="claimCount" /></th>
                <th className="py-2 px-3"><SortHeader label="클레임율" sortKeyName="claimRate" /></th>
                <th className="py-2 px-3"><SortHeader label="환불액" sortKeyName="refundAmountSum" /></th>
                <th className="py-2 px-3"><SortHeader label="재발송비용" sortKeyName="reshipCostSum" /></th>
                <th className="py-2 px-3"><SortHeader label="총 클레임비용" sortKeyName="totalCost" /></th>
                <th className="py-2 px-3">주요 사고유형</th>
                <th className="py-2 px-3">처리방법</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s, idx) => (
                <tr key={s.sku} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-slate-800 max-w-[180px] truncate" title={s.sku}>{s.sku}</td>
                  <td className="py-2 px-3 font-black text-purple-700">{s.claimCount}건</td>
                  <td className={`py-2 px-3 font-bold ${s.claimRate >= 20 ? "text-rose-600" : "text-slate-600"}`}>{s.claimRate}%</td>
                  <td className="py-2 px-3 font-mono text-slate-700">{won(s.refundAmountSum)}</td>
                  <td className="py-2 px-3 font-mono text-slate-700">
                    {s.reshipCostSum > 0 ? won(s.reshipCostSum) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-800">{won(s.refundAmountSum + s.reshipCostSum)}</td>
                  <td className="py-2 px-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap">
                      {s.mainCause}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {s.handlingBreakdown.length > 0 ? (
                        s.handlingBreakdown.map(h => (
                          <span key={h.method} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {h.method} {h.count}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-300">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-purple-50 border-t-2 border-purple-200 font-bold text-slate-800">
                <td className="py-2 px-3" colSpan={2}>합계 (전체 {stats.length}개 상품)</td>
                <td className="py-2 px-3 text-purple-700">{totalClaimCount}건</td>
                <td className="py-2 px-3">-</td>
                <td className="py-2 px-3 font-mono">{won(totalRefundAmount)}</td>
                <td className="py-2 px-3 font-mono">{won(totalReshipCost)}</td>
                <td className="py-2 px-3 font-mono text-purple-700">{won(totalClaimCost)}</td>
                <td className="py-2 px-3" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CsCostVerificationPanel — 어드민 "CS 비용 다운로드" export(주문번호 FK 없음)를 업로드해
// 같은 기간의 우리 계산 결과(OrderItem 기반)와 총합만 비교하는 선택적 진단 도구.
// verifyAccidentScopeReflectsRefund와 같은 "총합 비교" 패턴, 메인 데이터 모델과는 분리된 로컬 상태.
// ============================================================================
function CsCostVerificationPanel({ orderItems }: { orderItems: OrderItem[] }) {
  const { importCsCostExportRows } = useReviews();
  const [expanded, setExpanded] = useState(false);
  const [csvRawText, setCsvRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<CsCostExportParseResult | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 전역 상태(csCostExportRows)에도 반영 — 이 패널이 다시 접혀도 값이 유지되게. (Part D "26년 예상
  // 건당 코스트"는 이 데이터를 쓰지 않는다 — 조사 결과 인건비가 아니라 환불금액 재계산 사본이었음.)
  const applyParsed = (result: CsCostExportParseResult) => {
    setParsedResult(result);
    setPeriodStart(result.dateRange.start);
    setPeriodEnd(result.dateRange.end);
    importCsCostExportRows(result.rows);
  };

  const handleFile = (file: File) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        applyParsed(parseCSVToCsCostExport(event.target?.result as string));
      } catch (err) {
        alert("CSV 파싱 중 오류가 발생했습니다: " + (err as Error).message);
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => setIsParsing(false);
    reader.readAsText(file, "utf-8");
  };

  const handleTextParse = () => {
    if (!csvRawText.trim()) return;
    setIsParsing(true);
    try {
      applyParsed(parseCSVToCsCostExport(csvRawText));
    } catch (err) {
      alert("CSV 텍스트 파싱 오류: " + (err as Error).message);
    } finally {
      setIsParsing(false);
    }
  };

  const comparison = useMemo(() => {
    if (!parsedResult || !periodStart || !periodEnd) return null;
    return verifyClaimCostAgainstCsExport(orderItems, parsedResult.rows, periodStart, periodEnd);
  }, [orderItems, parsedResult, periodStart, periodEnd]);

  return (
    <div className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/30 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-bold text-slate-800">CS비용 검증 — 어드민 "CS 비용 다운로드" export와 총합 비교</span>
          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide">
            선택사항 · 대조용
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                이 export는 주문번호 FK가 없어 메인 계산(OrderItem/ProblemForm 조인)에는 쓰이지 않습니다.
                같은 기간을 대략 비교해 우리 계산(환불금액+재발송비용)과 크게 어긋나지 않는지만 확인하는 용도입니다.
                ⚠️ 위쪽의 "사고접수(ProblemForm) CSV 업로드"(메인 임포터)와는 스키마가 다른 별도 파일이니,
                이 박스에만 올려주세요 — 메인 임포터에 올리면 아무것도 반영되지 않습니다.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>CSV 파일 업로드</span>
                </button>
                <span className="text-[11px] text-slate-400">또는 아래에 텍스트로 붙여넣기</span>
              </div>

              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  placeholder="id,접수일,상태,처리방법,상품명,상품 사이즈명,상품 색상명,배송타입,사고 처리 비율 %,CS 비용(원)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-400"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleTextParse}
                    disabled={isParsing || !csvRawText.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>파싱</span>
                  </button>
                </div>
              </div>

              {parsedResult && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700">
                    {parsedResult.validCount}건 파싱됨 (총 CS비용 {won(parsedResult.totalCsCost)}, {parsedResult.dateRange.start}~{parsedResult.dateRange.end})
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">비교 시작일</span>
                      <input
                        type="text"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        placeholder="YYYY.MM.DD"
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">종료일</span>
                      <input
                        type="text"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        placeholder="YYYY.MM.DD"
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                      />
                    </label>
                  </div>

                  {comparison && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">우리 계산(결제일 기준)</span>
                        <span className="text-sm font-bold text-slate-900">{won(comparison.ourClaimCostTotal)}</span>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">CS export(접수일 기준)</span>
                        <span className="text-sm font-bold text-slate-900">{won(comparison.csExportTotal)}</span>
                      </div>
                      <div className={`rounded-xl p-3 border col-span-2 ${Math.abs(comparison.diffPct) <= 10 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
                        <span className="text-[10px] font-bold block uppercase text-slate-500">차이</span>
                        <span className="text-sm font-bold text-slate-900">
                          {won(comparison.diff)} ({comparison.diffPct >= 0 ? "+" : ""}{comparison.diffPct}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// ClaimCostShell — 상단 배너 + CSV 업로드 모달 (목업엔 없던 실데이터 연동 부분).
// OrderItem/ProblemForm 두 CSV 종류를 csvKind 토글로 같은 모달에서 올린다.
// 자식으로 KPI/차트 섹션을 받아 감싸는 레이아웃 셸.
// ============================================================================
function ClaimCostShell({
  children, showCSVModal, setShowCSVModal, csvKind, openCsvModal, activeImportTab, setActiveImportTab,
  csvRawText, setCsvRawText, isParsingCSV, orderParsedResult, setOrderParsedResult,
  pfParsedResult, setPfParsedResult, pfImportChannel, setPfImportChannel,
  importMode, setImportMode, importSuccessMsg, isDragging, setIsDragging,
  fileInputRef, handleFileProcess, handleTextParse, handleApplyCurrent, isSyncing, orderItemCount, problemFormCount,
  problemFormFlowergoCount
}: {
  children: ReactNode;
  showCSVModal: boolean; setShowCSVModal: (v: boolean) => void;
  csvKind: "orderItem" | "problemForm"; openCsvModal: (kind: "orderItem" | "problemForm") => void;
  activeImportTab: "file" | "paste"; setActiveImportTab: (v: "file" | "paste") => void;
  csvRawText: string; setCsvRawText: (v: string) => void;
  isParsingCSV: boolean;
  orderParsedResult: OrderItemParseResult | null; setOrderParsedResult: (v: OrderItemParseResult | null) => void;
  pfParsedResult: ProblemFormParseResult | null; setPfParsedResult: (v: ProblemFormParseResult | null) => void;
  pfImportChannel: "일반" | "플라워고"; setPfImportChannel: (v: "일반" | "플라워고") => void;
  importMode: "append" | "replace"; setImportMode: (v: "append" | "replace") => void;
  importSuccessMsg: string | null; isDragging: boolean; setIsDragging: (v: boolean) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileProcess: (file: File) => void; handleTextParse: () => void;
  handleApplyCurrent: () => void; isSyncing: boolean; orderItemCount: number; problemFormCount: number;
  problemFormFlowergoCount: number;
}) {
  const accent = csvKind === "orderItem" ? "indigo" : "rose";
  const accentClasses = {
    indigo: {
      border: "border-indigo-200", headerBorder: "border-indigo-100", icon: "text-indigo-600",
      btn: "bg-indigo-600 hover:bg-indigo-700", activeTab: "bg-indigo-600 text-white shadow-2xs",
      dropHover: "border-indigo-400 hover:bg-indigo-50/20", dropActive: "border-indigo-500 bg-indigo-50/50",
      iconChip: "bg-indigo-100 text-indigo-700", ring: "focus:ring-indigo-500", radio: "text-indigo-600 focus:ring-indigo-500",
      previewBorder: "border-indigo-200 bg-indigo-50/20", previewHeaderBorder: "border-indigo-100", previewValue: "text-indigo-700"
    },
    rose: {
      border: "border-rose-200", headerBorder: "border-rose-100", icon: "text-rose-600",
      btn: "bg-rose-600 hover:bg-rose-700", activeTab: "bg-rose-600 text-white shadow-2xs",
      dropHover: "border-rose-400 hover:bg-rose-50/20", dropActive: "border-rose-500 bg-rose-50/50",
      iconChip: "bg-rose-100 text-rose-700", ring: "focus:ring-rose-500", radio: "text-rose-600 focus:ring-rose-500",
      previewBorder: "border-rose-200 bg-rose-50/20", previewHeaderBorder: "border-rose-100", previewValue: "text-rose-700"
    }
  }[accent];

  const clearParsedResult = () => { setOrderParsedResult(null); setPfParsedResult(null); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* 상단 배너 */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/40 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white shadow-sm">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                매출 / 클레임비용 현황
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  OrderItem + ProblemForm 실데이터 연동
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                주문 {orderItemCount}건 · 사고접수 {problemFormCount}건
                {problemFormFlowergoCount > 0 && ` (이 중 플라워고 ${problemFormFlowergoCount}건)`} 데이터 보유
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openCsvModal("orderItem")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>주문(OrderItem) CSV 업로드</span>
            </button>
            <button
              onClick={() => openCsvModal("problemForm")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>사고접수(ProblemForm) CSV 업로드</span>
            </button>
          </div>
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
            <div className={`rounded-3xl border ${accentClasses.border} bg-white p-6 shadow-sm space-y-5`}>
              <div className={`flex items-center justify-between border-b ${accentClasses.headerBorder} pb-3`}>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`h-5 w-5 ${accentClasses.icon}`} />
                  <h4 className="text-sm font-bold text-slate-900">
                    {csvKind === "orderItem" ? "주문(OrderItem) 전용 CSV 데이터 임포터" : "사고접수(ProblemForm) 전용 CSV 데이터 임포터"}
                  </h4>
                </div>
                <button
                  onClick={() => { setShowCSVModal(false); clearParsedResult(); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* CSV 종류 토글 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openCsvModal("orderItem")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    csvKind === "orderItem" ? "bg-indigo-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  주문(OrderItem)
                </button>
                <button
                  onClick={() => openCsvModal("problemForm")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    csvKind === "problemForm" ? "bg-rose-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  사고접수(ProblemForm)
                </button>
              </div>

              {/* 사고접수 CSV 수집 채널 선택 — 일반/플라워고는 스키마가 거의 같아 CSV 자체에 구분
                  컬럼이 없으므로, 업로드 시점에 사용자가 직접 태그해야 한다. */}
              {csvKind === "problemForm" && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-3">
                  <span className="text-xs font-bold text-slate-700 shrink-0">이 CSV의 수집 채널</span>
                  <div className="flex items-center gap-2">
                    {(["일반", "플라워고"] as const).map(ch => (
                      <button
                        key={ch}
                        onClick={() => setPfImportChannel(ch)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          pfImportChannel === ch ? "bg-rose-600 text-white shadow-2xs" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {pfImportChannel === "플라워고"
                      ? "flowergoproblemform 엔드포인트 export를 올릴 때 선택하세요."
                      : "일반 bloom/problems/problemform 엔드포인트 export는 기본값 그대로 두면 됩니다."}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveImportTab("file")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeImportTab === "file" ? accentClasses.activeTab : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  파일 업로드 (.csv)
                </button>
                <button
                  onClick={() => setActiveImportTab("paste")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeImportTab === "paste" ? accentClasses.activeTab : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                    isDragging ? accentClasses.dropActive : `border-slate-200 bg-slate-50/50 ${accentClasses.dropHover}`
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
                    <div className={`rounded-full p-3 ${accentClasses.iconChip}`}>
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      {csvKind === "orderItem" ? "OrderItem" : "ProblemForm"} CSV 파일을 드래그하여 놓거나 클릭하여 업로드
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {csvKind === "orderItem"
                        ? "지원 열: 결제일, 그룹주문번호, 주문번호, 상품 상세 명, 수령일, 가격, 정산 가격, 수량, 환불금액 등"
                        : "지원 열: 주문 아이템, 사고 유형, 상세 유형, 처리 방법, 생산자 정산, 상태, 환불 금액, (있으면) 택배사 정산"}
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
                      csvKind === "orderItem"
                        ? "결제일,주문번호,상품 상세 명,수령일,가격,정산 가격,환불금액\n2026.06.25,20260625-001,자리공,2026.06.27,32000,18500,0"
                        : "주문 아이템,사고 유형,상세 유형,처리 방법,생산자 정산,상태,환불 금액\n20260625-001,품질 이상,꺾임/파손,재발송,본사부담,처리완료,0"
                    }
                    className={`w-full rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 ${accentClasses.ring}`}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleTextParse}
                      disabled={isParsingCSV || !csvRawText.trim()}
                      className={`inline-flex items-center gap-2 rounded-xl ${accentClasses.btn} text-white px-5 py-2 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50`}
                    >
                      {isParsingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>텍스트 파싱 및 검증</span>
                    </button>
                  </div>
                </div>
              )}

              {orderParsedResult && csvKind === "orderItem" && (
                <div className={`rounded-2xl border ${accentClasses.previewBorder} p-5 space-y-4`}>
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${accentClasses.previewHeaderBorder} pb-3`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        파싱 검증 완료: 총 <span className={`${accentClasses.previewValue} font-extrabold`}>{orderParsedResult.validCount}</span>건 주문
                      </h5>
                    </div>
                    <ImportModeToggle importMode={importMode} setImportMode={setImportMode} accentClasses={accentClasses} />
                  </div>

                  {orderParsedResult.isLikelyWrongFileType ? (
                    <SchemaMismatchError
                      detectedColumns={orderParsedResult.detectedColumns}
                      guidance={`어드민 주문(OrderItem) 목록의 "내보내기" 버튼으로 받은 CSV가 맞는지 확인해주세요.`}
                    />
                  ) : orderParsedResult.missingCriticalColumns.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">다음 필수 컬럼을 인식하지 못했습니다: {orderParsedResult.missingCriticalColumns.join(", ")}.</span>{" "}
                        CSV 헤더명을 확인해주세요 — 인식 못한 값은 기본값으로 채워지거나 해당 행이 통째로 제외될 수 있습니다.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">총 건수</span>
                      <span className="text-sm font-bold text-slate-900">{orderParsedResult.validCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-orange-50 p-3 border border-orange-100">
                      <span className="text-[10px] text-orange-700 font-bold block uppercase">재발송(-CS) 건</span>
                      <span className="text-sm font-bold text-orange-950">{orderParsedResult.reshipCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100 col-span-2">
                      <span className="text-[10px] text-indigo-700 font-bold block uppercase">총 환불 금액</span>
                      <span className="text-sm font-bold text-indigo-950">{orderParsedResult.totalRefundAmount.toLocaleString()} 원</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setOrderParsedResult(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer">취소</button>
                    <button
                      onClick={handleApplyCurrent}
                      disabled={isSyncing}
                      className={`inline-flex items-center gap-2 rounded-xl ${accentClasses.btn} text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50`}
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>매출/클레임비용 대시보드에 즉시 반영 ({orderParsedResult.validCount}건)</span>
                    </button>
                  </div>
                </div>
              )}

              {pfParsedResult && csvKind === "problemForm" && (
                <div className={`rounded-2xl border ${accentClasses.previewBorder} p-5 space-y-4`}>
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${accentClasses.previewHeaderBorder} pb-3`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h5 className="text-sm font-bold text-slate-900">
                        파싱 검증 완료: 총 <span className={`${accentClasses.previewValue} font-extrabold`}>{pfParsedResult.validCount}</span>건 사고접수
                      </h5>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        pfImportChannel === "플라워고" ? "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200" : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        수집채널: {pfImportChannel}
                      </span>
                    </div>
                    <ImportModeToggle importMode={importMode} setImportMode={setImportMode} accentClasses={accentClasses} />
                  </div>

                  {pfParsedResult.isLikelyWrongFileType ? (
                    <SchemaMismatchError
                      detectedColumns={pfParsedResult.detectedColumns}
                      guidance={`어드민 사고접수 목록의 "내보내기" 버튼으로 받은 CSV를 올려주세요. 어드민의 "CS 비용 다운로드"로 받은 파일이라면 이 탭 아래쪽의 "CS비용 검증(선택)" 박스에 넣어주세요 — 이 메인 업로드 칸과는 스키마가 다릅니다.`}
                    />
                  ) : pfParsedResult.missingCriticalColumns.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">다음 필수 컬럼을 인식하지 못했습니다: {pfParsedResult.missingCriticalColumns.join(", ")}.</span>{" "}
                        특히 주문번호(FK)를 못 찾으면 모든 행이 조인 불가로 조용히 제외되니 CSV 헤더명을 꼭 확인해주세요.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-white p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">총 건수</span>
                      <span className="text-sm font-bold text-slate-900">{pfParsedResult.validCount} 건</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">채널 종류</span>
                      <span className="text-sm font-bold text-slate-900">
                        {new Set(pfParsedResult.problemForms.map(p => p.channel).filter(Boolean)).size || "미기재"}
                        {new Set(pfParsedResult.problemForms.map(p => p.channel).filter(Boolean)).size > 0 ? "종 (통합 처리)" : ""}
                      </span>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-3 border border-rose-100 col-span-2">
                      <span className="text-[10px] text-rose-700 font-bold block uppercase">총 환불 금액</span>
                      <span className="text-sm font-bold text-rose-950">{pfParsedResult.totalRefundAmount.toLocaleString()} 원</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setPfParsedResult(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-3 py-2 rounded-xl transition cursor-pointer">취소</button>
                    <button
                      onClick={handleApplyCurrent}
                      disabled={isSyncing}
                      className={`inline-flex items-center gap-2 rounded-xl ${accentClasses.btn} text-white px-6 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50`}
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span>매출/클레임비용 대시보드에 즉시 반영 ({pfParsedResult.validCount}건)</span>
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

      {children}
    </motion.div>
  );
}

// 적용 방식(전체 교체/기존 병합) 라디오 토글 — OrderItem/ProblemForm 미리보기 패널에서 공용으로 사용
function ImportModeToggle({
  importMode, setImportMode, accentClasses
}: {
  importMode: "append" | "replace"; setImportMode: (v: "append" | "replace") => void;
  accentClasses: { radio: string };
}) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
      <span>적용 방식:</span>
      <label className="flex items-center gap-1 cursor-pointer">
        <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className={accentClasses.radio} />
        <span>전체 교체 (Replace)</span>
      </label>
      <label className="flex items-center gap-1 cursor-pointer ml-2">
        <input type="radio" checked={importMode === "append"} onChange={() => setImportMode("append")} className={accentClasses.radio} />
        <span>기존 병합 (Append)</span>
      </label>
    </div>
  );
}

// ============================================================================
// StatTile — 상단 KPI 카드
// ============================================================================
function StatTile({
  label, value, subtext, delta, deltaUnit = "건", deltaGoodDirection, deltaLabel = "전월 대비", icon, color, meta,
}: {
  label: string;
  value: string;
  subtext?: string;
  delta?: number;
  deltaUnit?: string;
  deltaGoodDirection?: "up" | "down";
  deltaLabel?: string;
  icon: ReactNode;
  color: "indigo" | "rose" | "amber" | "emerald" | "sky" | "violet";
  meta: WidgetMeta;
}) {
  const colorMap = {
    indigo: { bg: "bg-indigo-50/40", border: "border-indigo-100", text: "text-indigo-700", iconBg: "bg-indigo-100 text-indigo-700" },
    rose: { bg: "bg-rose-50/40", border: "border-rose-100", text: "text-rose-700", iconBg: "bg-rose-100 text-rose-700" },
    amber: { bg: "bg-amber-50/40", border: "border-amber-100", text: "text-amber-700", iconBg: "bg-amber-100 text-amber-700" },
    emerald: { bg: "bg-emerald-50/40", border: "border-emerald-100", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-700" },
    sky: { bg: "bg-sky-50/40", border: "border-sky-100", text: "text-sky-700", iconBg: "bg-sky-100 text-sky-700" },
    violet: { bg: "bg-violet-50/40", border: "border-violet-100", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-700" },
  }[color];

  let deltaIsGood: boolean | null = null;
  if (delta !== undefined && deltaGoodDirection) {
    deltaIsGood = deltaGoodDirection === "up" ? delta >= 0 : delta <= 0;
  }

  return (
    <div className={`rounded-3xl border ${colorMap.border} ${colorMap.bg} p-5 shadow-2xs relative`}>
      <div className="flex items-start justify-between">
        <div className={`rounded-2xl p-2.5 ${colorMap.iconBg}`}>{icon}</div>
        <WidgetInfoTip meta={meta} />
      </div>
      <p className="text-xs font-bold text-slate-500 mt-3">{label}</p>
      <h3 className="text-xl font-black text-slate-900 mt-1">{value}</h3>
      {subtext && <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>}
      {delta !== undefined && (
        <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${deltaIsGood ? "text-emerald-600" : "text-rose-600"}`}>
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {deltaLabel} {delta >= 0 ? "+" : ""}{delta}{deltaUnit}
        </p>
      )}
    </div>
  );
}
