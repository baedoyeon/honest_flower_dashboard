import { OrderItem } from "../data/orderItems";
import { ProblemForm } from "../data/problemForms";
import { CsCostExportRow } from "./csvParser";

export interface ClaimCostCohort {
  paymentDate: string; // 결제일 (YYYY.MM.DD)
  orderCount: number;
  refundTotal: number;
  reshipCostTotal: number;
  claimCostTotal: number; // refundTotal + reshipCostTotal
  isProvisional: boolean; // 코호트 내 주문 중 하나라도 미성숙(수령일 + 7일 미경과)이면 true
}

const MATURITY_WINDOW_DAYS = 7;

// Parse "YYYY.MM.DD" into a local Date at midnight; invalid/empty strings are treated as immature (never matures)
function parseDateStr(dateStr: string): Date | null {
  const parts = dateStr.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 배송완료(수령일) 후 7일 성숙 윈도우가 지났는지 여부 — 내부 정책상 수령일+7일 이내만 사고접수 가능하므로,
// 그 이전에는 아직 접수될 사고가 더 남아있을 수 있어 코호트 비용이 잠정치(IBNR과 동일한 개념)임
export function isCohortMature(deliveryDateStr: string, today: Date = new Date()): boolean {
  const deliveryDate = parseDateStr(deliveryDateStr);
  if (!deliveryDate) return false;
  const matureAt = addDays(deliveryDate, MATURITY_WINDOW_DAYS);
  return today >= matureAt;
}

// 클레임 비용은 결제일 기준으로 그 결제 코호트에 귀속된다(수령일/사고접수일 기준 아님).
// -CS 재발송 주문은 그룹주문번호로 원본 주문과 매칭해 원본의 결제일 코호트에 정산가격을 합산한다.
export function computeClaimCostCohorts(orderItems: OrderItem[], today: Date = new Date()): ClaimCostCohort[] {
  const originalOrders = orderItems.filter(o => !o.isReshipCost && o.paymentDate);
  const reshipOrders = orderItems.filter(o => o.isReshipCost);

  const cohortMap = new Map<string, OrderItem[]>();
  originalOrders.forEach(order => {
    const list = cohortMap.get(order.paymentDate) || [];
    list.push(order);
    cohortMap.set(order.paymentDate, list);
  });

  const cohorts: ClaimCostCohort[] = [];

  cohortMap.forEach((orders, paymentDate) => {
    const refundTotal = orders.reduce((sum, o) => sum + (o.refundAmount || 0), 0);

    const groupKeys = new Set(orders.map(o => o.groupOrderNumber).filter(Boolean));
    const reshipCostTotal = reshipOrders
      .filter(r => r.groupOrderNumber && groupKeys.has(r.groupOrderNumber))
      .reduce((sum, r) => sum + (r.settlementPrice || 0), 0);

    const isProvisional = !orders.every(o => isCohortMature(o.deliveryDate, today));

    cohorts.push({
      paymentDate,
      orderCount: orders.length,
      refundTotal,
      reshipCostTotal,
      claimCostTotal: refundTotal + reshipCostTotal,
      isProvisional
    });
  });

  return cohorts.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}

// ============================================================================
// 목업(ClaimCostTab.tsx / claimCostDummyData.ts) 형태에 맞춘 실데이터 집계 함수.
// OrderItem CSV만으로는 claimCount(근사치)/처리방법(2종)/주요사고유형을 정확히 알 수 없었으나,
// ProblemForm CSV를 "주문 아이템" 필드(=OrderItem.orderNumber)로 조인하면 실제 값을 채울 수 있다.
// "생산자 정산"/"택배사 정산"은 ProblemForm에 필드로 보존은 하되(추후 재사용 대비), 계산/화면
// 표시에는 사용하지 않기로 확정됨(택배사 정산은 정산 주기가 리포팅 주기와 안 맞아 이번 스코프 제외).
// ============================================================================

export interface MonthlyClaimStat {
  month: string; // "YYYY-MM"
  label: string; // "M월"
  orderCount: number;
  salesAmount: number; // TODO(선택): 현재 orderItem.가격 합산 방식. 더 정확한 매출이 필요하면
                        // /bloom/dashboard/dailystat 스타일 일별 집계 API 연동을 고려할 것(미착수).
  claimCount: number; // 환불 또는 재발송이 발생한 주문 건수(OrderItem 기준 근사치)
  refundAmountTotal: number;
  reshipCostTotal: number; // 실제 산출 가능
  isProvisional: boolean; // 그 달 주문 중 하나라도 성숙 윈도우(수령일+7일) 미경과
}

export interface DailyTrendPoint {
  date: string; // "MM-DD"
  orderCount: number;
  claimCount: number;
  claimCost: number; // refundAmountTotal + reshipCostTotal (그날 결제 코호트 기준)
  salesAmount: number; // 그날 결제 코호트 매출 합계(orderItem.가격)
}

export interface HandlingMethodStat {
  method: string;
  count: number;
}

export interface ProductClaimStat {
  sku: string;
  orderCount: number; // 해당 스코프(월 또는 전체 기간) 내 상품 주문건수 — 클레임율 계산 기반
  claimCount: number;
  claimRate: number;
  refundAmountSum: number; // 결제 수단으로 환불된 현금 환불액 합계 (OrderItem.refundAmount)
  reshipCostSum: number; // 재발송(-CS) 정산가 합계 — 순수 재발송/교환 클레임은 refundAmountSum이 0이어도 이 비용이 발생함
  mainCause: string; // ProblemForm 조인 성공 시 실제 최다 사고유형, 매칭 안 되면 미분류 표시
  handlingBreakdown: HandlingMethodStat[]; // 상품별 처리방법 breakdown (ProblemForm 매칭분만)
}

export interface AccidentScopeCheckResult {
  matchedCount: number; // orderItem.가격과 problemForm.사고 범위(%)·환불금액이 모두 있는 매칭 건수
  closeCount: number; // 기대 환불액(가격×사고범위%)과 실제 환불금액이 5% 오차 이내로 근접한 건수
  divergentCount: number;
  divergentSamples: { orderNumber: string; accidentScope: number; expectedRefund: number; actualRefund: number }[];
}

export const calcClaimRate = (claimCount: number, orderCount: number) =>
  orderCount > 0 ? Math.round((claimCount / orderCount) * 1000) / 10 : 0;

export const calcClaimCostPerSales = (claimCostTotal: number, salesAmount: number) =>
  salesAmount > 0 ? Math.round((claimCostTotal / salesAmount) * 10000) / 100 : 0; // %

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function monthKeyOf(paymentDate: string): string {
  const parts = paymentDate.split(".");
  if (parts.length < 2) return "";
  return `${parts[0]}-${parts[1]}`;
}

function reshipCostForGroupKeys(reshipOrders: OrderItem[], groupKeys: Set<string | undefined>): number {
  return reshipOrders
    .filter(r => r.groupOrderNumber && groupKeys.has(r.groupOrderNumber))
    .reduce((sum, r) => sum + (r.settlementPrice || 0), 0);
}

function buildOrderNumberMap(orderItems: OrderItem[]): Map<string, OrderItem> {
  const map = new Map<string, OrderItem>();
  orderItems.forEach(o => { if (o.orderNumber) map.set(o.orderNumber, o); });
  return map;
}

function buildProblemFormsByOrderNumber(problemForms: ProblemForm[]): Map<string, ProblemForm[]> {
  const map = new Map<string, ProblemForm[]>();
  problemForms.forEach(p => {
    const list = map.get(p.orderItemRef) || [];
    list.push(p);
    map.set(p.orderItemRef, list);
  });
  return map;
}

function buildReshipsByGroup(reshipOrders: OrderItem[]): Map<string, OrderItem[]> {
  const map = new Map<string, OrderItem[]>();
  reshipOrders.forEach(r => {
    if (!r.groupOrderNumber) return;
    const list = map.get(r.groupOrderNumber) || [];
    list.push(r);
    map.set(r.groupOrderNumber, list);
  });
  return map;
}

interface ItemClaimResolution {
  isClaim: boolean;
  refundAmount: number;
}

// 주문-아이템(orderNumber, 장바구니 내 특정 라인) 단위로 클레임 여부와 확정 환불액을 판정한다.
// ProblemForm이 있으면 이 아이템 자신의 orderNumber에 연결된 정밀 매칭을 최우선 신뢰한다 —
// groupOrderNumber(장바구니) 전체로 판단하면 같은 장바구니에 우연히 같이 담긴 무관한 상품까지
// 클레임으로 잘못 집계되는 문제가 실측으로 확인됐다("아세비" 반복 사고 건에 무관한 동반상품
// 10건이 잘못 집계됨). "이 아이템의 상품명이 실제로 재발송 행에 등장하는가"(productReshipped)만
// 예외로 허용해, 이 아이템 자체의 ProblemForm 레코드가 없어도 진짜 재발송된 자기 상품은 놓치지
// 않는다(대체발송 케이스는 반대로 원래 상품의 PF 기록이 별도로 있어 pfHandled로 잡힘).
// ProblemForm이 하나도 없으면(하위호환) groupOrderNumber 기준 근사치로 대체한다.
function resolveItemClaim(
  item: OrderItem,
  ownPfMatches: ProblemForm[],
  hasProblemFormData: boolean,
  groupReships: OrderItem[]
): ItemClaimResolution {
  const ownRefund = item.refundAmount || 0;
  if (hasProblemFormData) {
    const pfHandled = ownPfMatches.length > 0;
    const productReshipped = groupReships.some(r => r.product === item.product);
    const isClaim = ownRefund > 0 || pfHandled || productReshipped;
    const pfRefundSum = ownPfMatches.reduce((s, p) => s + (p.refundAmount || 0), 0);
    return { isClaim, refundAmount: ownRefund > 0 ? ownRefund : pfRefundSum };
  }
  const isClaim = ownRefund > 0 || groupReships.length > 0;
  return { isClaim, refundAmount: ownRefund };
}

// 월별 집계 — 결제일(YYYY-MM) 기준. YoY 비교는 컴포넌트 쪽에서 동일 월(MM)의 다른 연도를 찾아 처리한다.
// claimCount/refundAmountTotal은 resolveItemClaim으로 주문-아이템 단위 정밀 판정한다("생산자 정산"/
// "택배사 정산"은 여전히 계산에 쓰지 않음 — 그 부분만 확정된 스코프 제외 유지).
export function computeMonthlyStats(orderItems: OrderItem[], problemForms: ProblemForm[] = [], today: Date = new Date()): MonthlyClaimStat[] {
  const originals = orderItems.filter(o => !o.isReshipCost && o.paymentDate);
  const reships = orderItems.filter(o => o.isReshipCost);
  const hasProblemFormData = problemForms.length > 0;
  const reshipsByGroup = buildReshipsByGroup(reships);
  const problemFormsByOrderNumber = buildProblemFormsByOrderNumber(problemForms);

  const map = new Map<string, OrderItem[]>();
  originals.forEach(o => {
    const key = monthKeyOf(o.paymentDate);
    if (!key) return;
    const list = map.get(key) || [];
    list.push(o);
    map.set(key, list);
  });

  const stats: MonthlyClaimStat[] = [];
  map.forEach((orders, month) => {
    const orderCount = orders.length;
    const salesAmount = orders.reduce((s, o) => s + (o.price || 0), 0);

    let claimCount = 0;
    let refundAmountTotal = 0;
    orders.forEach(o => {
      const groupReships = (o.groupOrderNumber && reshipsByGroup.get(o.groupOrderNumber)) || [];
      const ownPf = problemFormsByOrderNumber.get(o.orderNumber) || [];
      const { isClaim, refundAmount } = resolveItemClaim(o, ownPf, hasProblemFormData, groupReships);
      if (isClaim) { claimCount++; refundAmountTotal += refundAmount; }
    });

    const groupKeys = new Set(orders.map(o => o.groupOrderNumber));
    const reshipCostTotal = reshipCostForGroupKeys(reships, groupKeys);
    const isProvisional = !orders.every(o => isCohortMature(o.deliveryDate, today));
    const m = Number(month.split("-")[1]);

    stats.push({
      month,
      label: `${m}월`,
      orderCount,
      salesAmount,
      claimCount,
      refundAmountTotal,
      reshipCostTotal,
      isProvisional
    });
  });

  return stats.sort((a, b) => a.month.localeCompare(b.month));
}

export interface SalesSkuStats {
  salesSkuCount: number; // 해당 기간 판매된 상품(SKU) 고유값 개수
  claimSkuCount: number; // 그중 클레임(ProblemForm)이 발생한 상품 고유값 개수
  claimSkuRatio: number; // claimSkuCount / salesSkuCount × 100 (%)
}

// 판매 SKU 종류 수 + 클레임 발생 SKU 비율 — 구글시트 yoy_monthly 탭의 "claim per sales sku"와 동일 개념.
// month("YYYY-MM")를 넘기면 그 결제월 코호트로 스코프를 좁히고, 생략하면 전체 기간.
// "SKU"는 이 대시보드의 상품 식별자인 OrderItem.product(= "상품 상세 명" 컬럼)를 그대로 쓴다 —
// 별도 SKU 코드 컬럼이 없어 상품명 자체가 SKU 단위 식별자 역할을 한다.
export function computeSalesSkuStats(orderItems: OrderItem[], problemForms: ProblemForm[], month?: string): SalesSkuStats {
  const originals = orderItems.filter(o => !o.isReshipCost && (!month || monthKeyOf(o.paymentDate) === month));
  const salesSkus = new Set(originals.map(o => o.product));

  const orderNumberMap = new Map<string, OrderItem>();
  originals.forEach(o => { if (o.orderNumber) orderNumberMap.set(o.orderNumber, o); });

  // 주문번호는 코호트(이 달에 결제된 주문인가) 확인용으로만 쓰고, 실제 상품 귀속은 ProblemForm
  // 자체의 productName을 우선한다 — 한 주문에 여러 상품이 담기면 주문번호가 전부 같아서
  // order.product만 쓰면 실제 사고가 난 상품과 다른 상품이 뽑힐 수 있다(실측으로 확인됨).
  const claimSkus = new Set<string>();
  problemForms.forEach(p => {
    const order = orderNumberMap.get(p.orderItemRef);
    if (!order) return;
    claimSkus.add(p.productName || order.product);
  });

  const salesSkuCount = salesSkus.size;
  const claimSkuCount = claimSkus.size;
  const claimSkuRatio = salesSkuCount > 0 ? Math.round((claimSkuCount / salesSkuCount) * 1000) / 10 : 0;

  return { salesSkuCount, claimSkuCount, claimSkuRatio };
}

// 최근 N일 일별 트렌드 — 결제일 기준, 데이터가 없는 날짜도 0으로 채워 연속된 시계열을 유지한다.
// claimCount/refund는 computeMonthlyStats와 동일하게 resolveItemClaim으로 정밀 판정한다.
export function computeDailyTrend(orderItems: OrderItem[], problemForms: ProblemForm[] = [], days: number = 14, today: Date = new Date()): DailyTrendPoint[] {
  const originals = orderItems.filter(o => !o.isReshipCost && o.paymentDate);
  const reships = orderItems.filter(o => o.isReshipCost);
  const hasProblemFormData = problemForms.length > 0;
  const reshipsByGroup = buildReshipsByGroup(reships);
  const problemFormsByOrderNumber = buildProblemFormsByOrderNumber(problemForms);

  const points: DailyTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    const dayOrders = originals.filter(o => o.paymentDate === key);
    const groupKeys = new Set(dayOrders.map(o => o.groupOrderNumber));
    const reshipCost = reshipCostForGroupKeys(reships, groupKeys);
    const salesAmount = dayOrders.reduce((s, o) => s + (o.price || 0), 0);

    let claimCount = 0;
    let refund = 0;
    dayOrders.forEach(o => {
      const groupReships = (o.groupOrderNumber && reshipsByGroup.get(o.groupOrderNumber)) || [];
      const ownPf = problemFormsByOrderNumber.get(o.orderNumber) || [];
      const { isClaim, refundAmount } = resolveItemClaim(o, ownPf, hasProblemFormData, groupReships);
      if (isClaim) { claimCount++; refund += refundAmount; }
    });

    points.push({
      date: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      orderCount: dayOrders.length,
      claimCount,
      claimCost: refund + reshipCost,
      salesAmount
    });
  }
  return points;
}

