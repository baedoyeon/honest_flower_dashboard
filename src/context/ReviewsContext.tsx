import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, writeBatch, query, orderBy, addDoc, limit, getDocs } from "firebase/firestore";
import { reviewsData as staticReviews, Review, ProductStat } from "../data/classifiedReviews";

interface ReviewsContextType {
  reviews: Review[];
  weeklyReviews: Review[];
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
  activeTab: "metrics" | "products" | "voc" | "archive";
  setActiveTab: (tab: "metrics" | "products" | "voc" | "archive") => void;
  metricsProductFilter: string;
  setMetricsProductFilter: (p: string) => void;
  metricsTypeFilter: "all" | "추천" | "중립" | "비추천";
  setMetricsTypeFilter: (t: "all" | "추천" | "중립" | "비추천") => void;
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
      reviewer: getMaskedName(id, "김*정")
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
      reviewer: getMaskedName(id, "김*정")
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
      review: "3번째배송인데 지난번은 누락배송 이번엔 마지막사진처럼 꽃들을 고정하는장치로 고정하지않아 카네이션 머리가 부러져왔어요. 몇송이 안되는 꽃중 한놈이 망가져배송. ㅠ히야신스는 저렇게 짧뚱하게 보내와서 맨마지막 놈은 화병에 갇혀버리고...얼마전 해바라기도 시들어오더니 속상하네요. 아니 화가나요. 꽃구성은 첫번째사진처람 이뻐요. 그나마 대가리 부러진걸 대표사진으로안한건 예의사밉니다",
      archived: false,
      reviewer: getMaskedName(id, "고객")
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
      reviewer: getMaskedName(id, "고객")
    };
  }

  return {
    id,
    date,
    product,
    rating,
    type,
    category,
    department,
    review: reviewText,
    archived,
    reviewer
  };
}

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>(() =>
    staticReviews.map(r => ({
      ...r,
      reviewer: r.reviewer || getMaskedName(r.id, (r as any).reviewer || (r as any).writer)
    }))
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFirestoreEmpty, setIsFirestoreEmpty] = useState<boolean>(false);
  const [isUsingLocalData, setIsUsingLocalData] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [weekFilter, setWeekFilter] = useState<"this" | "last" | "all">("all");
  const [activeTab, setActiveTab] = useState<"metrics" | "products" | "voc" | "archive">("metrics");
  const [metricsProductFilter, setMetricsProductFilter] = useState<string>("");
  const [metricsTypeFilter, setMetricsTypeFilter] = useState<"all" | "추천" | "중립" | "비추천">("all");

  const weekRanges = useMemo(() => {
    const kstNow = getKSTDate();
    const day = kstNow.getDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat
    
    // Calculate difference to Saturday of the current reporting cycle (Saturday ~ Friday)
    const diffToSaturday = day === 6 ? 0 : -(day + 1);
    
    const thisWeekSat = new Date(kstNow);
    thisWeekSat.setDate(kstNow.getDate() + diffToSaturday);
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
  }, []);

  useEffect(() => {
    // Listen to firestore reviews collection (up to 1000 reviews for scalability)
    // We query without orderBy("id") to support documents that may not have an "id" field in Firestore,
    // and instead sort resiliently in-memory by date and id!
    const reviewsCollection = collection(db, "reviews");
    const reviewsQuery = query(reviewsCollection, limit(1000));

    const unsubscribe = onSnapshot(reviewsQuery, 
      (snapshot) => {
        if (snapshot.empty) {
          console.log("Firestore reviews collection is empty. Falling back to local data.");
          setIsFirestoreEmpty(true);
          setIsUsingLocalData(true);
          setReviews(staticReviews); // fallback
          setIsLoading(false);
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
            console.log("Fetched raw doc:", doc.id, data);
            list.push(parseFirestoreReview(doc.id, data, indexCounter++));
          });
          // Sort descending: by date first, then by id to ensure proper chronological order
          list.sort((a, b) => {
            if (b.date !== a.date) {
              return b.date.localeCompare(a.date);
            }
            return b.id - a.id;
          });
          console.log("Loaded parsed reviews count:", list.length, "First few:", list.slice(0, 3));
          setReviews(list);
          setIsFirestoreEmpty(false);
          setIsUsingLocalData(false);
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Firestore loading error, falling back to local data:", error);
        setIsUsingLocalData(true);
        setReviews(staticReviews);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute active weekly reviews dynamically from the main list with date boundaries!
  // "전체기간" (weekFilter === "all") is defined specifically as the combination of This Week and Last Week.
  const weeklyReviews = useMemo(() => {
    const active = reviews.filter(r => r.archived !== true);
    
    if (weekFilter === "all") {
      const thisRange = weekRanges.thisWeek;
      const lastRange = weekRanges.lastWeek;
      return active.filter(r => {
        const inThisWeek = r.date >= thisRange.start && r.date <= thisRange.end;
        const inLastWeek = r.date >= lastRange.start && r.date <= lastRange.end;
        return inThisWeek || inLastWeek;
      });
    }
    
    const range = weekFilter === "this" ? weekRanges.thisWeek : weekRanges.lastWeek;
    
    return active.filter(r => {
      // Comparison is lexical and works perfectly for "YYYY.MM.DD" formatted strings
      return r.date >= range.start && r.date <= range.end;
    });
  }, [reviews, weekFilter, weekRanges]);

  // Compute product statistics dynamically from active weeklyReviews!
  const productStats = useMemo(() => {
    const map = new Map<string, {
      totalCount: number;
      sumRating: number;
      recommend: number;
      neutral: number;
      notRecommend: number;
    }>();

    weeklyReviews.forEach(r => {
      if (!map.has(r.product)) {
        map.set(r.product, { totalCount: 0, sumRating: 0, recommend: 0, neutral: 0, notRecommend: 0 });
      }
      const val = map.get(r.product)!;
      val.totalCount++;
      val.sumRating += r.rating;
      if (r.type === "추천") val.recommend++;
      else if (r.type === "중립") val.neutral++;
      else val.notRecommend++;
    });

    const statsList: ProductStat[] = [];
    map.forEach((val, product) => {
      const avgRating = val.totalCount > 0 ? Math.round((val.sumRating / val.totalCount) * 100) / 100 : 0;
      const recommendRate = val.totalCount > 0 ? Math.round((val.recommend / val.totalCount) * 100) : 0;
      statsList.push({
        product,
        totalCount: val.totalCount,
        avgRating,
        recommend: val.recommend,
        neutral: val.neutral,
        notRecommend: val.notRecommend,
        recommendRate
      });
    });

    // Sort by totalCount descending by default
    return statsList.sort((a, b) => b.totalCount - a.totalCount);
  }, [weeklyReviews]);

  // Sync / seed initial reviews to Firestore
  const syncWithFirestore = async () => {
    setIsSyncing(true);
    try {
      const batch = writeBatch(db);
      staticReviews.forEach((item) => {
        // Set document with id as key
        const docRef = doc(db, "reviews", item.id.toString());
        batch.set(docRef, item);
      });
      await batch.commit();
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
      const activeDocs = reviews.filter(r => r.archived !== true);
      if (activeDocs.length === 0) {
        alert("현재 주간 대시보드에 활성화된 데이터가 없습니다.");
        return;
      }
      
      const batch = writeBatch(db);
      activeDocs.forEach((item) => {
        const docRef = doc(db, "reviews", item.id.toString());
        batch.update(docRef, { archived: true });
      });
      await batch.commit();
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
      const maxId = reviews.length > 0 ? Math.max(...reviews.map(r => r.id)) : 0;
      const nextId = maxId + 1;

      const reviewDoc: Review = {
        ...newReview,
        id: nextId,
        archived: false // newly added live reviews are active by default
      };

      const docRef = doc(db, "reviews", nextId.toString());
      const batch = writeBatch(db);
      
      batch.set(docRef, reviewDoc);
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
        setReviews(staticReviews);
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
        setReviews(list);
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

  return (
    <ReviewsContext.Provider value={{
      reviews,
      weeklyReviews,
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
      activeTab,
      setActiveTab,
      metricsProductFilter,
      setMetricsProductFilter,
      metricsTypeFilter,
      setMetricsTypeFilter
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
