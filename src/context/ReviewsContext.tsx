import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, writeBatch, query, orderBy, addDoc, limit, getDocs } from "firebase/firestore";
import { reviewsData as staticReviews, Review, ProductStat } from "../data/classifiedReviews";
import { Incident, initialIncidentsData } from "../data/initialIncidents";

interface ReviewsContextType {
  reviews: Review[];
  weeklyReviews: Review[];
  incidents: Incident[];
  weeklyIncidents: Incident[];
  productStats: ProductStat[];
  isLoading: boolean;
  isFirestoreEmpty: boolean;
  isUsingLocalData: boolean;
  syncWithFirestore: () => Promise<void>;
  addReview: (review: Omit<Review, "id">) => Promise<void>;
  archiveActiveReviews: () => Promise<void>;
  isSyncing: boolean;
  weekFilter: "this" | "last" | "all";
  setWeekFilter: (filter: "this" | "last" | "all") => void;
  weekRanges: {
    thisWeek: { start: string; end: string; label: string };
    lastWeek: { start: string; end: string; label: string };
  };
  refreshData: () => Promise<void>;
  resetToInitialData: () => Promise<void>;
  activeTab: "metrics" | "products" | "incidents" | "voc" | "archive";
  setActiveTab: (tab: "metrics" | "products" | "incidents" | "voc" | "archive") => void;
  metricsProductFilter: string;
  setMetricsProductFilter: (p: string) => void;
  metricsTypeFilter: "all" | "추천" | "중립" | "비추천" | "사고접수";
  setMetricsTypeFilter: (t: "all" | "추천" | "중립" | "비추천" | "사고접수") => void;
  importParsedReviews: (newReviews: Review[], append?: boolean) => Promise<void>;
  importIncidents: (newIncidents: Incident[], replace?: boolean) => Promise<void>;
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

// Helper: Normalize any date format to "YYYY.MM.DD"
function normalizeDate(d: any): string {
  if (!d) return "";
  
  // If it's a Firestore Timestamp or Date object
  if (typeof d === "object" && d !== null) {
    if (typeof d.toDate === "function") {
      const dateObj = d.toDate();
      const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
      const kstDate = new Date(utc + (3600000 * 9));
      return formatKSTDate(kstDate);
    }
    if (d.seconds) {
      const dateObj = new Date(d.seconds * 1000);
      const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
      const kstDate = new Date(utc + (3600000 * 9));
      return formatKSTDate(kstDate);
    }
    if (d instanceof Date) {
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const kstDate = new Date(utc + (3600000 * 9));
      return formatKSTDate(kstDate);
    }
  }

  // If it's a string or other primitive
  let s = String(d).trim();
  
  // Support Korean format: e.g. "2026년 06월 27일" -> "2026.06.27"
  s = s.replace(/년/g, ".").replace(/월/g, ".").replace(/일/g, "");
  
  if (s.includes("T")) {
    s = s.split("T")[0];
  } else if (s.includes(" ")) {
    s = s.split(" ")[0];
  }
  
  // Replace dashes and slashes with dots
  s = s.replace(/-/g, ".").replace(/\//g, ".");
  
  // Strip non-numeric and non-dot characters
  s = s.replace(/[^0-9.]/g, "");
  
  // Ensure padded double digit format
  const parts = s.split(".").filter(Boolean);
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const dPart = parts[2].padStart(2, "0");
    return `${y}.${m}.${dPart}`;
  } else if (parts.length === 2) {
    // Missing year (e.g. "06.27" or "6.27") -> assume current year from local KST date
    const currentYear = getKSTDate().getFullYear();
    const m = parts[0].padStart(2, "0");
    const dPart = parts[1].padStart(2, "0");
    return `${currentYear}.${m}.${dPart}`;
  }
  
  return s;
}

const MASKED_NAMES = [
  "김*정", "이*민", "박*현", "최*원", "정*우", "강*서", "조*아", "윤*준", "장*민", "한*영",
  "오*지", "서*훈", "신*연", "권*재", "황*우", "송*은", "안*진", "임*혁", "전*하", "홍*윤"
];

// Helper: Remove undefined properties from an object before writing to Firestore
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) {
      if (Array.isArray(val)) {
        clean[key] = val.filter(v => v !== undefined);
      } else if (val !== null && typeof val === "object" && !(val instanceof Date)) {
        clean[key] = sanitizeForFirestore(val);
      } else {
        clean[key] = val;
      }
    }
  });
  return clean;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: Record<string, any>;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
      
      const sameReviewer = item.rawReviewer && m.rawReviewer && mReviewer === itemReviewer && m.date === item.date && m.product === item.product && mText === itemText;
      const sameContentIntegrity = itemText.length >= 8 && mText === itemText && m.date === item.date && m.product === item.product;

      return Boolean(sameReviewer || sameContentIntegrity);
    });
    
    if (existing) {
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

// Resilient parsing of Firestore document to Review object
function parseFirestoreReview(docId: string, data: any, fallbackId: number): Review {
  // 1. Parse or derive numeric ID
  let idVal = data.id !== undefined ? data.id : data.ID;
  if (idVal === undefined) idVal = data.No !== undefined ? data.No : data.no;
  if (idVal === undefined) idVal = data.번호 !== undefined ? data.번호 : data.index;
  
  let id = Number(idVal);
  if (isNaN(id) || id === 0) {
    const numericDocId = Number(docId.replace(/\D/g, ""));
    id = !isNaN(numericDocId) && numericDocId > 0 ? numericDocId : fallbackId;
  }

  // 2. Resolve & Normalize Date
  const rawDate = data.date || data.Date || data.DATE || data.작성일 || data.등록일 || data.날짜 || "";
  let date = normalizeDate(rawDate);
  if (!date) {
    date = formatKSTDate(getKSTDate());
  }

  // 3. Resolve Product
  const product = String(data.product || data.Product || data.PRODUCT || data.상품명 || data.상품 || "알 수 없는 상품").trim();

  // 4. Resolve Rating
  const ratingVal = data.rating !== undefined ? data.rating : (data.Rating !== undefined ? data.Rating : (data.평점 !== undefined ? data.평점 : (data.별점 !== undefined ? data.별점 : 5)));
  const rating = Number(ratingVal) || 5;

  // 5. Resolve Review Text
  const reviewText = String(data.review || data.Review || data.REVIEW || data.후기 || data.내용 || data.본문 || "").trim();

  // 6. Resolve Type
  const rawType = data.type || data.Type || data.TYPE || data.추천여부 || data.분류 || "";
  const type = deriveReviewType(rating, rawType);

  // 7. Resolve Category
  const category = String(data.category || data.Category || data.CATEGORY || data.카테고리 || data.속성 || "품질/상태").trim();

  // 8. Resolve Department
  const department = String(data.department || data.Department || data.DEPARTMENT || data.부서 || data.담당부서 || "SCM & MD").trim();

  // 8.5 Resolve Reviewer
  const rawReviewer = data.reviewer || data.Reviewer || data.REVIEWER || data.작성자 || data.이름 || data.user || data.User || data.USER || "";
  const reviewer = getMaskedName(id, rawReviewer);

  const archived = data.archived === true || data.Archived === true;

  // 9. Manual Overrides requested by the user to classify specific IDs as dissatisfied (비추천)
  if (id === 109) {
    return {
      id,
      date: "2026.07.01",
      product: "프릴 리시안셔스",
      rating: 3,
      type: "비추천",
      category: "품질/상태",
      department: "SCM & MD",
      review: "꽃 들이 많이 떨어져 있어서 아쉬웠어요ㅠㅠ",
      archived: false,
      reviewer: getMaskedName(id, "김*정"),
      rawReviewer: "김*정"
    };
  }
  if (id === 107) {
    return {
      id,
      date: "2026.07.01",
      product: "플라워 럭키박스",
      rating: 3,
      type: "비추천",
      category: "품질/상태",
      department: "SCM & MD",
      review: "오픈하는데 잎이 우수우 떨어지네요 그건 뭐 어쩔수 없다하더라도... 홈페이지 홍보 사진과 풍성함이 다른것 같아요 한번더 받아보고 또 실망감이 든다면 재주문은 안할것 같아요",
      archived: false,
      reviewer: getMaskedName(id, "김*정"),
      rawReviewer: "김*정"
    };
  }
  if (id === 131) {
    return {
      id,
      date: "2026.06.30",
      product: "7월 플로리스트픽 내추럴",
      rating: 3,
      type: "비추천",
      category: "품질/상태",
      department: "SCM & MD",
      review: "3번째배송인데 지난번은 누락배송 이번엔 마지막사진처럼 꽃들을 고정하는장치로 고정하지않아 카네이션 머리가 부러져왔어요. 몇송이 안되는 꽃중 한놈이 망가져배송. ㅠ히야신스는 저렇게 짧뚱하게 보내와서 맨마지막 놈은 화병에 갇혀버리고...얼마전 해바라기도 시들어오더니 속상하네요. 아니 화가나요. 꽃구성 첫번째사진처람 이뻐요. 그나마 대가리 부러진걸 대표사진으로안한건 예의사밉니다",
      archived: false,
      reviewer: getMaskedName(id, "고객"),
      rawReviewer: "고객"
    };
  }
  if (id === 195) {
    return {
      id,
      date: "2026.06.28",
      product: "테디베어 해바라기",
      rating: 3,
      type: "비추천",
      category: "배송/포장",
      department: "SCM & CS",
      review: "저번에 동글동글 예쁜 아이들로 와서 또 주문했는데 이번엔….🫠 그리고 배송도 너무 아쉬웠어요ㅠㅠ 꽃 중 하나는 아예 안 꽂혀 있었어요",
      archived: false,
      reviewer: getMaskedName(id, "고객"),
      rawReviewer: "고객"
    };
  }
  if (id === 1037) {
    return {
      id,
      date: "2026.07.11",
      product: "튜베로즈",
      rating: 5,
      type: "비추천",
      category: "품질/상태",
      department: "SCM & MD",
      review: "이렇게 누렇게 뜬걸 보내주시나요",
      archived: false,
      reviewer: getMaskedName(id, "윤*현"),
      rawReviewer: "윤*현",
      image_url: "https://file.honestflower.kr/media/images/reviewimage/1783761170/75847_large.webp"
    };
  }

  if (id === 1039) {
    return {
      id,
      date: "2026.07.11",
      product: "7월 플로리스트픽 가니쉬 부쉬",
      rating: 3,
      type: "비추천",
      category: "상품구성/양",
      department: "MD",
      review: "신지매를 한번도 구매해본적이 없어서 모르다가 오늘 뒤늦게 알았는데 제가 받은건 신지매가 아니라 썸머라일락이네요;;(어쩐지 향이 좋더라) 수급상황에 따라 꽃구성을 바꾸는건 괜찮지만 무슨 꽃으로 바꿨는지 좀 알려주면 좋겠어요 썸머라일락도 처음봐서 몰랐거든요. 도라지는 상태가 좋은편인데, 가니시부쉬가 예상보다 빨리 시들고 있습니다 ㅜ",
      archived: false,
      reviewer: getMaskedName(id, "남*예"),
      rawReviewer: "남*예",
      image_url: "https://file.honestflower.kr/media/images/reviewimage/1783759233/75845_large.webp"
    };
  }

  if (id === 1054) {
    return {
      id,
      date: "2026.07.11",
      product: "튜베로즈",
      rating: 5,
      type: "중립",
      category: "품질/상태",
      department: "SCM & MD",
      review: "날이 더운지 꽃이 힘이 없어요. 얼른 다듬어서 꽃병에 꽂았어요.  향은 좋은데 잘 살아나겠죠",
      archived: false,
      reviewer: getMaskedName(id, "서*정"),
      rawReviewer: "서*정",
      image_url: "https://file.honestflower.kr/media/images/reviewimage/1783756799/75831_large.webp"
    };
  }

  if (id === 1111) {
    return {
      id,
      date: "2026.07.12",
      product: "테이블 야자",
      rating: 5,
      type: "비추천",
      category: "품질/상태",
      department: "SCM & MD",
      review: "너무시들어서 돈이 아깝네요\n다른꽃도 노랗게 뜬걸보내주고\n자주 이용하지만\n이번은 너무 심합니다",
      archived: false,
      reviewer: getMaskedName(id, "윤*현"),
      rawReviewer: "윤*현",
      image_url: "https://file.honestflower.kr/media/images/reviewimage/1783835134/75889_large.webp"
    };
  }

  const image_url = data.image_url || data.imageUrl || data.imageURL || "";

  const parsedReview: Review = {
    id,
    date,
    product,
    rating,
    type,
    category,
    department,
    review: reviewText,
    archived,
    reviewer,
    rawReviewer,
    image_url
  };

  if (data.incidentStatus !== undefined) parsedReview.incidentStatus = data.incidentStatus;
  if (data.accidentType !== undefined) parsedReview.accidentType = data.accidentType;
  if (data.accidentDetail !== undefined) parsedReview.accidentDetail = data.accidentDetail;
  if (data.refundAmount !== undefined) parsedReview.refundAmount = Number(data.refundAmount);

  console.log(`[DEBUG] Parsed review ID ${id}:`, parsedReview);

  return parsedReview;
}

// Helper: Map static reviews to have rawReviewer and masked reviewer name
const mapStaticReviews = (list: Review[]): Review[] => {
  return list.map(r => {
    const raw = r.rawReviewer || (r as any).reviewer || (r as any).writer || "";
    return {
      ...r,
      rawReviewer: raw,
      reviewer: r.reviewer || getMaskedName(r.id, raw)
    };
  });
};

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [rawReviews, setRawReviews] = useState<Review[]>(() => mapStaticReviews(staticReviews));
  const [rawIncidents, setRawIncidents] = useState<Incident[]>(() => initialIncidentsData);
  
  // Dynamically compute deduplicated and image-merged reviews list for all metrics and components
  const reviews = useMemo(() => getDeduplicatedReviews(rawReviews), [rawReviews]);

  // Dynamically compute deduplicated incidents list for all metrics and components
  const incidents = useMemo(() => getDeduplicatedIncidents(rawIncidents), [rawIncidents]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFirestoreEmpty, setIsFirestoreEmpty] = useState<boolean>(false);
  const [isUsingLocalData, setIsUsingLocalData] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [weekFilter, setWeekFilter] = useState<"this" | "last" | "all">("all");
  const [activeTab, setActiveTab] = useState<"metrics" | "products" | "incidents" | "voc" | "archive">("metrics");
  const [metricsProductFilter, setMetricsProductFilter] = useState<string>("");
  const [metricsTypeFilter, setMetricsTypeFilter] = useState<"all" | "추천" | "중립" | "비추천" | "사고접수">("all");

  const weekRanges = useMemo(() => {
    const activeReviews = reviews.filter(r => !r.archived);
    const allDates: string[] = [
      ...activeReviews.map(r => r.date).filter(Boolean),
      ...incidents.map(i => i.date).filter(Boolean)
    ];
    let anchor = getKSTDate();
    
    if (allDates.length > 0) {
      allDates.sort();
      const maxDateStr = allDates[allDates.length - 1];
      const [y, m, d] = maxDateStr.split(".").map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        anchor = new Date(y, m - 1, d);
      }
    }

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
      }
    };
  }, [reviews, incidents]);

  const isUsingLocalDataRef = React.useRef(true);

  useEffect(() => {
    // Default to clean local static reviews (200 reviews)
    setRawReviews(mapStaticReviews(staticReviews));
    setIsLoading(false);
  }, []);

  // Compute active weekly reviews dynamically from the main list with date boundaries!
  // "전체기간" (weekFilter === "all") is defined specifically as the combination of This Week and Last Week.
  const weeklyReviews = useMemo(() => {
    const active = reviews.filter(r => r.archived !== true);
    
    if (weekFilter === "all") {
      return active;
    }
    
    const range = weekFilter === "this" ? weekRanges.thisWeek : weekRanges.lastWeek;
    
    return active.filter(r => {
      // Comparison is lexical and works perfectly for "YYYY.MM.DD" formatted strings
      return r.date >= range.start && r.date <= range.end;
    });
  }, [reviews, weekFilter, weekRanges]);

  // Compute active weekly incidents dynamically with date boundaries
  const weeklyIncidents = useMemo(() => {
    if (weekFilter === "all") {
      return incidents;
    }
    const range = weekFilter === "this" ? weekRanges.thisWeek : weekRanges.lastWeek;
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

  // Sync / seed initial reviews to Firestore
  const syncWithFirestore = async () => {
    setIsSyncing(true);
    try {
      const BATCH_SIZE = 400;
      for (let i = 0; i < staticReviews.length; i += BATCH_SIZE) {
        const chunk = staticReviews.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const docRef = doc(db, "reviews", item.id.toString());
          batch.set(docRef, sanitizeForFirestore(item));
        });
        await batch.commit();
      }
      setIsFirestoreEmpty(false);
      setIsUsingLocalData(false);
    } catch (err) {
      console.error("Firestore sync error:", err);
      alert("데이터 동기화 도중 오류가 발생했습니다: " + (err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Archive all currently active reviews to reset the weekly dashboard
  const archiveActiveReviews = async () => {
    setIsSyncing(true);
    try {
      const activeDocs = rawReviews.filter(r => r.archived !== true);
      if (activeDocs.length === 0) {
        alert("현재 주간 대시보드에 활성화된 데이터가 없습니다.");
        return;
      }
      
      const BATCH_SIZE = 400;
      for (let i = 0; i < activeDocs.length; i += BATCH_SIZE) {
        const chunk = activeDocs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const docRef = doc(db, "reviews", item.id.toString());
          batch.update(docRef, { archived: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error("주간 데이터 초기화 오류:", err);
      alert("주간 데이터 초기화 도중 오류가 발생했습니다: " + (err as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add a new review to Firestore
  const addReview = async (newReview: Omit<Review, "id">) => {
    try {
      // Find maximum id to auto-increment
      const maxId = rawReviews.length > 0 ? Math.max(...rawReviews.map(r => r.id)) : 0;
      const nextId = maxId + 1;

      const reviewDoc: Review = {
        ...newReview,
        id: nextId,
        archived: false // newly added live reviews are active by default
      };

      const docRef = doc(db, "reviews", nextId.toString());
      const batch = writeBatch(db);
      
      batch.set(docRef, sanitizeForFirestore(reviewDoc));
      await batch.commit();
    } catch (err) {
      console.error("Firestore review add error:", err);
      throw err;
    }
  };

  // Manual refresh function to force pull from Firestore
  const refreshData = async () => {
    setIsSyncing(true);
    setIsLoading(true);
    try {
      const reviewsCollection = collection(db, "reviews");
      const reviewsQuery = query(reviewsCollection, limit(1000));
      const snapshot = await getDocs(reviewsQuery);
      
      if (snapshot.empty) {
        setIsFirestoreEmpty(true);
        setIsUsingLocalData(true);
        setRawReviews(mapStaticReviews(staticReviews));
      } else {
        const list: Review[] = [];
        let indexCounter = 10000;
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Skip non-review testing or metadata documents to maintain data integrity
          if (doc.id === "test_connection" || (!data.review && !data.product && !data.rating)) {
            console.log("Skipping non-review document:", doc.id, data);
            return;
          }
          list.push(parseFirestoreReview(doc.id, data, indexCounter++));
        });
        // Sort descending: by date first, then by id
        list.sort((a, b) => {
          if (b.date !== a.date) {
            return b.date.localeCompare(a.date);
          }
          return b.id - a.id;
        });
        setRawReviews(list);
        setIsFirestoreEmpty(false);
        setIsUsingLocalData(false);
      }
    } catch (err) {
      console.error("Manual Firestore refresh error:", err);
      alert("파이어베이스에서 데이터를 새로고침하는 중 오류가 발생했습니다: " + (err as Error).message);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  // Reset dataset back to initial static dataset (deleting any uploaded/imported Firestore documents)
  const resetToInitialData = async () => {
    setIsSyncing(true);
    try {
      while (true) {
        const snapshot = await getDocs(query(collection(db, "reviews"), limit(400)));
        if (snapshot.empty) break;
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setRawReviews(mapStaticReviews(staticReviews));
      setRawIncidents(initialIncidentsData);
      setIsFirestoreEmpty(true);
      setIsUsingLocalData(true);
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

  // Bulk import parsed CSV reviews into state (and sync to Firestore if not using local data)
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
            // If the incoming is updating CS fields or has matching content, safely enrich without losing photo / classification
            if (incoming.incidentStatus || incoming.accidentType || incoming.refundAmount !== undefined) {
              if (incoming.incidentStatus) existing.incidentStatus = incoming.incidentStatus;
              if (incoming.accidentType) existing.accidentType = incoming.accidentType;
              if (incoming.accidentDetail) existing.accidentDetail = incoming.accidentDetail;
              if (incoming.refundAmount !== undefined) existing.refundAmount = incoming.refundAmount;
              if (incoming.image_url && !existing.image_url) existing.image_url = incoming.image_url;
              if (incoming.incidentStatus === "처리완료") {
                existing.type = "비추천";
                existing.rating = 1;
              }
            } else if (incoming.product === existing.product && incoming.date === existing.date) {
              // Same product and date: merge fields safely
              if (incoming.review && incoming.review.length > (existing.review?.length || 0)) {
                existing.review = incoming.review;
              }
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

      // If Firestore is connected & synced, write batch
      if (!isUsingLocalData) {
        if (!append) {
          // Clear existing Firestore docs first when replacing
          while (true) {
            const snapshot = await getDocs(query(collection(db, "reviews"), limit(400)));
            if (snapshot.empty) break;
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }

        const BATCH_SIZE = 400;
        for (let i = 0; i < combined.length; i += BATCH_SIZE) {
          const chunk = combined.slice(i, i + BATCH_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const docRef = doc(db, "reviews", item.id.toString());
            batch.set(docRef, sanitizeForFirestore(item));
          });
          await batch.commit();
        }
      }
    } catch (err) {
      console.error("CSV Import error:", err);
      handleFirestoreError(err, OperationType.WRITE, "reviews");
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
      productStats,
      isLoading,
      isFirestoreEmpty,
      isUsingLocalData,
      syncWithFirestore,
      addReview,
      archiveActiveReviews,
      isSyncing,
      weekFilter,
      setWeekFilter,
      weekRanges,
      refreshData,
      resetToInitialData,
      activeTab,
      setActiveTab,
      metricsProductFilter,
      setMetricsProductFilter,
      metricsTypeFilter,
      setMetricsTypeFilter,
      importParsedReviews,
      importIncidents
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