const HANDLING_METHOD_ORDER = ["재발송", "결제 수단으로 환불", "교환", "반품", "적립금 환불"];

// 처리방법 breakdown. ProblemForm이 있으면 "주문 아이템" FK로 OrderItem과 조인해 실제 처리방법
// 5종(재발송/결제 수단으로 환불/교환/반품/적립금 환불)을 그대로 집계한다.
// ProblemForm이 아직 없으면(하위 호환) OrderItem만으로 재발송 vs 그 외 환불 2종 근사치로 대체한다.
export function computeHandlingMethodStats(orderItems: OrderItem[], problemForms: ProblemForm[] = []): HandlingMethodStat[] {
  if (problemForms.length === 0) {
    const originals = orderItems.filter(o => !o.isReshipCost);
    const reshipGroupKeys = new Set(orderItems.filter(o => o.isReshipCost).map(o => o.groupOrderNumber));

    let reshipCount = 0;
    let refundCount = 0;
    originals.forEach(o => {
      if (o.groupOrderNumber && reshipGroupKeys.has(o.groupOrderNumber)) reshipCount++;
      else if ((o.refundAmount || 0) > 0) refundCount++;
    });

    return [
      { method: "재발송 (근사치)", count: reshipCount },
      { method: "결제 수단으로 환불 (근사치)", count: refundCount }
    ];
  }

  const orderNumberSet = new Set(orderItems.map(o => o.orderNumber).filter(Boolean));
  const counts = new Map<string, number>();
  problemForms.forEach(p => {
    if (!orderNumberSet.has(p.orderItemRef)) return; // OrderItem과 조인 안 되는 건 제외
    const method = p.handlingMethod || "기타";
    counts.set(method, (counts.get(method) || 0) + 1);
  });

  const result: HandlingMethodStat[] = HANDLING_METHOD_ORDER
    .filter(m => counts.has(m))
    .map(m => ({ method: m, count: counts.get(m)! }));

  counts.forEach((count, method) => {
    if (!HANDLING_METHOD_ORDER.includes(method)) result.push({ method, count });
  });

  return result;
}

