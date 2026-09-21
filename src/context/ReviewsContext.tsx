import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { reviewsData as staticReviews, Review, ProductStat } from "../data/classifiedReviews";
import { Incident, initialIncidentsData } from "../data/initialIncidents";
import { OrderItem, initialOrderItemsData } from "../data/orderItems";
import { ProblemForm, initialProblemFormsData } from "../data/problemForms";
import { ChatRoom, initialChatRoomsData } from "../data/chatRooms";
import { CsCostExportRow, DispatchFailureRow, NpsSummary, NpsDetractorRow, NpsTrendPoint, NpsPurchaseTierStat, NpsImportResult, classifyCategory, getDepartmentForCategory, maskCustomerName } from "../utils/csvParser";
import { defaultCompanyHolidays } from "../data/companyHolidays";
import { idbLoad, idbSave } from "../utils/idbStorage";
import { DEFAULT_MONTHLY_CS_LABOR_COST_ALLOCATION_KRW } from "../utils/chatRoomEngine";
import { ProductMonthAggregate, computeProductMonthAggregates } from "../utils/claimCostEngine";

// 어드민 사고접수 태깅 대분류(품질/출고/배송) + 기타불만 — ProductStatusTab의 "요주의 위크" 카드
// 배지/브레이크다운 계산에 쓰인다. classifyCategory(리뷰 텍스트 키워드 매칭용, 품질/상태·배송/포장·
// 상품구성/양·서비스/시스템 4분류)와는 완전히 다른 축이라 재사용하지 않는다 — 이건 어드민이 직접
// 사고접수에 태깅한 원인 대분류(accidentDetail의 "품질/시듦" 같은 "대분류/소분류" 표기)다.
export type AccidentTopCategory = "품질" | "출고" | "배송" | "기타불만";

function classifyAccidentTopCategory(accidentDetail?: string, accidentType?: string): AccidentTopCategory {
  const detail = (accidentDetail || "").trim();
  if (detail.includes("/")) {
    const prefix = detail.split("/")[0].trim();
    if (prefix === "품질") return "품질";
    if (prefix === "출고") return "출고";
    if (prefix === "배송") return "배송";
  }
  const type = (accidentType || "").trim();
  if (type.includes("품질")) return "품질";
  if (type.includes("누락") || type === "출고") return "출고";
  if (type.includes("오배송") || type.includes("배송")) return "배송";
  return "기타불만";
}

export interface AccidentCategoryRecord {
  detail: string;
  topCategory: AccidentTopCategory;
}

// ActionBoardTab("처리 필요" 탭)과 상단 탭 배지가 함께 쓰는 항목 타입.
export interface ActionItem {
  key: string;
  type: "review" | "incident";
  product: string;
  customer: string;
  date: string;
  summary: string;
  department: string;
  targetId: string;
  adminLink?: string;
  importChannel?: "일반" | "플라워고";
}

interface ReviewsContextType {
  reviews: Review[];
  weeklyReviews: Review[];
  incidents: Incident[];
  weeklyIncidents: Incident[];
  // 상품별 "선택 기간 내 처리완료된 사고접수" 건수 — ProblemForm의 자체 "상품명" 컬럼(예:
  // "플라워 럭키박스/6종 이상/랜덤혼합(fFLrd3sst-SF)")을 첫 "/" 앞 기준으로 정규화해 집계한다
  // (OrderItem 조인 불필요 — CSV 자체에 상품명이 이미 들어있음). ProblemForm 데이터가 하나도
  // 없을 때만(하위호환) 옛 Incident 모델로 폴백한다.
  weeklyAccidentCountsByProduct: Record<string, number>;
  // "요주의 위크" 카드가 사고접수 배지/브레이크다운/대표 인용을 만드는 데 쓰는 원문 레코드.
  // weeklyAccidentCountsByProduct와 완전히 동일한 소스·기간필터로 계산되어 배열 length가 곧
  // 해당 상품의 accidentCount와 항상 일치한다(라벨 N건과 실제 나열 개수 불일치 버그 방지).
  weeklyAccidentRecordsByProduct: Record<string, AccidentCategoryRecord[]>;
  // "처리 필요" 탭(ActionBoardTab)과 상단 탭 배지가 공유하는 대기열. 사고접수는 ProblemForm의
  // status가 "접수중"인 것만(처리완료/반려됨/최종반려됨이 되면 재계산 시 자동으로 목록에서 빠짐 —
  // 수동 처리 버튼 없음), 리뷰는 비추천/저평점이면서 exposed===true인 것만(exposed가 꺼지면 자동
  // 이탈, 애매한 경우를 위한 수동 오버라이드만 남겨둠).
  actionItems: ActionItem[];
  resolveActionItem: (key: string) => void;
  orderItems: OrderItem[];
  importOrderItems: (newItems: OrderItem[], replace?: boolean) => Promise<void>;
  problemForms: ProblemForm[];
  importProblemForms: (newItems: ProblemForm[], replace?: boolean) => Promise<void>;
  chatRooms: ChatRoom[];
  importChatRooms: (newItems: ChatRoom[], replace?: boolean) => Promise<void>;
  // "CS비용 검증(선택)" 위젯(ClaimCostTab)에서 업로드한 CS 비용 export — Part D 예측지표의
  // 건당코스트예상 계산에서 재사용하기 위해 전역으로 끌어올림. 병합/교체 UI 없이 항상 전체 교체.
  csCostExportRows: CsCostExportRow[];
  importCsCostExportRows: (rows: CsCostExportRow[]) => void;
  // "CS 응대 현황" 탭의 영업시간 필터(월~금 10-17시)용 휴무일 캘린더("YYYY-MM-DD"[]) — 코드 재배포 없이
  // 사용자가 직접 추가/삭제할 수 있도록 localStorage에 저장. 초기값은 defaultCompanyHolidays.
  companyHolidays: string[];
  setCompanyHolidays: (dates: string[]) => void;
  // Part D "26년 예상 건당 코스트" 계산의 분자 — 실측값이 아니라 CS 업무 배분 인건비를 주관적으로
  // 추산한 월 단위 근사치(옛 시트도 하드코딩 2,000,000원이었음, 사용자 확인 완료). 인건비 인상/업무
  // 비중 변화로 바뀔 수 있어 코드에 리터럴로 박지 않고 사용자가 수정 가능한 값으로 둔다.
  monthlyCsLaborCostAllocation: number;
  setMonthlyCsLaborCostAllocation: (won: number) => void;
  // Part E "발송불가율(SCM VOC)" — 이미 SQL 단에서 주/월별로 집계된 CSV를 그대로 저장(row-level
  // 재계산 없음). 데이터량이 작아(3년치라 봐야 주간 150여행) IndexedDB 대신 localStorage로 충분.
  dispatchFailureWeekly: DispatchFailureRow[];
  importDispatchFailureWeekly: (rows: DispatchFailureRow[], replace?: boolean) => void;
  dispatchFailureMonthly: DispatchFailureRow[];
  importDispatchFailureMonthly: (rows: DispatchFailureRow[], replace?: boolean) => void;
  // Part F — 전사 NPS. ARES III 원본 응답 3.4만 건+는 절대 프론트/localStorage에 올리지 않고, 원본
  // CSV 하나를 업로드하는 즉시(parseNpsImportCsv) 계산되는 소규모 파생값 3종(요약/Detractor 서브셋/
  // 월별 추이)만 통째로 교체 보관한다 — 셋 다 같은 업로드 한 번에서 동시에 갱신된다.
  npsSummary: NpsSummary;
  npsDetractorRows: NpsDetractorRow[];
  npsTrend: NpsTrendPoint[];
  // 구매빈도 등급별 전체응답/Detractor 집계 — "단골일수록 이탈률이 더 높은가"를 보여주는 데 쓴다.
  // NPS 원본 CSV 파싱 시점에만 계산되므로(34k+ 행을 계속 들고 있지 않음), 재업로드 전까지는
  // 고정값이다(다른 npsXxx 값들과 동일한 제약).
  npsPurchaseTierStats: NpsPurchaseTierStat[];
  applyNpsImport: (result: NpsImportResult) => void;
  // YoY 시즌 알림용 "작년 데이터" — 원본 OrderItem/ProblemForm 행을 저장하지 않고 상품×월 집계
  // (사고접수건수/주문건수)만 남긴다. 매번 업로드할 때마다 통째로 교체하지 않고 월 단위로 병합
  // 갱신한다(같은 달을 다시 올리면 그 달만 덮어씀).
  yoyReferenceAggregates: ProductMonthAggregate[];
  importYoyReferenceData: (orderItems: OrderItem[], problemForms: ProblemForm[]) => void;
  // "연락완료" 컨택 상태 — npsDetractorRows.id를 키로 쓰는 별도 Set(리뷰의 resolvedActionIds와 동일
  // 패턴). 데이터 재업로드로 rows가 통째로 바뀌어도 이미 컨택한 고객의 완료 표시는 유지된다.
  npsContactedIds: Set<string>;
  toggleNpsContact: (id: string) => void;
  // 우선순위 2 "구매횟수 임계값" — 관리자가 조정 가능해야 한다는 스펙 요건. 기본값 5회.
  npsWatchlistThreshold: number;
  setNpsWatchlistThreshold: (n: number) => void;
  productStats: ProductStat[];
  isLoading: boolean;
  addReview: (review: Omit<Review, "id">) => Promise<void>;
  archiveActiveReviews: () => Promise<void>;
  isSyncing: boolean;
  weekFilter: "this" | "last" | "all";
  setWeekFilter: (filter: "this" | "last" | "all") => void;
  weekRanges: {
    thisWeek: { start: string; end: string; label: string };
    lastWeek: { start: string; end: string; label: string };
    // weekFilter === "all" 스코프. 대시보드 전체 업로드 기간이 아니라 "이번주 + 저번주" 2주 합산으로 정의된다.
    allPeriod: { start: string; end: string; label: string };
  };
  resetToInitialData: () => Promise<void>;
  activeTab: "metrics" | "products" | "incidents" | "voc" | "archive" | "claimcost" | "actionboard" | "csresponse";
  setActiveTab: (tab: "metrics" | "products" | "incidents" | "voc" | "archive" | "claimcost" | "actionboard" | "csresponse") => void;
  metricsProductFilter: string;
  setMetricsProductFilter: (p: string) => void;
  metricsTypeFilter: "all" | "추천" | "중립" | "비추천" | "사고접수";
  setMetricsTypeFilter: (t: "all" | "추천" | "중립" | "비추천" | "사고접수") => void;
  importParsedReviews: (newReviews: Review[], append?: boolean) => Promise<void>;
  importIncidents: (newIncidents: Incident[], replace?: boolean) => Promise<void>;
  // 알림센터에서 클릭한 리뷰/사고접수 항목으로 다른 탭에서 스크롤/하이라이트 이동하기 위한 공유 상태
  // (metricsProductFilter와 동일한 "탭 간 신호" 패턴). 리뷰는 String(Review.id), 사고접수는 Incident.id 그대로 사용.
  highlightTargetId: string | null;
  setHighlightTargetId: (id: string | null) => void;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

// Helper: Format Date object to "YYYY.MM.DD"
function formatKSTDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

// Helper: Get current KST date
function getKSTDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 9));
}

