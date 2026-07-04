import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, writeBatch, query, orderBy, addDoc } from "firebase/firestore";
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

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>(staticReviews);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFirestoreEmpty, setIsFirestoreEmpty] = useState<boolean>(false);
  const [isUsingLocalData, setIsUsingLocalData] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [weekFilter, setWeekFilter] = useState<"this" | "last" | "all">("all");

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
    // Listen to firestore reviews collection
    const reviewsCollection = collection(db, "reviews");
    const reviewsQuery = query(reviewsCollection, orderBy("id", "desc"));

    const unsubscribe = onSnapshot(reviewsQuery, 
      (snapshot) => {
        if (snapshot.empty) {
          setIsFirestoreEmpty(true);
          setIsUsingLocalData(true);
          setReviews(staticReviews); // fallback
          setIsLoading(false);
        } else {
          const list: Review[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            list.push({
              id: data.id,
              date: data.date,
              product: data.product,
              rating: Number(data.rating),
              type: data.type,
              category: data.category,
              department: data.department,
              review: data.review,
              archived: data.archived || false
            } as Review);
          });
          // Sort descending by id
          list.sort((a, b) => b.id - a.id);
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
  const weeklyReviews = useMemo(() => {
    const active = reviews.filter(r => r.archived !== true);
    if (weekFilter === "all") return active;
    
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
      weekRanges
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