// 상품(SKU)별 클레임 집계 — 전체 상품 목록을 클레임건수 내림차순으로 반환한다.
// month("YYYY-MM")를 넘기면 해당 결제월 코호트로 스코프를 좁히고(§1.3과 동일한 결제일 기준 귀속),
// 생략하면 기존처럼 전체 업로드 기간 기준으로 집계한다. ProblemForm이 있으면 "주문 아이템" FK로
// 조인해 실제 최다 사고유형(mainCause)과 상품별 처리방법 breakdown을 채운다.
// Top3 위젯은 이 함수를 호출한 뒤 앞에서 3개만 slice해서 쓴다(로직 중복 제거).
export function computeProductClaimStats(orderItems: OrderItem[], problemForms: ProblemForm[] = [], month?: string): ProductClaimStat[] {
  const originals = orderItems.filter(o => !o.isReshipCost && (!month || monthKeyOf(o.paymentDate) === month));
  const reships = orderItems.filter(o => o.isReshipCost);
  const hasProblemFormData = problemForms.length > 0;
  const reshipsByGroup = buildReshipsByGroup(reships);
  const problemFormsByOrderNumber = buildProblemFormsByOrderNumber(problemForms);

  // 이번 스코프(월/전체)의 원본 주문을 groupOrderNumber별로 묶어, 재발송비용을 "이 그룹에서 실제로
  // 재발송 처리된 상품"에만 귀속한다(ProblemForm 처리방법=재발송, 또는 자기 상품명이 재발송 행과
  // 일치) — groupOrderNumber 전체가 아니라 상품 단위로 좁혀서 대체발송(다른 상품으로 재발송) 케이스
  // 에서 엉뚱한 상품에 비용이 잘못 붙는 걸 방지한다(실측: 신지매 사고 건에 라임라이트 나무수국으로
  // 대체발송, 근거 없이 재발송 행 상품명만 썼다면 신지매가 아닌 라임라이트에 비용이 붙었을 것).
  // ProblemForm이 없으면(하위호환) 재발송 행 자체의 상품명으로 대체(과거 동작 유지).
  const groupsThisScope = new Map<string, OrderItem[]>();
  originals.forEach(o => {
    if (!o.groupOrderNumber) return;
    const list = groupsThisScope.get(o.groupOrderNumber) || [];
    list.push(o);
    groupsThisScope.set(o.groupOrderNumber, list);
  });
  const reshipCostByProduct = new Map<string, number>();
  groupsThisScope.forEach((items, groupKey) => {
    const groupReships = reshipsByGroup.get(groupKey) || [];
    if (groupReships.length === 0) return;
    const groupReshipCost = groupReships.reduce((s, r) => s + (r.settlementPrice || 0), 0);

    const targets = new Set<string>();
    if (hasProblemFormData) {
      items.forEach(item => {
        const ownPf = problemFormsByOrderNumber.get(item.orderNumber) || [];
        const reshipHandled = ownPf.some(p => p.handlingMethod === "재발송");
        const productReshipped = groupReships.some(r => r.product === item.product);
        if (reshipHandled || productReshipped) targets.add(item.product);
      });
    }

    if (targets.size > 0) {
      const share = groupReshipCost / targets.size;
      targets.forEach(product => reshipCostByProduct.set(product, (reshipCostByProduct.get(product) || 0) + share));
    } else {
      groupReships.forEach(r => reshipCostByProduct.set(r.product, (reshipCostByProduct.get(r.product) || 0) + (r.settlementPrice || 0)));
    }
  });

  const map = new Map<string, {
    orderCount: number; claimCount: number; refundSum: number;
    causes: Map<string, number>; handling: Map<string, number>;
  }>();

  originals.forEach(o => {
    const entry = map.get(o.product) || {
      orderCount: 0, claimCount: 0, refundSum: 0,
      causes: new Map<string, number>(), handling: new Map<string, number>()
    };
    entry.orderCount++;
    const groupReships = (o.groupOrderNumber && reshipsByGroup.get(o.groupOrderNumber)) || [];
    const ownPf = problemFormsByOrderNumber.get(o.orderNumber) || [];
    const { isClaim, refundAmount } = resolveItemClaim(o, ownPf, hasProblemFormData, groupReships);
    if (isClaim) {
      entry.claimCount++;
      entry.refundSum += refundAmount;
    }
    ownPf.forEach(p => {
      const cause = p.accidentDetail || p.accidentType;
      if (cause) entry.causes.set(cause, (entry.causes.get(cause) || 0) + 1);
      const method = p.handlingMethod || "기타";
      entry.handling.set(method, (entry.handling.get(method) || 0) + 1);
    });
    map.set(o.product, entry);
  });

  return Array.from(map.entries())
    .filter(([, v]) => v.claimCount > 0)
    .map(([sku, v]) => {
      let mainCause = "미분류 (ProblemForm 미매칭)";
      let maxCount = 0;
      v.causes.forEach((count, cause) => {
        if (count > maxCount) { maxCount = count; mainCause = cause; }
      });

      const handlingBreakdown: HandlingMethodStat[] = HANDLING_METHOD_ORDER
        .filter(m => v.handling.has(m))
        .map(m => ({ method: m, count: v.handling.get(m)! }));
      v.handling.forEach((count, method) => {
        if (!HANDLING_METHOD_ORDER.includes(method)) handlingBreakdown.push({ method, count });
      });

      return {
        sku,
        orderCount: v.orderCount,
        claimCount: v.claimCount,
        claimRate: calcClaimRate(v.claimCount, v.orderCount),
        refundAmountSum: v.refundSum,
        reshipCostSum: reshipCostByProduct.get(sku) || 0,
        mainCause,
        handlingBreakdown
      };
    })
    .sort((a, b) => b.claimCount - a.claimCount);
}

