import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { reviewsData as staticReviews, Review, ProductStat } from "../data/classifiedReviews";
import { Incident, initialIncidentsData } from "../data/initialIncidents";
import { OrderItem, initialOrderItemsData } from "../data/orderItems";
import { ProblemForm, initialProblemFormsData } from "../data/problemForms";
import { ChatRoom, initialChatRoomsData } from "../data/chatRooms";
import { CsCostExportRow, DispatchFailureRow } from "../utils/csvParser";
import { defaultCompanyHolidays } from "../data/companyHolidays";
import { idbLoad, idbSave } from "../utils/idbStorage";
import { DEFAULT_MONTHLY_CS_LABOR_COST_ALLOCATION_KRW } from "../utils/chatRoomEngine";

interface ReviewsContextType {
  reviews: Review[];
  weeklyReviews: Review[];
  incidents: Incident[];
  weeklyIncidents: Incident[];
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

const MASKED_NAMES = [
  "김*정", "이*민", "박*현", "최*원", "정*우", "강*서", "조*아", "윤*준", "장*민", "한*영",
  "오*지", "서*훈", "신*연", "권*재", "황*우", "송*은", "안*진", "임*혁", "전*하", "홍*윤"
];

// Helper: Ensure a name is masked to 'X*Y' format or assign a consistent masked name
export function getMaskedName(id: number, rawName?: string): string {
  if (rawName && rawName.trim()) {
    const trimmed = rawName.trim();
    if (trimmed.includes("*")) return trimmed;
    if (trimmed.length <= 1) return trimmed;
    if (trimmed.length === 2) return trimmed[0] + "*";
    return trimmed[0] + "*" + trimmed.slice(2);
  }
  return MASKED_NAMES[id % MASKED_NAMES.length];
}

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
    
    // Calculate difference to Saturday of the current reporting cycle (Saturday ~ Friday)
    const diffToSaturday = day === 6 ? 0 : -(day + 1);
    
    const thisWeekSat = new Date(anchor);
    thisWeekSat.setDate(anchor.getDate() + diffToSaturday);
    thisWeekSat.setHours(0, 0, 0, 0);
    
    const thisWeekFri = new Date(thisWeekSat);
    thisWeekFri.setDate(thisWeekSat.getDate() + 6);
    thisWeekFri.setHours(23, 59, 59, 999);
    
    const lastWeekSat = new Date(thisWeekSat);
    lastWeekSat.setDate(thisWeekSat.getDate() - 7);
    
    const lastWeekFri = new Date(lastWeekSat);
    lastWeekFri.setDate(lastWeekSat.getDate() + 6);
    
    return {
      thisWeek: {
        start: formatKSTDate(thisWeekSat),
        end: formatKSTDate(thisWeekFri),
        label: `이번주 (${formatKSTDate(thisWeekSat).slice(5)} ~ ${formatKSTDate(thisWeekFri).slice(5)})`
      },
      lastWeek: {
        start: formatKSTDate(lastWeekSat),
        end: formatKSTDate(lastWeekFri),
        label: `저번주 (${formatKSTDate(lastWeekSat).slice(5)} ~ ${formatKSTDate(lastWeekFri).slice(5)})`
      },
      // "전체기간"은 업로드된 전체 데이터가 아니라 이번주+저번주 2주 합산으로 정의된다.
      allPeriod: {
        start: formatKSTDate(lastWeekSat),
        end: formatKSTDate(thisWeekFri),
        label: `전체 기간 (${formatKSTDate(lastWeekSat).slice(5)} ~ ${formatKSTDate(thisWeekFri).slice(5)})`
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

    // Count incidents per product from independent weeklyIncidents data
    weeklyIncidents.forEach(inc => {
      if (inc.incidentStatus === "처리완료") {
        if (!map.has(inc.product)) {
          map.set(inc.product, { totalCount: 0, ratedCount: 0, sumRating: 0, recommend: 0, neutral: 0, notRecommend: 0, accidentCount: 0 });
        }
        map.get(inc.product)!.accidentCount++;
      }
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
  }, [weeklyReviews, weeklyIncidents]);

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
        const mergedMap = new Map<string, OrderItem>();
        orderItems.forEach(i => mergedMap.set(i.orderNumber || i.id, { ...i }));
        newItems.forEach(incoming => {
          const key = incoming.orderNumber || incoming.id;
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
              // 업로드하는 CSV는 항상 최신 정답 데이터이므로 핵심 필드는 전부 새 값으로 덮어쓴다.
              // CSV엔 없지만 다른 경로로 이미 붙어있던 보강 정보(사고접수 처리결과 등)는 새 값이 없을 때만 보존한다.
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
              if (merged.incidentStatus === "처리완료") {
                merged.type = "비추천";
                merged.rating = 1;
              }
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