// CSV로 업로드하는 OrderItem/ProblemForm/Incident는 Firestore/서버 DB 없이 브라우저
// localStorage에만 저장한다 — 실 API 연동 시점에 담당 개발자가 설계할 서버 DB와 별개로,
// 이 대시보드가 자체 DB를 구축하지 않기로 한 방침에 따른 임시 저장소다. 새로고침/재접속해도
// 업로드한 CSV가 사라지지 않는 정도만 보장하며, 여러 기기/사용자 간 공유는 안 된다.
const REVIEWS_STORAGE_KEY = "honestflower_reviews";
const ORDER_ITEMS_STORAGE_KEY = "honestflower_orderItems";
const PROBLEM_FORMS_STORAGE_KEY = "honestflower_problemForms";
const INCIDENTS_STORAGE_KEY = "honestflower_incidents";
const CHAT_ROOMS_STORAGE_KEY = "honestflower_chatRooms";
const CS_COST_EXPORT_STORAGE_KEY = "honestflower_csCostExportRows";
const COMPANY_HOLIDAYS_STORAGE_KEY = "honestflower_companyHolidays";
const MONTHLY_CS_LABOR_COST_ALLOCATION_STORAGE_KEY = "honestflower_monthlyCsLaborCostAllocation";
const DISPATCH_FAILURE_WEEKLY_STORAGE_KEY = "honestflower_dispatchFailureWeekly";
const DISPATCH_FAILURE_MONTHLY_STORAGE_KEY = "honestflower_dispatchFailureMonthly";
const NPS_SUMMARY_STORAGE_KEY = "honestflower_npsSummary";
const NPS_DETRACTOR_ROWS_STORAGE_KEY = "honestflower_npsDetractorRows";
const NPS_CONTACTED_IDS_STORAGE_KEY = "honestflower_npsContactedIds";
const NPS_WATCHLIST_THRESHOLD_STORAGE_KEY = "honestflower_npsWatchlistThreshold";
const NPS_TREND_STORAGE_KEY = "honestflower_npsTrend";
const NPS_PURCHASE_TIER_STATS_STORAGE_KEY = "honestflower_npsPurchaseTierStats";
const YOY_REFERENCE_AGGREGATES_STORAGE_KEY = "honestflower_yoyReferenceAggregates";
const DEFAULT_NPS_WATCHLIST_THRESHOLD = 5;

// 2026-09-03 ARES III 어드민 확인 스냅샷(NPS 78, total 34,211) — 실제 업로드 전까지의 초기 시드값.
// 재업로드하면 이 값은 통째로 교체된다.
const DEFAULT_NPS_SUMMARY: NpsSummary = {
  total: 34211,
  promoters: 28867,
  passives: 3180,
  detractors: 2164,
  asOf: "2026.09.03"
};
// "처리완료로 표시" 수동 오버라이드(리뷰 대상)는 원본 데이터를 건드리지 않고 이 id 집합으로만
// 관리한다 — CSV를 다시 업로드해도(원본 배열이 통째로 교체돼도) 표시가 사라지지 않게 하기 위함.
const RESOLVED_ACTION_IDS_STORAGE_KEY = "honestflower_resolvedActionIds";

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.error(`localStorage load error (${key}):`, err);
    return fallback;
  }
}

function saveToLocalStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`localStorage save error (${key}):`, err);
  }
}

// 옛날엔 이 파일에 maskCustomerName과 거의 동일한(그러나 slice(2) 버그가 안 고쳐진 채 남아있던)
// 별도 사본(getMaskedName)이 있었음 — csvParser.ts 쪽만 고치고 이쪽은 놓쳐서, "처리 필요" 탭 등
// 7군데에서 4글자 넘는 고객명이 여전히 거의 그대로 노출되고 있었다(실측으로 재확인). 마스킹 로직을
// 두 곳에 유지하면 이런 재발이 구조적으로 반복되므로, 앞으로는 csvParser.ts의 maskCustomerName
// 하나만 쓴다.
const getMaskedName = maskCustomerName;