// ============================================================================
// 상품 × 주차 클레임 히트맵 — 구글시트 Y26_claim dashboard의 item_pivot 탭(상품×주차 건수/비율
// 크로스탭 2개)을 대시보드로 옮긴 것. 주차는 대시보드 상단 필터와 동일한 "월요일 시작" 기준.
// ============================================================================

export interface ItemDailyAccidentCell {
  date: string; // "YYYY.MM.DD"
  dateLabel: string; // "09.07(월)" — 요일까지 붙여서 표시
  count: number;
  shareOfDayTotal: number; // 0~100(%). 그날 전체 사고접수건수가 0이면 0.
}

export interface ItemDailyAccidentRow {
  item: string;
  totalCount: number; // 전체 기간 합계 — 정렬 및 Top20 선별 기준
  days: ItemDailyAccidentCell[]; // dates와 동일한 순서(오름차순)로 상품마다 전체 일자 채움(0 포함)
  // 이 상품의 전체 주문건수 대비 사고접수 비율(%) — orderItems를 안 넘기면 undefined.
  // ⚠️ computeProductClaimStats의 클레임율과 다르다: 여기는 ProblemForm↔OrderItem을 주문번호로
  // 정밀 조인하지 않고(그 조인은 이 위젯이 의도적으로 안 쓰기로 한 부분), 그냥 "상품별 사고접수
  // 원시 건수 ÷ 상품별 전체 주문건수"로 근사한 값이다 — 참고용 비율이지 확정 클레임율이 아니다.
  claimRate?: number;
  orderCount?: number;
}

// 대시보드의 "월요일 시작" 주차 정의와 통일 — ReviewsContext.tsx의 weekRanges 계산과 동일한 산식
// (day===1(월요일)이면 그날, 아니면 (day+6)%7일 전 월요일로 귀속).
function mondayWeekStart(d: Date): Date {
  const day = d.getDay();
  const offset = (day + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// 그 해 1월 1일이 속한 월요일-시작 주를 1주차로 삼는 대시보드 자체 주차 번호 — ISO 8601과는
// 연도 경계 처리(ISO의 "목요일 포함" 규칙)가 다르다. 상단 필터와 같은 월요일 기준을 유지하는 게
// 이 안에서의 일관성이 우선이라 이렇게 정의했다.
function weekOfYearLabel(weekStart: Date): string {
  const year = weekStart.getFullYear();
  const jan1WeekStart = mondayWeekStart(new Date(year, 0, 1));
  const diffDays = Math.round((weekStart.getTime() - jan1WeekStart.getTime()) / 86400000);
  const weekNum = Math.floor(diffDays / 7) + 1;
  const weekEnd = addDays(weekStart, 6);
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${year}년 ${weekNum}주차 (${fmt(weekStart)}~${fmt(weekEnd)})`;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 상품별·일자별 "사고접수" 건수 + 그날 전체 사고접수 중 비중을 계산한다 — "매출/클레임비용" 탭.
// ProblemForm 자체의 접수일(receivedDate)·상품명(productName)만 쓴다(일자별 집계 자체엔 OrderItem
// 조인 불필요). orderItems를 넘기면 상품별 "전체건수 대비 클레임율" 요약도 함께 계산한다(아래 참고).
//
// ⚠️ 주 단위가 아니라 "일" 단위인 이유(실측으로 확인됨): 이 CS 업로드는 대개 최근 1~2주치 증분
// 파일만 올라오는 경우가 많다(실제로 어드민 export가 그런 형태로 나옴). 그런데 주 단위로 묶으면
// 데이터가 딱 1~2개 주차 컬럼에만 뭉쳐 찍혀서 "요즘 어느 날 튀었는지" 전혀 안 보이는 문제가 있었다
// — 히트맵이 트렌드를 보여주려면 최소 몇 개 칸에는 걸쳐 퍼져야 하는데, 짧은 업로드 구간에서는 주
// 단위 해상도 자체가 너무 거칠다. 이 앱에 이미 있는 "최근 14일 일별 트렌드" 차트와 같은 원칙으로
// 일 단위로 바꿔서, 며칠치만 올려도 날짜별로 펼쳐져 패턴이 보이게 한다.
//
// (참고: 셀 자체는 결제일이 아니라 접수일 기준 — 이 히트맵은 "언제 접수됐나"를 보는 CS/품질
// 모니터링용이라, 결제월 귀속을 쓰는 이 탭의 다른 표들과는 숫자가 원래 다르게 나오는 게 의도된
// 것이다. "전체건수 비중(%)"도 그날 전체 사고접수 중 이 상품 비중이지, 주문건수 대비 발생률이
// 아니다 — 그 발생률(클레임율)은 아래 orderCount/claimRate로 별도 제공한다.)
export function computeItemDailyAccidentPivot(
  problemForms: ProblemForm[],
  orderItems: OrderItem[] = []
): { rows: ItemDailyAccidentRow[]; dates: string[] } {
  // 상품별 전체 주문건수(재발송 제외, 전체 업로드 기간) — 클레임율의 분모.
  const orderCountByProduct = new Map<string, number>();
  orderItems.forEach(o => {
    if (o.isReshipCost || !o.paymentDate) return;
    const base = (o.product || "").split("/")[0].trim();
    if (!base) return;
    orderCountByProduct.set(base, (orderCountByProduct.get(base) || 0) + 1);
  });
  // product -> date(YYYY.MM.DD) -> count
  const byProductDate = new Map<string, Map<string, number>>();
  // date -> 그날 전체 사고접수건수(모든 상품 합)
  const dateTotals = new Map<string, number>();
  const dateSet = new Set<string>();

  problemForms.forEach(p => {
    if (!p.receivedDate) return;
    const receivedDate = parseDateStr(p.receivedDate);
    if (!receivedDate) return;
    const product = (p.productName || "").split("/")[0].trim();
    if (!product) return;

    const dateStr = formatYmd(receivedDate);
    dateSet.add(dateStr);

    if (!byProductDate.has(product)) byProductDate.set(product, new Map());
    const dateMap = byProductDate.get(product)!;
    dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);

    dateTotals.set(dateStr, (dateTotals.get(dateStr) || 0) + 1);
  });

  const dates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

  const rows: ItemDailyAccidentRow[] = Array.from(byProductDate.entries()).map(([item, dateMap]) => {
    let totalCount = 0;
    const days: ItemDailyAccidentCell[] = dates.map(dateStr => {
      const count = dateMap.get(dateStr) || 0;
      totalCount += count;
      const dayTotal = dateTotals.get(dateStr) || 0;
      const d = parseDateStr(dateStr)!;
      const dateLabel = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}(${WEEKDAY_LABELS[d.getDay()]})`;
      return {
        date: dateStr,
        dateLabel,
        count,
        shareOfDayTotal: dayTotal > 0 ? Math.round((count / dayTotal) * 1000) / 10 : 0,
      };
    });
    const orderCount = orderCountByProduct.get(item);
    const claimRate = orderCount ? Math.round((totalCount / orderCount) * 1000) / 10 : undefined;
    return { item, totalCount, days, orderCount, claimRate };
  });

  rows.sort((a, b) => b.totalCount - a.totalCount);

  return { rows, dates };
}