// Helper: Determine if two reviews belong to the same post
export function areReviewsSamePost(a: any, b: any): boolean {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  
  const aText = (a.review || "").trim();
  const bText = (b.review || "").trim();

  // Customer ID is the most reliable identifier when present (avoids reviewer-name/phone-number mixups)
  if (a.rawCustomerId && b.rawCustomerId && a.rawCustomerId === b.rawCustomerId && a.date === b.date && a.product === b.product) {
    return true;
  }

  // If both have explicit rawReviewer strings AND same date AND same non-empty review text:
  if (a.rawReviewer && b.rawReviewer && a.rawReviewer === b.rawReviewer && a.date === b.date && aText.length >= 3 && aText === bText) {
    return true;
  }

  // If same date and exact same long review text (multi-product order submission with same text):
  if (a.date === b.date && aText.length >= 8 && aText === bText) {
    return true;
  }

  return false;
}

// Helper: Smart deduplication for Incidents (Merge duplicate rows by exact Incident ID or exact duplicate CSV records)
export function getDeduplicatedIncidents(list: Incident[]): Incident[] {
  const incidents: Incident[] = [];

  list.forEach(item => {
    const existingIndex = incidents.findIndex(existing => {
      // 1. Match by exact incident ID or numeric ID (e.g. INC-9301 vs 9301)
      if (existing.id && item.id) {
        const exNum = existing.id.replace(/\D/g, "");
        const itNum = item.id.replace(/\D/g, "");
        if (exNum && itNum && exNum === itNum) {
          return true;
        }
        if (existing.id === item.id) {
          return true;
        }
      }
      
      // 2. Match exact duplicate row if orderNumber, product, date, and customer match identically
      if (
        existing.orderNumber &&
        item.orderNumber &&
        existing.orderNumber === item.orderNumber &&
        existing.product === item.product &&
        existing.date === item.date &&
        (existing.customerName || "") === (item.customerName || "")
      ) {
        return true;
      }

      return false;
    });

    if (existingIndex !== -1) {
      // Merge enriched details into existing record
      const existing = incidents[existingIndex];
      if (item.refundAmount && !existing.refundAmount) existing.refundAmount = item.refundAmount;
      if (item.image_url && !existing.image_url) existing.image_url = item.image_url;
      if (item.csResponse && !existing.csResponse) existing.csResponse = item.csResponse;
      if (item.orderNumber && !existing.orderNumber) existing.orderNumber = item.orderNumber;
      if (item.claimText && item.claimText.length > (existing.claimText?.length || 0)) {
        existing.claimText = item.claimText;
      }
      if (item.incidentStatus === "처리완료" || (item.incidentStatus === "반려됨" && existing.incidentStatus === "접수중")) {
        existing.incidentStatus = item.incidentStatus;
      }
    } else {
      incidents.push({ ...item });
    }
  });

  return incidents;
}

// Helper: Deduplicate reviews of the same product by the same person or with identical content on the same day
export function getDeduplicatedReviews(list: Review[]): Review[] {
  const merged: Review[] = [];
  
  list.forEach(item => {
    const isAccident = item.incidentStatus !== undefined || item.accidentType !== undefined || item.refundAmount !== undefined;
    const itemReviewer = item.rawReviewer || item.reviewer || `고객#${item.id}`;
    const itemText = (item.review || "").trim();
    
    const existing = merged.find(m => {
      // Distinct IDs are separate database/CSV rows
      if (m.id && item.id && m.id !== item.id) return false;
      // Accident reports are individual CS tickets
      if (isAccident) return false;

      const mReviewer = m.rawReviewer || m.reviewer || `고객#${m.id}`;
      const mText = (m.review || "").trim();

      // Customer ID is the most reliable identifier when present (avoids reviewer-name/phone-number mixups)
      const sameCustomerId = Boolean(item.rawCustomerId && m.rawCustomerId && item.rawCustomerId === m.rawCustomerId && m.date === item.date && m.product === item.product);
      const sameReviewer = item.rawReviewer && m.rawReviewer && mReviewer === itemReviewer && m.date === item.date && m.product === item.product && mText === itemText;
      const sameContentIntegrity = itemText.length >= 8 && mText === itemText && m.date === item.date && m.product === item.product;

      return Boolean(sameCustomerId || sameReviewer || sameContentIntegrity);
    });

    if (existing) {
      if (!existing.rawCustomerId && item.rawCustomerId) {
        existing.rawCustomerId = item.rawCustomerId;
      }
      if (!existing.rawReviewer && item.rawReviewer) {
        existing.rawReviewer = item.rawReviewer;
        existing.reviewer = item.reviewer;
      }
      if (item.incidentStatus && !existing.incidentStatus) existing.incidentStatus = item.incidentStatus;
      if (item.accidentType && !existing.accidentType) existing.accidentType = item.accidentType;
      if (item.accidentDetail && !existing.accidentDetail) existing.accidentDetail = item.accidentDetail;
      if (item.refundAmount !== undefined && existing.refundAmount === undefined) existing.refundAmount = item.refundAmount;
      if (item.image_url) {
        if (!existing.image_urls) {
          existing.image_urls = existing.image_url ? [existing.image_url] : [];
        }
        if (!existing.image_urls.includes(item.image_url)) {
          existing.image_urls.push(item.image_url);
        }
      }
    } else {
      merged.push({
        ...item,
        reviewer: item.reviewer || getMaskedName(item.id, item.rawReviewer),
        image_urls: item.image_urls || (item.image_url ? [item.image_url] : [])
      });
    }
  });
  
  return merged;
}

export interface IntegrityIssue {
  type: "IDENTICAL_CONTENT_DIFFERENT_REVIEWER" | "DUPLICATE_ROW";
  date: string;
  product: string;
  reviewText: string;
  reviews: Review[];
  suggestedReviewer: string;
}