// 처리방법 5종의 주차별 비율 추이 — 구글시트 trend 탭의 일별 처리방법 비율 추이를 이 대시보드의
// 월요일 시작 주차 단위로 재현한 것. computeHandlingMethodStats와 같은 5종 분류(HANDLING_METHOD_ORDER)를
// 결제일 기준 주차로 나눠 집계한다.
export interface MethodWeekBreakdown {
  weekLabel: string;
  weekStart: string; // "YYYY.MM.DD" (월요일)
  totalClaims: number;
  methods: {
    결제수단환불: number; // 비중 %
    재발송: number;
    적립금환불: number;
    교환: number;
    반품: number;
  };
  methodCounts: {
    결제수단환불: number; // 건수
    재발송: number;
    적립금환불: number;
    교환: number;
    반품: number;
  };
}

const METHOD_KEY_MAP: Record<string, keyof MethodWeekBreakdown["methods"]> = {
  "재발송": "재발송",
  "결제 수단으로 환불": "결제수단환불",
  "교환": "교환",
  "반품": "반품",
  "적립금 환불": "적립금환불",
};

export function computeMethodBreakdownByWeek(orderItems: OrderItem[], problemForms: ProblemForm[]): MethodWeekBreakdown[] {
  const originals = orderItems.filter(o => !o.isReshipCost && o.paymentDate);
  const orderNumberMap = new Map<string, OrderItem>();
  originals.forEach(o => { if (o.orderNumber) orderNumberMap.set(o.orderNumber, o); });

  const weekCounts = new Map<string, Record<string, number>>(); // weekStart -> methodKey -> count
  const weekTotals = new Map<string, number>();

  problemForms.forEach(p => {
    const order = orderNumberMap.get(p.orderItemRef);
    if (!order) return;
    const paymentDate = parseDateStr(order.paymentDate);
    if (!paymentDate) return;

    const weekStartStr = formatYmd(mondayWeekStart(paymentDate));
    weekTotals.set(weekStartStr, (weekTotals.get(weekStartStr) || 0) + 1);

    const methodKey = METHOD_KEY_MAP[p.handlingMethod || ""];
    if (methodKey) {
      if (!weekCounts.has(weekStartStr)) weekCounts.set(weekStartStr, {});
      const counts = weekCounts.get(weekStartStr)!;
      counts[methodKey] = (counts[methodKey] || 0) + 1;
    }
  });

  const weekStarts = Array.from(weekTotals.keys()).sort((a, b) => a.localeCompare(b));

  return weekStarts.map(weekStartStr => {
    const total = weekTotals.get(weekStartStr) || 0;
    const counts = weekCounts.get(weekStartStr) || {};
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
    const weekStartDate = parseDateStr(weekStartStr)!;

    return {
      weekLabel: weekOfYearLabel(weekStartDate),
      weekStart: weekStartStr,
      totalClaims: total,
      methods: {
        결제수단환불: pct(counts["결제수단환불"] || 0),
        재발송: pct(counts["재발송"] || 0),
        적립금환불: pct(counts["적립금환불"] || 0),
        교환: pct(counts["교환"] || 0),
        반품: pct(counts["반품"] || 0),
      },
      methodCounts: {
        결제수단환불: counts["결제수단환불"] || 0,
        재발송: counts["재발송"] || 0,
        적립금환불: counts["적립금환불"] || 0,
        교환: counts["교환"] || 0,
        반품: counts["반품"] || 0,
      },
    };
  });
}

// ProblemForm의 "사고 범위"(0~100%)가 OrderItem.환불금액에 이미 반영되어 있는지 검증한다.
// "주문 아이템" FK로 매칭되는 건 중 가격·사고범위·환불금액이 모두 있는 건만 비교 대상.
// 기대환불액(가격×사고범위%)과 실제 환불금액이 5% 오차 이내로 근접하면 "이미 반영됨"으로 판단해도
// 안전하다는 뜻이고, 그렇다면 클레임 비용 계산에서 사고범위를 별도로 다시 곱하면 이중계산이 된다.
// 현재 claimCostForCohort 계열 계산은 OrderItem.환불금액을 그대로 합산하므로(사고범위 재곱연산 없음),
// 이 함수는 그 전제가 실데이터로도 맞는지 확인하는 진단용이다.
export function verifyAccidentScopeReflectsRefund(orderItems: OrderItem[], problemForms: ProblemForm[]): AccidentScopeCheckResult {
  const orderNumberMap = buildOrderNumberMap(orderItems);

  let matchedCount = 0;
  let closeCount = 0;
  const divergentSamples: { orderNumber: string; accidentScope: number; expectedRefund: number; actualRefund: number }[] = [];

  problemForms.forEach(p => {
    const order = orderNumberMap.get(p.orderItemRef);
    if (!order || p.accidentScope === undefined || !order.price || order.refundAmount === undefined) return;

    matchedCount++;
    const expectedRefund = Math.round(order.price * (p.accidentScope / 100));
    const actualRefund = order.refundAmount;
    const tolerance = Math.max(expectedRefund, actualRefund) * 0.05;

    if (Math.abs(expectedRefund - actualRefund) <= tolerance) {
      closeCount++;
    } else {
      divergentSamples.push({ orderNumber: p.orderItemRef, accidentScope: p.accidentScope, expectedRefund, actualRefund });
    }
  });

  return { matchedCount, closeCount, divergentCount: divergentSamples.length, divergentSamples };
}

export interface CsExportComparisonResult {
  periodStart: string;
  periodEnd: string;
  ourClaimCostTotal: number; // computeClaimCostCohorts 기준 해당 결제일 구간 claimCostTotal 합
  csExportTotal: number; // CS 비용 다운로드 파일의 접수일 기준 해당 구간 CS비용(원) 합
  diff: number; // ourClaimCostTotal - csExportTotal
  diffPct: number; // diff / csExportTotal × 100 (csExportTotal이 0이면 0)
}

// 주문번호 FK가 없는 별도 "CS 비용 다운로드" export와 우리 계산 결과(OrderItem 기반 클레임비용)를
// 기간 합계로만 비교하는 진단 함수 — verifyAccidentScopeReflectsRefund와 같은 패턴(건별 조인 대신
// 총합 비교). 결제일(우리 계산)과 접수일(CS export)은 서로 다른 기준이라 완전 일치는 기대하기 어렵고,
// 같은 기간을 대략 비교해 두 소스가 크게 어긋나지 않는지 확인하는 용도다.
export function verifyClaimCostAgainstCsExport(
  orderItems: OrderItem[],
  csExportRows: CsCostExportRow[],
  periodStart: string,
  periodEnd: string
): CsExportComparisonResult {
  const ourClaimCostTotal = computeClaimCostCohorts(orderItems)
    .filter(c => c.paymentDate >= periodStart && c.paymentDate <= periodEnd)
    .reduce((sum, c) => sum + c.claimCostTotal, 0);

  const csExportTotal = csExportRows
    .filter(r => r.receivedDate >= periodStart && r.receivedDate <= periodEnd)
    .reduce((sum, r) => sum + (r.csCostWon || 0), 0);

  const diff = ourClaimCostTotal - csExportTotal;
  const diffPct = csExportTotal > 0 ? Math.round((diff / csExportTotal) * 1000) / 10 : 0;

  return { periodStart, periodEnd, ourClaimCostTotal, csExportTotal, diff, diffPct };
}

// ============================================================================
// 시즌 알림(YoY/MoM) — MD팀 요청. "작년 이맘때도 이슈였던 상품"(YoY)과 "지난달에 새로 심각해진
// 상품"(MoM)을 지난달(완료된 달) 기준으로 잡아 주간 핵심 지표 탭 배너에 띄운다.
//
// 원본 행을 계속 들고 있을 필요가 없어서(작년 전체를 통째로 저장하면 용량이 커짐), 상품×월
// 집계(건수 두 개)만 남기고 원본은 버린다 — 2025년 참고 데이터도 이 집계 형태로만 저장한다.
// ============================================================================

export interface ProductMonthAggregate {
  product: string; // 기준상품명(첫 "/" 앞부분)
  month: string; // "YYYY-MM"
  accidentCount: number;
  orderCount: number; // 재발송 제외
}

// orderItems/problemForms 원본에서 상품×월 집계를 뽑는다 — 2026년 실시간 데이터(지난달/그전달
// 계산용)와 2025년 참고 데이터 업로드(YoY용) 둘 다 이 함수 하나로 계산한다.
export function computeProductMonthAggregates(
  orderItems: OrderItem[],
  problemForms: ProblemForm[]
): ProductMonthAggregate[] {
  const orderMap = new Map<string, number>();
  orderItems.forEach(o => {
    if (o.isReshipCost || !o.paymentDate) return;
    const month = monthKeyOf(o.paymentDate);
    if (!month) return;
    const product = (o.product || "").split("/")[0].trim();
    if (!product) return;
    const key = `${product}|${month}`;
    orderMap.set(key, (orderMap.get(key) || 0) + 1);
  });

  const accidentMap = new Map<string, number>();
  problemForms.forEach(p => {
    if (!p.receivedDate) return;
    const month = monthKeyOf(p.receivedDate);
    if (!month) return;
    const product = (p.productName || "").split("/")[0].trim();
    if (!product) return;
    const key = `${product}|${month}`;
    accidentMap.set(key, (accidentMap.get(key) || 0) + 1);
  });

  const allKeys = new Set([...orderMap.keys(), ...accidentMap.keys()]);
  return Array.from(allKeys).map(key => {
    const [product, month] = key.split("|");
    return {
      product,
      month,
      accidentCount: accidentMap.get(key) || 0,
      orderCount: orderMap.get(key) || 0,
    };
  });
}

// month("YYYY-MM") 기준 "그 전달/작년 같은 달"을 계산한다 — 순수 월 산술이라 어떤 기준월이든
// 재사용 가능(오늘 날짜와 무관).
export function monthsRelativeTo(month: string): { priorMonth: string; yoyMonth: string } {
  const [y, m] = month.split("-").map(Number);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prior = new Date(y, m - 2, 1);
  const yoy = new Date(y - 1, m - 1, 1);
  return { priorMonth: fmt(prior), yoyMonth: fmt(yoy) };
}

// 오늘 날짜 기준 "지난달(완료된 달)/그전달/작년 같은 달"을 동적으로 계산한다 — 하드코딩 안 함,
// 달이 바뀌면 자동으로 따라간다. 이번달은 성숙 윈도우가 안 지나 잠정치라 비교 대상에서 뺀다.
// (이 "완료된 달" 기준은 시즌 알림 배너 전용 — 특정 상품 검색 패널처럼 이미 화면에 표시 중인
// 다른 달을 기준으로 봐야 하는 곳은 monthsRelativeTo()를 그 달에 직접 적용할 것.)
export function computeSeasonalCompareMonths(today: Date = new Date()): { currentMonth: string; priorMonth: string; yoyMonth: string } {
  const y = today.getFullYear(), m = today.getMonth();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const lastCompleted = new Date(y, m - 1, 1);
  const currentMonth = fmt(lastCompleted);
  const { priorMonth, yoyMonth } = monthsRelativeTo(currentMonth);
  return { currentMonth, priorMonth, yoyMonth };
}

// 작년 참고 데이터는 두 경로로 들어올 수 있다: ① 배너 전용 업로드(yoyReferenceAggregates, 별도 저장)
// ② 평소 쓰는 메인 임포터로 올려서 orderItems/problemForms에 이미 누적된 경우. 라이브 데이터에 그
// 달 집계가 있으면 그쪽을 우선한다(실사용에서 후자로 올리는 경우가 더 자연스러움).
export function resolveYoyAggregateSource(
  currentAndPrior: ProductMonthAggregate[],
  yoyReferenceAggregates: ProductMonthAggregate[],
  yoyMonth: string
): ProductMonthAggregate[] {
  return currentAndPrior.some(a => a.month === yoyMonth) ? currentAndPrior : yoyReferenceAggregates;
}

// 실측(2026년 8월 데이터)으로 확인해 정한 임계값 — 클레임율만 보면 표본이 작은 상품(예: 3건 중
// 1건=33%)이 노이즈로 낄 수 있어, 최소 주문건수·최소 사고접수건수를 같이 요구한다. 사용자 확인 후
// 사고접수건수 최소치는 3에서 4로 상향(여유 마진).
export const SEASONAL_ALERT_THRESHOLD = {
  minClaimRate: 5, // %
  minOrderCount: 20,
  minAccidentCount: 4,
};

function qualifiesForSeasonalAlert(agg: ProductMonthAggregate | undefined): boolean {
  if (!agg) return false;
  if (agg.orderCount < SEASONAL_ALERT_THRESHOLD.minOrderCount) return false;
  if (agg.accidentCount < SEASONAL_ALERT_THRESHOLD.minAccidentCount) return false;
  return (agg.accidentCount / agg.orderCount) * 100 >= SEASONAL_ALERT_THRESHOLD.minClaimRate;
}