// Helper: Detect integrity issues (identical review content across different reviewers or duplicated rows)
export function findIntegrityIssues(list: Review[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const groups = new Map<string, Review[]>();

  list.forEach(r => {
    const text = (r.review || "").trim();
    if (text.length < 3) return;
    const key = `${r.date}___${r.product}___${text}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  groups.forEach((items) => {
    if (items.length > 1) {
      const reviewers = new Set(items.map(i => i.rawReviewer || i.reviewer || getMaskedName(i.id)));
      const first = items[0];
      const suggested = items.find(i => i.rawReviewer)?.rawReviewer || items.find(i => i.reviewer)?.reviewer || getMaskedName(first.id, first.rawReviewer);
      
      issues.push({
        type: reviewers.size > 1 ? "IDENTICAL_CONTENT_DIFFERENT_REVIEWER" : "DUPLICATE_ROW",
        date: first.date,
        product: first.product,
        reviewText: first.review,
        reviews: items,
        suggestedReviewer: suggested
      });
    }
  });

  return issues;
}

// Helper: Dynamically generate group keys for a list of reviews
export function getGroupKeysMap(list: any[]): Map<number, string> {
  const map = new Map<number, string>();
  const representatives: any[] = [];

  list.forEach(item => {
    let matchedRep = representatives.find(rep => areReviewsSamePost(item, rep));
    if (!matchedRep) {
      representatives.push(item);
      matchedRep = item;
    }
    map.set(item.id, `group_${matchedRep.id}`);
  });

  return map;
}

// Helper: Derive review type ("추천" | "중립" | "비추천") based on rating if missing
function deriveReviewType(rating: number, existingType?: string): "추천" | "중립" | "비추천" {
  if (existingType === "추천" || existingType === "중립" || existingType === "비추천") {
    return existingType;
  }
  if (rating >= 4) return "추천";
  if (rating === 3) return "중립";
  return "비추천";
}

// Helper: Map static reviews to have rawReviewer and masked reviewer name
const mapStaticReviews = (list: Review[]): Review[] => {
  return list.map(r => {
    const raw = r.rawReviewer || (r as any).reviewer || (r as any).writer || "";
    return {
      ...r,
      rawReviewer: raw,
      reviewer: r.reviewer || getMaskedName(r.id, raw),
      // 노출여부 정보가 없는 옛 시드 데이터는 "노출 중"(처리 필요)으로 간주 — 신규 리뷰 기본값과 동일.
      exposed: r.exposed !== undefined ? r.exposed : true
    };
  });
};

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  // 아래 6개 컬렉션(대용량 CSV 업로드 데이터)은 IndexedDB에서 비동기로 불러온다(localStorage는
  // 브라우저당 5~10MB 한도라 1년치 주문 데이터 등을 못 담아 도입 — idbStorage.ts 참고). 그래서
  // useState 초기값은 항상 시드 데이터이고, 실제 저장된 값은 아래 마운트 effect에서 채워진다.
  const [rawReviews, setRawReviews] = useState<Review[]>(mapStaticReviews(staticReviews));
  const [rawIncidents, setRawIncidents] = useState<Incident[]>(initialIncidentsData);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(initialOrderItemsData);
  const [problemForms, setProblemForms] = useState<ProblemForm[]>(initialProblemFormsData);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(initialChatRoomsData);
  const [csCostExportRows, setCsCostExportRows] = useState<CsCostExportRow[]>([]);
  // 용량이 작아 그대로 localStorage 유지(휴무일 목록/인건비 배분값은 몇십 바이트 수준).
  const [hasLoadedPersistedData, setHasLoadedPersistedData] = useState(false);
  const [companyHolidays, setCompanyHolidays] = useState<string[]>(() => loadFromLocalStorage(COMPANY_HOLIDAYS_STORAGE_KEY, defaultCompanyHolidays));
  const [monthlyCsLaborCostAllocation, setMonthlyCsLaborCostAllocation] = useState<number>(() => loadFromLocalStorage(MONTHLY_CS_LABOR_COST_ALLOCATION_STORAGE_KEY, DEFAULT_MONTHLY_CS_LABOR_COST_ALLOCATION_KRW));
  const [dispatchFailureWeekly, setDispatchFailureWeekly] = useState<DispatchFailureRow[]>(() => loadFromLocalStorage(DISPATCH_FAILURE_WEEKLY_STORAGE_KEY, []));
  const [dispatchFailureMonthly, setDispatchFailureMonthly] = useState<DispatchFailureRow[]>(() => loadFromLocalStorage(DISPATCH_FAILURE_MONTHLY_STORAGE_KEY, []));
  const [npsSummary, setNpsSummary] = useState<NpsSummary>(() => loadFromLocalStorage(NPS_SUMMARY_STORAGE_KEY, DEFAULT_NPS_SUMMARY));
  const [npsDetractorRows, setNpsDetractorRows] = useState<NpsDetractorRow[]>(() => loadFromLocalStorage(NPS_DETRACTOR_ROWS_STORAGE_KEY, []));
  const [npsContactedIds, setNpsContactedIds] = useState<Set<string>>(() => new Set(loadFromLocalStorage<string[]>(NPS_CONTACTED_IDS_STORAGE_KEY, [])));
  const [npsWatchlistThreshold, setNpsWatchlistThreshold] = useState<number>(() => loadFromLocalStorage(NPS_WATCHLIST_THRESHOLD_STORAGE_KEY, DEFAULT_NPS_WATCHLIST_THRESHOLD));
  const [npsTrend, setNpsTrend] = useState<NpsTrendPoint[]>(() => loadFromLocalStorage(NPS_TREND_STORAGE_KEY, []));
  const [npsPurchaseTierStats, setNpsPurchaseTierStats] = useState<NpsPurchaseTierStat[]>(() => loadFromLocalStorage(NPS_PURCHASE_TIER_STATS_STORAGE_KEY, []));
  const [yoyReferenceAggregates, setYoyReferenceAggregates] = useState<ProductMonthAggregate[]>(() => loadFromLocalStorage(YOY_REFERENCE_AGGREGATES_STORAGE_KEY, []));
  const [resolvedActionIds, setResolvedActionIds] = useState<Set<string>>(() => new Set(loadFromLocalStorage<string[]>(RESOLVED_ACTION_IDS_STORAGE_KEY, [])));

  // Dynamically compute deduplicated and image-merged reviews list for all metrics and components
  const reviews = useMemo(() => getDeduplicatedReviews(rawReviews), [rawReviews]);

  // Dynamically compute deduplicated incidents list for all metrics and components
  const incidents = useMemo(() => getDeduplicatedIncidents(rawIncidents), [rawIncidents]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [weekFilter, setWeekFilter] = useState<"this" | "last" | "all">("all");
  const [activeTab, setActiveTab] = useState<"metrics" | "products" | "incidents" | "voc" | "archive" | "claimcost" | "actionboard" | "csresponse">("metrics");
  const [metricsProductFilter, setMetricsProductFilter] = useState<string>("");
  const [metricsTypeFilter, setMetricsTypeFilter] = useState<"all" | "추천" | "중립" | "비추천" | "사고접수">("all");
  const [highlightTargetId, setHighlightTargetId] = useState<string | null>(null);

  const weekRanges = useMemo(() => {
    // 실제 오늘(KST) 기준으로 고정. 예전엔 로드된 리뷰/사고접수 데이터 중 가장 최근 날짜를
    // anchor로 덮어써서(더미데이터가 "항상 최신"처럼 보이게 하던 목업 시절 편법), 정적 시드
    // 데이터의 최신 날짜(예: 2026.08.14)가 실제 오늘 날짜(예: 2026.08.20)보다 과거면 "이번주"가
    // 실제와 어긋나 보이는 문제가 있었다. 실데이터 연동 단계에서는 항상 실제 날짜를 써야 한다.
    const anchor = getKSTDate();

    const day = anchor.getDay(); // 0 is Sun, 1 is Mon, ..., 5 is Fri, 6 is Sat

    // Calculate difference to Monday of the current reporting cycle (Monday ~ Sunday)
    const diffToMonday = day === 0 ? -6 : -(day - 1);

    const thisWeekMon = new Date(anchor);
    thisWeekMon.setDate(anchor.getDate() + diffToMonday);
    thisWeekMon.setHours(0, 0, 0, 0);

    const thisWeekSun = new Date(thisWeekMon);
    thisWeekSun.setDate(thisWeekMon.getDate() + 6);
    thisWeekSun.setHours(23, 59, 59, 999);

    const lastWeekMon = new Date(thisWeekMon);
    lastWeekMon.setDate(thisWeekMon.getDate() - 7);

    const lastWeekSun = new Date(lastWeekMon);
    lastWeekSun.setDate(lastWeekMon.getDate() + 6);

    return {
      thisWeek: {
        start: formatKSTDate(thisWeekMon),
        end: formatKSTDate(thisWeekSun),
        label: `이번주 (${formatKSTDate(thisWeekMon).slice(5)} ~ ${formatKSTDate(thisWeekSun).slice(5)})`
      },
      lastWeek: {
        start: formatKSTDate(lastWeekMon),
        end: formatKSTDate(lastWeekSun),
        label: `저번주 (${formatKSTDate(lastWeekMon).slice(5)} ~ ${formatKSTDate(lastWeekSun).slice(5)})`
      },
      // "전체기간"은 업로드된 전체 데이터가 아니라 이번주+저번주 2주 합산으로 정의된다.
      allPeriod: {
        start: formatKSTDate(lastWeekMon),
        end: formatKSTDate(thisWeekSun),
        label: `전체 기간 (${formatKSTDate(lastWeekMon).slice(5)} ~ ${formatKSTDate(thisWeekSun).slice(5)})`
      }
    };
  }, [reviews, incidents]);

  useEffect(() => {
    // 최초 마운트 시 6개 대용량 컬렉션을 IndexedDB에서 병렬로 불러온다(idbLoad는 같은 키의
    // localStorage 값이 남아있으면 1회 자동 이전까지 해준다 — idbStorage.ts 참고). 로드가 끝나기
    // 전까지는 hasLoadedPersistedData가 false라 아래 저장용 effect들이 동작하지 않으므로, 방금 막
    // 채워 넣은 시드값으로 실제 저장된 값을 덮어쓸 일이 없다.
    let cancelled = false;
    (async () => {
      const [loadedReviews, loadedIncidents, loadedOrderItems, loadedProblemForms, loadedChatRooms, loadedCsCostExportRows] = await Promise.all([
        idbLoad(REVIEWS_STORAGE_KEY, mapStaticReviews(staticReviews)),
        idbLoad(INCIDENTS_STORAGE_KEY, initialIncidentsData),
        idbLoad(ORDER_ITEMS_STORAGE_KEY, initialOrderItemsData),
        idbLoad(PROBLEM_FORMS_STORAGE_KEY, initialProblemFormsData),
        idbLoad(CHAT_ROOMS_STORAGE_KEY, initialChatRoomsData),
        idbLoad<CsCostExportRow[]>(CS_COST_EXPORT_STORAGE_KEY, []),
      ]);
      if (cancelled) return;
      setRawReviews(loadedReviews);
      setRawIncidents(loadedIncidents);
      setOrderItems(loadedOrderItems);
      setProblemForms(loadedProblemForms);
      setChatRooms(loadedChatRooms);
      setCsCostExportRows(loadedCsCostExportRows);
      setHasLoadedPersistedData(true);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // CSV로 업로드한 리뷰/OrderItem/ProblemForm/ChatRoom/Incident를 IndexedDB에 지속 저장 — 새로고침해도
  // 유지되도록 한다(Firestore/서버 DB 연동 아님, [[no-dashboard-db]] 방침 그대로). hasLoadedPersistedData가
  // true가 되기 전(초기 로드 완료 전)에는 저장을 건너뛴다 — 그렇지 않으면 마운트 직후 시드값으로
  // 저장된 실데이터를 덮어쓰는 경쟁 상태가 생긴다.
  useEffect(() => {
    if (!hasLoadedPersistedData) return;
    idbSave(REVIEWS_STORAGE_KEY, rawReviews);
  }, [rawReviews, hasLoadedPersistedData]);

  useEffect(() => {
    if (!hasLoadedPersistedData) return;
    idbSave(ORDER_ITEMS_STORAGE_KEY, orderItems);
  }, [orderItems, hasLoadedPersistedData]);

  useEffect(() => {
    if (!hasLoadedPersistedData) return;
    idbSave(PROBLEM_FORMS_STORAGE_KEY, problemForms);
  }, [problemForms, hasLoadedPersistedData]);

  useEffect(() => {
    if (!hasLoadedPersistedData) return;
    idbSave(CHAT_ROOMS_STORAGE_KEY, chatRooms);
  }, [chatRooms, hasLoadedPersistedData]);

  useEffect(() => {
    if (!hasLoadedPersistedData) return;
    idbSave(CS_COST_EXPORT_STORAGE_KEY, csCostExportRows);
  }, [csCostExportRows, hasLoadedPersistedData]);

  useEffect(() => {
    saveToLocalStorage(COMPANY_HOLIDAYS_STORAGE_KEY, companyHolidays);
  }, [companyHolidays]);

  useEffect(() => {
    saveToLocalStorage(MONTHLY_CS_LABOR_COST_ALLOCATION_STORAGE_KEY, monthlyCsLaborCostAllocation);
  }, [monthlyCsLaborCostAllocation]);

  useEffect(() => {
    saveToLocalStorage(DISPATCH_FAILURE_WEEKLY_STORAGE_KEY, dispatchFailureWeekly);
  }, [dispatchFailureWeekly]);

  useEffect(() => {
    saveToLocalStorage(DISPATCH_FAILURE_MONTHLY_STORAGE_KEY, dispatchFailureMonthly);
  }, [dispatchFailureMonthly]);

  useEffect(() => {
    saveToLocalStorage(NPS_SUMMARY_STORAGE_KEY, npsSummary);
  }, [npsSummary]);

  useEffect(() => {
    saveToLocalStorage(NPS_DETRACTOR_ROWS_STORAGE_KEY, npsDetractorRows);
  }, [npsDetractorRows]);

  useEffect(() => {
    saveToLocalStorage(NPS_CONTACTED_IDS_STORAGE_KEY, Array.from(npsContactedIds));
  }, [npsContactedIds]);

  useEffect(() => {
    saveToLocalStorage(NPS_WATCHLIST_THRESHOLD_STORAGE_KEY, npsWatchlistThreshold);
  }, [npsWatchlistThreshold]);

  useEffect(() => {
    saveToLocalStorage(NPS_TREND_STORAGE_KEY, npsTrend);
  }, [npsTrend]);

  useEffect(() => {
    saveToLocalStorage(NPS_PURCHASE_TIER_STATS_STORAGE_KEY, npsPurchaseTierStats);
  }, [npsPurchaseTierStats]);

  useEffect(() => {
    saveToLocalStorage(YOY_REFERENCE_AGGREGATES_STORAGE_KEY, yoyReferenceAggregates);
  }, [yoyReferenceAggregates]);

  useEffect(() => {
    saveToLocalStorage(RESOLVED_ACTION_IDS_STORAGE_KEY, Array.from(resolvedActionIds));
  }, [resolvedActionIds]);

  useEffect(() => {
    if (!hasLoadedPersistedData) return;
    idbSave(INCIDENTS_STORAGE_KEY, rawIncidents);
  }, [rawIncidents, hasLoadedPersistedData]);

  // Compute active weekly reviews dynamically from the main list with date boundaries!
  // "전체기간" (weekFilter === "all") is defined specifically as the combination of This Week and Last Week.
  const weeklyReviews = useMemo(() => {
    const active = reviews.filter(r => r.archived !== true);

    const range = weekFilter === "this" ? weekRanges.thisWeek : weekFilter === "last" ? weekRanges.lastWeek : weekRanges.allPeriod;

    return active.filter(r => {
      // Comparison is lexical and works perfectly for "YYYY.MM.DD" formatted strings
      return r.date >= range.start && r.date <= range.end;
    });
  }, [reviews, weekFilter, weekRanges]);

  // Compute active weekly incidents dynamically with date boundaries
  const weeklyIncidents = useMemo(() => {
    const range = weekFilter === "this" ? weekRanges.thisWeek : weekFilter === "last" ? weekRanges.lastWeek : weekRanges.allPeriod;
    return incidents.filter(i => i.date >= range.start && i.date <= range.end);
  }, [incidents, weekFilter, weekRanges]);

  // ProblemForm 기반 상품별 사고접수 건수(선택 기간, 상태 무관 전체 접수 건수 기준 — 반려/접수중
  // 포함) — Incident 모델보다 실제로 상시 업로드되는 최신 데이터라 이걸 우선 쓴다. ProblemForm이
  // 하나도 없을 때만 옛 Incident로 폴백.
  const weeklyAccidentCountsByProduct = useMemo(() => {
    const range = weekFilter === "this" ? weekRanges.thisWeek : weekFilter === "last" ? weekRanges.lastWeek : weekRanges.allPeriod;
    const counts: Record<string, number> = {};

    if (problemForms.length > 0) {
      problemForms.forEach(pf => {
        if (!pf.receivedDate || pf.receivedDate < range.start || pf.receivedDate > range.end) return;
        const base = (pf.productName || "").split("/")[0].trim();
        if (!base) return;
        counts[base] = (counts[base] || 0) + 1;
      });
      return counts;
    }

    weeklyIncidents.forEach(inc => {
      counts[inc.product] = (counts[inc.product] || 0) + 1;
    });
    return counts;
  }, [problemForms, weeklyIncidents, weekFilter, weekRanges]);

  // weeklyAccidentCountsByProduct와 완전히 동일한 필터링(기간·소스·폴백 우선순위)을 그대로 반복해
  // 레코드 배열을 만든다 — 두 값이 서로 다른 계산 경로를 타면 "라벨 N건"과 "실제 나열 개수"가
  // 어긋나는 사고가 재발하므로, 절대 별도 로직으로 분리하지 않는다.
  const weeklyAccidentRecordsByProduct = useMemo(() => {
    const range = weekFilter === "this" ? weekRanges.thisWeek : weekFilter === "last" ? weekRanges.lastWeek : weekRanges.allPeriod;
    const records: Record<string, AccidentCategoryRecord[]> = {};

    const push = (product: string, detail?: string, type?: string) => {
      if (!product) return;
      if (!records[product]) records[product] = [];
      records[product].push({
        detail: (detail && detail.trim()) || (type && type.trim()) || "상세 미기재",
        topCategory: classifyAccidentTopCategory(detail, type)
      });
    };

    if (problemForms.length > 0) {
      problemForms.forEach(pf => {
        if (!pf.receivedDate || pf.receivedDate < range.start || pf.receivedDate > range.end) return;
        const base = (pf.productName || "").split("/")[0].trim();
        if (!base) return;
        push(base, pf.accidentDetail, pf.accidentType);
      });
      return records;
    }

    weeklyIncidents.forEach(inc => {
      push(inc.product, inc.accidentDetail, inc.accidentType);
    });
    return records;
  }, [problemForms, weeklyIncidents, weekFilter, weekRanges]);

  // Compute product statistics dynamically from active weeklyReviews & weeklyIncidents!
  const productStats = useMemo(() => {
    const map = new Map<string, {
      totalCount: number;
      ratedCount: number;
      sumRating: number;
      recommend: number;
      neutral: number;
      notRecommend: number;
      accidentCount: number;
    }>();

    weeklyReviews.forEach(r => {
      if (!map.has(r.product)) {
        map.set(r.product, { totalCount: 0, ratedCount: 0, sumRating: 0, recommend: 0, neutral: 0, notRecommend: 0, accidentCount: 0 });
      }
      const val = map.get(r.product)!;
      val.totalCount++;
      if (r.rating > 0) {
        val.ratedCount++;
        val.sumRating += r.rating;
      }
      if (r.type === "추천") val.recommend++;
      else if (r.type === "중립") val.neutral++;
      else if (r.type === "비추천") val.notRecommend++;
    });

    // Count accidents per product from ProblemForm(선호)/Incident(폴백) — 리뷰가 없는 상품도
    // 누락되지 않도록 map에 없으면 새로 시드한다.
    Object.entries(weeklyAccidentCountsByProduct).forEach(([product, count]) => {
      if (!map.has(product)) {
        map.set(product, { totalCount: 0, ratedCount: 0, sumRating: 0, recommend: 0, neutral: 0, notRecommend: 0, accidentCount: 0 });
      }
      map.get(product)!.accidentCount += count;
    });

    const statsList: ProductStat[] = [];
    map.forEach((val, product) => {
      const avgRating = val.ratedCount > 0 ? Math.round((val.sumRating / val.ratedCount) * 100) / 100 : 0;
      const recommendRate = val.totalCount > 0 ? Math.round((val.recommend / val.totalCount) * 100) : 0;
      statsList.push({
        product,
        totalCount: val.totalCount,
        avgRating,
        recommend: val.recommend,
        neutral: val.neutral,
        notRecommend: val.notRecommend,
        accidentCount: val.accidentCount,
        recommendRate
      });
    });

    // Sort by totalCount descending by default
    return statsList.sort((a, b) => b.totalCount - a.totalCount);
  }, [weeklyReviews, weeklyAccidentCountsByProduct]);

  // "처리 필요" 탭 + 상단 탭 배지가 공유하는 대기열. 주간 필터와 무관하게 전체 기간 기준(지금 당장
  // 처리해야 할 건이 하필 저번주 필터에 가려서 안 보이면 안 되므로) reviews/problemForms 전체를 본다.
  // 사고접수는 ProblemForm 기준(status==="접수중"만) — 처리완료/반려됨/최종반려됨이 되면 다음
  // 재계산 때 자동으로 목록에서 빠진다(수동 처리 버튼 없음, 상태값이 유일한 소스).
  const actionItems = useMemo(() => {
    const list: ActionItem[] = [];

    problemForms.forEach(pf => {
      if (pf.status !== "접수중") return;
      const category = classifyCategory(pf.accidentDetail || pf.accidentType || "", 0, undefined);
      list.push({
        key: `incident-${pf.id}`,
        type: "incident",
        product: (pf.productName || "").split("/")[0].trim() || "(상품명 없음)",
        customer: getMaskedName(Number(pf.id.replace(/\D/g, "")) || 0, pf.customerName),
        date: pf.receivedDate || "",
        summary: pf.accidentDetail || pf.accidentType || "사고접수 내용 없음",
        department: getDepartmentForCategory(category),
        targetId: pf.id,
        adminLink: pf.orderItemRef ? `https://admin.honestflower.kr/orders/${pf.orderItemRef}` : undefined,
        importChannel: pf.importChannel,
      });
    });

    // 리뷰는 exposed===false가 되면(어드민이 이미 확인/조치한 것으로 간주) 자동으로 대기열에서
    // 빠진다. "답변 달았는지" 자체는 CSV로 안 들어오는 정보라(관리자 답변은 ARES 어드민의 별도
    // ReviewComment 모델이라 export에 없음) exposed 하나로만 판단하고, 애매한 경우를 위해
    // resolvedActionIds 수동 오버라이드만 남겨둔다.
    reviews.forEach(r => {
      const isNegative = r.type === "비추천" || (r.rating > 0 && r.rating <= 2);
      if (!isNegative) return;
      if (r.exposed !== true) return;
      const key = `review-${r.id}`;
      if (resolvedActionIds.has(key)) return;
      list.push({
        key,
        type: "review",
        product: r.product,
        customer: r.reviewer || getMaskedName(r.id, r.rawReviewer),
        date: r.date,
        summary: r.review || "",
        department: getDepartmentForCategory(r.category),
        targetId: String(r.id),
        adminLink: `https://server.honestflower.kr/bloom/reviews/review/${r.id}/change/`,
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [reviews, problemForms, resolvedActionIds]);

  const resolveActionItem = (key: string) => {
    setResolvedActionIds(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  // 현재 주간 대시보드에 활성화(archived !== true)된 리뷰를 전부 archived로 표시해 주간 집계를 비운다.
  // 로컬 상태(IndexedDB에 저장됨)만 변경 — Firestore/서버 DB 연동 아님([[no-dashboard-db]] 방침).
  const archiveActiveReviews = async () => {
    const activeCount = rawReviews.filter(r => r.archived !== true).length;
    if (activeCount === 0) {
      alert("현재 주간 대시보드에 활성화된 데이터가 없습니다.");
      return;
    }
    setRawReviews(prev => prev.map(r => (r.archived !== true ? { ...r, archived: true } : r)));
  };

  // 새 리뷰를 로컬 상태에 추가 — IndexedDB에 저장됨(Firestore 연동 아님).
  const addReview = async (newReview: Omit<Review, "id">) => {
    const maxId = rawReviews.length > 0 ? Math.max(...rawReviews.map(r => r.id)) : 0;
    const nextId = maxId + 1;
    const reviewDoc: Review = {
      ...newReview,
      id: nextId,
      archived: false, // newly added live reviews are active by default
      exposed: newReview.exposed !== undefined ? newReview.exposed : true // 신규 리뷰는 기본 노출 상태
    };
    setRawReviews(prev => [...prev, reviewDoc]);
  };

  // 전체 데이터를 초기 시드값으로 되돌린다 — 로컬 상태만 초기화(Firestore 연동 아님).
  const resetToInitialData = async () => {
    setIsSyncing(true);
    try {
      setRawReviews(mapStaticReviews(staticReviews));
      setRawIncidents(initialIncidentsData);
      setOrderItems(initialOrderItemsData);
      setProblemForms(initialProblemFormsData);
      setChatRooms(initialChatRoomsData);
      setCsCostExportRows([]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Dedicated CS Incidents Importer (Completely separate from Photo Reviews) with Smart Deduplication
  const importIncidents = async (newIncidents: Incident[], replace: boolean = true) => {
    setIsSyncing(true);
    try {
      let combined: Incident[];
      if (!replace) {
        // Deep deduplicated merge
        const mergedList: Incident[] = rawIncidents.map(i => ({ ...i }));
        newIncidents.forEach(incoming => {
          const matchIdx = mergedList.findIndex(existing => {
            if (existing.id && incoming.id && (existing.id === incoming.id || existing.id.replace(/\D/g, "") === incoming.id.replace(/\D/g, ""))) {
              return true;
            }
            if (existing.orderNumber && incoming.orderNumber && existing.orderNumber === incoming.orderNumber && existing.product === incoming.product) {
              return true;
            }
            if (existing.date === incoming.date && existing.product === incoming.product) {
              const inText = (incoming.claimText || "").trim();
              const exText = (existing.claimText || "").trim();
              if (inText.length >= 6 && exText.length >= 6 && (inText === exText || inText.includes(exText) || exText.includes(inText))) {
                return true;
              }
            }
            return false;
          });

          if (matchIdx !== -1) {
            // Update matched existing record
            const ex = mergedList[matchIdx];
            if (incoming.refundAmount && !ex.refundAmount) ex.refundAmount = incoming.refundAmount;
            if (incoming.image_url && !ex.image_url) ex.image_url = incoming.image_url;
            if (incoming.csResponse && !ex.csResponse) ex.csResponse = incoming.csResponse;
            if (incoming.orderNumber && !ex.orderNumber) ex.orderNumber = incoming.orderNumber;
            if (incoming.importChannel && !ex.importChannel) ex.importChannel = incoming.importChannel;
            if (incoming.incidentStatus) ex.incidentStatus = incoming.incidentStatus;
            if (incoming.claimText && incoming.claimText.length > (ex.claimText?.length || 0)) {
              ex.claimText = incoming.claimText;
            }
          } else {
            mergedList.push({ ...incoming });
          }
        });
        combined = mergedList;
      } else {
        combined = [...newIncidents];
      }

      combined.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.id.localeCompare(a.id);
      });

      setRawIncidents(combined);
    } catch (err) {
      console.error("CS Incident import error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Dedicated OrderItem Importer (Claim Cost cohort source) — local state only, no Firestore sync,
  // same scope as importIncidents. Deduplicates by exact orderNumber (natural unique key).
  const importOrderItems = async (newItems: OrderItem[], replace: boolean = true) => {
    setIsSyncing(true);
    try {
      let combined: OrderItem[];
      if (!replace) {
        // id로 병합한다 — 주문번호는 한 주문에 여러 상품이 담기면 그 줄들이 전부 같은 값을 공유해서
        // (그룹주문번호처럼 동작) 키로 쓰면 같은 주문번호를 가진 다른 상품 줄들이 서로를 덮어씀.
        const mergedMap = new Map<string, OrderItem>();
        orderItems.forEach(i => mergedMap.set(i.id, { ...i }));
        newItems.forEach(incoming => {
          const key = incoming.id;
          const existing = mergedMap.get(key);
          if (existing) {
            if (incoming.refundAmount !== undefined) existing.refundAmount = incoming.refundAmount;
            if (incoming.settlementPrice !== undefined) existing.settlementPrice = incoming.settlementPrice;
            if (incoming.claimStatus) existing.claimStatus = incoming.claimStatus;
          } else {
            mergedMap.set(key, { ...incoming });
          }
        });
        combined = Array.from(mergedMap.values());
      } else {
        combined = [...newItems];
      }

      combined.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      setOrderItems(combined);
    } catch (err) {
      console.error("OrderItem import error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Dedicated ProblemForm(사고접수) Importer — local state only, no Firestore sync, same scope as
  // importOrderItems. Deduplicates by exact id (natural unique key). Only claim-cost-relevant fields
  // are parsed (see parseCSVToProblemForms); the full archive UI is a separate future phase.
  const importProblemForms = async (newItems: ProblemForm[], replace: boolean = true) => {
    setIsSyncing(true);
    try {
      let combined: ProblemForm[];
      if (!replace) {
        const mergedMap = new Map<string, ProblemForm>();
        problemForms.forEach(p => mergedMap.set(p.id, { ...p }));
        newItems.forEach(incoming => {
          mergedMap.set(incoming.id, { ...incoming });
        });
        combined = Array.from(mergedMap.values());
      } else {
        combined = [...newItems];
      }

      setProblemForms(combined);
    } catch (err) {
      console.error("ProblemForm import error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Dedicated ChatRoom(상담 채팅/전화 SLA) Importer — local state only, no Firestore sync, same
  // scope as importProblemForms. Deduplicates by exact key(natural unique key from the admin export).
  const importChatRooms = async (newItems: ChatRoom[], replace: boolean = true) => {
    setIsSyncing(true);
    try {
      let combined: ChatRoom[];
      if (!replace) {
        const mergedMap = new Map<string, ChatRoom>();
        chatRooms.forEach(c => mergedMap.set(c.key, { ...c }));
        newItems.forEach(incoming => {
          mergedMap.set(incoming.key, { ...incoming });
        });
        combined = Array.from(mergedMap.values());
      } else {
        combined = [...newItems];
      }

      setChatRooms(combined);
    } catch (err) {
      console.error("ChatRoom import error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // "CS비용 검증(선택)" 위젯이 파싱한 CS 비용 export를 전역에 반영 — 병합 개념 없이 항상 전체 교체.
  const importCsCostExportRows = (rows: CsCostExportRow[]) => {
    setCsCostExportRows(rows);
  };

  // 발송불가율(SCM VOC) — period(주/월) 기준으로 병합. 같은 period가 다시 올라오면 새 값으로 교체(매주
  // 재실행한 쿼리로 최신화하는 워크플로우 그대로 반영), replace 모드는 통째로 교체.
  const importDispatchFailureWeekly = (newRows: DispatchFailureRow[], replace: boolean = true) => {
    let combined: DispatchFailureRow[];
    if (!replace) {
      const map = new Map<string, DispatchFailureRow>();
      dispatchFailureWeekly.forEach(r => map.set(r.period, { ...r }));
      newRows.forEach(r => map.set(r.period, { ...r }));
      combined = Array.from(map.values());
    } else {
      combined = [...newRows];
    }
    combined.sort((a, b) => a.period.localeCompare(b.period));
    setDispatchFailureWeekly(combined);
  };

  const importDispatchFailureMonthly = (newRows: DispatchFailureRow[], replace: boolean = true) => {
    let combined: DispatchFailureRow[];
    if (!replace) {
      const map = new Map<string, DispatchFailureRow>();
      dispatchFailureMonthly.forEach(r => map.set(r.period, { ...r }));
      newRows.forEach(r => map.set(r.period, { ...r }));
      combined = Array.from(map.values());
    } else {
      combined = [...newRows];
    }
    combined.sort((a, b) => a.period.localeCompare(b.period));
    setDispatchFailureMonthly(combined);
  };

  // 원본 CSV 임포터(parseNpsImportCsv) 한 번의 결과로 요약/Detractor/추이 3종을 동시에 통째로
  // 교체한다 — 셋 다 같은 업로드에서 나온 값이라 따로 병합할 개념이 없다(csCostExportRows와 동일한
  // "전체 교체" 패턴). 컨택 상태는 npsContactedIds에 id로 별도 보관되니 rows가 통째로 바뀌어도
  // (재업로드) 이미 컨택 완료한 고객 표시는 안 사라진다.
  const applyNpsImport = (result: NpsImportResult) => {
    setNpsSummary({ ...result.summary, asOf: formatKSTDate(getKSTDate()) });
    setNpsDetractorRows(result.detractorRows);
    setNpsTrend(result.trend);
    setNpsPurchaseTierStats(result.purchaseTierStats);
  };

  // 2025년 등 "참고용" OrderItem/ProblemForm CSV를 그대로 파싱해서(기존 파서 재사용) 상품×월
  // 집계만 뽑고 원본 행은 버린다 — 같은 달을 다시 올리면 그 달 집계만 덮어쓰고 나머지 달은 유지.
  const importYoyReferenceData = (orderItems: OrderItem[], problemForms: ProblemForm[]) => {
    const incoming = computeProductMonthAggregates(orderItems, problemForms);
    const incomingMonths = new Set(incoming.map(a => a.month));
    setYoyReferenceAggregates(prev => [
      ...prev.filter(a => !incomingMonths.has(a.month)),
      ...incoming,
    ]);
  };

  const toggleNpsContact = (id: string) => {
    setNpsContactedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk import parsed CSV reviews into local state (IndexedDB에 저장됨, Firestore 연동 아님)
  const importParsedReviews = async (newReviews: Review[], append: boolean = true) => {
    setIsSyncing(true);
    try {
      let combined: Review[];
      if (append) {
        // Safe non-destructive append:
        // Find current max id in rawReviews
        const currentMaxId = rawReviews.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);
        let nextAvailableId = Math.max(currentMaxId + 1, 201);

        const existingMap = new Map<number, Review>();
        rawReviews.forEach(r => existingMap.set(r.id, { ...r }));

        newReviews.forEach(incoming => {
          if (existingMap.has(incoming.id)) {
            const existing = existingMap.get(incoming.id)!;
            if (incoming.product === existing.product && incoming.date === existing.date) {
              // 업로드하는 CSV는 항상 최신 정답 데이터이므로 핵심 필드(rating/type 포함)는 전부 새
              // 값으로 덮어쓴다. CSV엔 없지만 다른 경로로 이미 붙어있던 보강 정보(사고접수 처리결과
              // 등)는 새 값이 없을 때만 보존한다. 사고접수 확정 여부는 incidentStatus 뱃지로 별도
              // 표시할 뿐 rating/type을 강제로 덮어쓰지 않는다 — 한 번 사고접수로 확정된 리뷰 ID가
              // 이후 완전히 다른(좋은) 내용으로 재업로드돼도 영원히 1점/비추천에 고정되는 버그가
              // 있었다(신규 CSV의 rating/type이 위 스프레드로 이미 반영됐는데 아래서 다시 덮어썼음).
              const merged: Review = {
                ...existing,
                ...incoming,
                incidentStatus: incoming.incidentStatus ?? existing.incidentStatus,
                accidentType: incoming.accidentType ?? existing.accidentType,
                accidentDetail: incoming.accidentDetail ?? existing.accidentDetail,
                refundAmount: incoming.refundAmount !== undefined ? incoming.refundAmount : existing.refundAmount,
                image_urls: incoming.image_url
                  ? Array.from(new Set([...(existing.image_urls || (existing.image_url ? [existing.image_url] : [])), incoming.image_url]))
                  : (existing.image_urls || (existing.image_url ? [existing.image_url] : [])),
              };
              existingMap.set(incoming.id, merged);
            } else {
              // Conflicting ID from a new CSV (e.g. new CSV starting with ID 1 but totally different review)
              // Assign a new safe ID so it doesn't overwrite existing review!
              const newSafeId = nextAvailableId++;
              existingMap.set(newSafeId, {
                ...incoming,
                id: newSafeId,
                reviewer: incoming.reviewer || getMaskedName(newSafeId, incoming.rawReviewer)
              });
            }
          } else {
            // New ID: add directly
            existingMap.set(incoming.id, { ...incoming });
          }
        });

        combined = Array.from(existingMap.values());
      } else {
        combined = [...newReviews];
      }

      combined.sort((a, b) => {
        if (b.date !== a.date) {
          return b.date.localeCompare(a.date);
        }
        return b.id - a.id;
      });

      setRawReviews(combined);
    } catch (err) {
      console.error("CSV Import error:", err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ReviewsContext.Provider value={{
      reviews,
      weeklyReviews,
      incidents,
      weeklyIncidents,
      weeklyAccidentCountsByProduct,
      weeklyAccidentRecordsByProduct,
      actionItems,
      resolveActionItem,
      orderItems,
      importOrderItems,
      problemForms,
      importProblemForms,
      chatRooms,
      importChatRooms,
      csCostExportRows,
      importCsCostExportRows,
      dispatchFailureWeekly,
      importDispatchFailureWeekly,
      dispatchFailureMonthly,
      importDispatchFailureMonthly,
      npsSummary,
      npsDetractorRows,
      npsTrend,
      npsPurchaseTierStats,
      yoyReferenceAggregates,
      importYoyReferenceData,
      applyNpsImport,
      npsContactedIds,
      toggleNpsContact,
      npsWatchlistThreshold,
      setNpsWatchlistThreshold,
      companyHolidays,
      setCompanyHolidays,
      monthlyCsLaborCostAllocation,
      setMonthlyCsLaborCostAllocation,
      productStats,
      isLoading,
      addReview,
      archiveActiveReviews,
      isSyncing,
      weekFilter,
      setWeekFilter,
      weekRanges,
      resetToInitialData,
      activeTab,
      setActiveTab,
      metricsProductFilter,
      setMetricsProductFilter,
      metricsTypeFilter,
      setMetricsTypeFilter,
      importParsedReviews,
      importIncidents,
      highlightTargetId,
      setHighlightTargetId
    }}>
      {children}
    </ReviewsContext.Provider>
  );
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (!context) {
    throw new Error("useReviews must be used within a ReviewsProvider");
  }
  return context;
}