export interface SeasonalAlert {
  product: string;
  type: "yoy" | "mom"; // yoy = 작년 같은 달에도 이슈였음, mom = 그전달엔 안 그랬다가 지난달에 새로 심각해짐
  currentMonth: string;
  currentAccidentCount: number;
  currentOrderCount: number;
  currentClaimRate: number;
  compareMonth: string;
  compareAccidentCount: number;
  compareOrderCount: number;
  compareClaimRate: number;
}

// 좁은 기간(예: 최근 1~2주치)만 담긴 CS export를 업로드했을 때, 비교월의 주문량이 실제로는
// 그 달 전체가 아니라 일부만 반영된 것일 수 있다 — 이 경우 "그 달엔 주문이 0건이라 이번달에
// 갑자기 심각해졌다"는 MoM 알림이 대량으로 오탐 발생한다(비교월 데이터가 얇아서 생기는 착시,
// 실제로 새로 나빠진 게 아님). 비교월 전체 주문량이 이번달 전체 주문량의 30% 미만이면
// "데이터가 불충분하다"고 보고 해당 비교(YoY 또는 MoM) 전체를 건너뛴다.
const MIN_COMPARE_MONTH_COVERAGE_RATIO = 0.3;

function isCompareMonthDataSufficient(currentTotalOrders: number, compareTotalOrders: number): boolean {
  if (currentTotalOrders <= 0) return compareTotalOrders > 0;
  return compareTotalOrders >= currentTotalOrders * MIN_COMPARE_MONTH_COVERAGE_RATIO;
}

export interface SeasonalAlertResult {
  alerts: SeasonalAlert[];
  momDataSufficient: boolean;
  yoyDataSufficient: boolean;
}

export function computeSeasonalAlerts(
  currentAggregates: ProductMonthAggregate[],
  currentMonth: string,
  priorAggregates: ProductMonthAggregate[],
  priorMonth: string,
  yoyAggregates: ProductMonthAggregate[],
  yoyMonth: string
): SeasonalAlertResult {
  const currentRows = currentAggregates.filter(a => a.month === currentMonth);
  const priorRows = priorAggregates.filter(a => a.month === priorMonth);
  const yoyRows = yoyAggregates.filter(a => a.month === yoyMonth);

  const currentTotalOrders = currentRows.reduce((sum, a) => sum + a.orderCount, 0);
  const priorTotalOrders = priorRows.reduce((sum, a) => sum + a.orderCount, 0);
  const yoyTotalOrders = yoyRows.reduce((sum, a) => sum + a.orderCount, 0);

  const momDataSufficient = isCompareMonthDataSufficient(currentTotalOrders, priorTotalOrders);
  const yoyDataSufficient = isCompareMonthDataSufficient(currentTotalOrders, yoyTotalOrders);

  const priorByProduct = new Map(priorRows.map(a => [a.product, a]));
  const yoyByProduct = new Map(yoyRows.map(a => [a.product, a]));

  const alerts: SeasonalAlert[] = [];
  currentRows.forEach(cur => {
    if (!qualifiesForSeasonalAlert(cur)) return;
    const currentClaimRate = Math.round((cur.accidentCount / cur.orderCount) * 1000) / 10;

    if (yoyDataSufficient) {
      const yoy = yoyByProduct.get(cur.product);
      if (qualifiesForSeasonalAlert(yoy)) {
        alerts.push({
          product: cur.product, type: "yoy",
          currentMonth, currentAccidentCount: cur.accidentCount, currentOrderCount: cur.orderCount, currentClaimRate,
          compareMonth: yoyMonth, compareAccidentCount: yoy!.accidentCount, compareOrderCount: yoy!.orderCount,
          compareClaimRate: Math.round((yoy!.accidentCount / yoy!.orderCount) * 1000) / 10,
        });
      }
    }

    if (momDataSufficient) {
      const prior = priorByProduct.get(cur.product);
      if (!qualifiesForSeasonalAlert(prior)) {
        alerts.push({
          product: cur.product, type: "mom",
          currentMonth, currentAccidentCount: cur.accidentCount, currentOrderCount: cur.orderCount, currentClaimRate,
          compareMonth: priorMonth, compareAccidentCount: prior?.accidentCount || 0, compareOrderCount: prior?.orderCount || 0,
          compareClaimRate: prior && prior.orderCount > 0 ? Math.round((prior.accidentCount / prior.orderCount) * 1000) / 10 : 0,
        });
      }
    }
  });

  return { alerts, momDataSufficient, yoyDataSufficient };
}

export interface WeeklyAccidentSpike {
  product: string;
  count: number;
  windowStart: string; // "YYYY.MM.DD"
  windowEnd: string; // "YYYY.MM.DD"
}

// 시즌 알림(YoY/MoM, 월 단위)과는 별개로 "최근 N일 사이 갑자기 사고접수가 몰리는 상품"을
// 잡아내는 짧은 주기 알림 — 주문량 대비 비율이 아니라 절대 건수 임계값 기준(작은 표본에서도
// 급증 신호를 놓치지 않기 위함).
export function computeWeeklyAccidentSpikes(
  problemForms: ProblemForm[],
  today: Date = new Date(),
  windowDays: number = 7,
  minCount: number = 3
): WeeklyAccidentSpike[] {
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));
  windowStart.setHours(0, 0, 0, 0);
  const windowEndOfDay = new Date(today);
  windowEndOfDay.setHours(23, 59, 59, 999);

  const counts = new Map<string, number>();
  problemForms.forEach(p => {
    if (!p.receivedDate) return;
    const d = parseDateStr(p.receivedDate);
    if (!d || d < windowStart || d > windowEndOfDay) return;
    const product = (p.productName || "").split("/")[0].trim();
    if (!product) return;
    counts.set(product, (counts.get(product) || 0) + 1);
  });

  const windowStartStr = formatYmd(windowStart);
  const windowEndStr = formatYmd(today);

  return Array.from(counts.entries())
    .filter(([, count]) => count >= minCount)
    .map(([product, count]) => ({ product, count, windowStart: windowStartStr, windowEnd: windowEndStr }))
    .sort((a, b) => b.count - a.count);
}
