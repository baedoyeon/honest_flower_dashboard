import { Review } from "../data/classifiedReviews";
import { Incident } from "../data/initialIncidents";

function maskCustomerName(id: number, rawName?: string): string {
  if (rawName && rawName.trim()) {
    const trimmed = rawName.trim();
    if (trimmed.includes("*")) return trimmed;
    if (trimmed.length <= 1) return trimmed;
    if (trimmed.length === 2) return trimmed[0] + "*";
    return trimmed[0] + "*" + trimmed.slice(2);
  }
  const MASKED = ["김*진", "이*영", "박*수", "최*희", "정*원", "강*민", "조*현", "윤*서", "장*우", "임*하", "한*준", "오*은"];
  return MASKED[Math.abs(id) % MASKED.length];
}

// Helper: Normalize date string to "YYYY.MM.DD"
export function normalizeDateStr(d: any): string {
  if (!d) return "";
  let s = String(d).trim();
  s = s.replace(/년/g, ".").replace(/월/g, ".").replace(/일/g, "");
  if (s.includes("T")) s = s.split("T")[0];
  else if (s.includes(" ")) s = s.split(" ")[0];
  s = s.replace(/-/g, ".").replace(/\//g, ".");
  s = s.replace(/[^0-9.]/g, "");
  const parts = s.split(".").filter(Boolean);
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const dPart = parts[2].padStart(2, "0");
    return `${y}.${m}.${dPart}`;
  } else if (parts.length === 2) {
    const currentYear = new Date().getFullYear();
    const m = parts[0].padStart(2, "0");
    const dPart = parts[1].padStart(2, "0");
    return `${currentYear}.${m}.${dPart}`;
  }
  return s;
}

// Helper: Auto-classify category based on VOC Classification Guide (어니스트플라워 VOC 분류 가이드)
export function classifyCategory(reviewText: string, rating: number, rawCategory?: string): string {
  if (rawCategory && rawCategory.trim()) {
    const trimmed = rawCategory.trim();
    if (["품질/상태", "배송/포장", "상품구성/양", "서비스/시스템"].includes(trimmed)) {
      return trimmed;
    }
    // Simple keyword mapping for rough category inputs
    if (trimmed.includes("품질") || trimmed.includes("상태") || trimmed.includes("신선")) return "품질/상태";
    if (trimmed.includes("배송") || trimmed.includes("포장") || trimmed.includes("택배")) return "배송/포장";
    if (trimmed.includes("구성") || trimmed.includes("양") || trimmed.includes("수량")) return "상품구성/양";
    if (trimmed.includes("서비스") || trimmed.includes("시스템") || trimmed.includes("앱")) return "서비스/시스템";
  }

  const text = (reviewText || "").toLowerCase();

  // 1. 배송/포장 keywords
  if (
    text.includes("박스") ||
    text.includes("배송") ||
    text.includes("포장") ||
    text.includes("고정") ||
    text.includes("새벽") ||
    text.includes("택배") ||
    text.includes("지연") ||
    text.includes("완충") ||
    text.includes("눌려") ||
    text.includes("마찰")
  ) {
    return "배송/포장";
  }

  // 2. 상품구성/양 keywords
  if (
    text.includes("구성") ||
    text.includes("송이") ||
    text.includes("개수") ||
    text.includes("갯수") ||
    text.includes("풍성") ||
    text.includes("사진과") ||
    text.includes("단수") ||
    text.includes("누락") ||
    text.includes("옵션") ||
    text.includes("적어") ||
    text.includes("부족") ||
    text.includes("달라")
  ) {
    return "상품구성/양";
  }

  // 3. 서비스/시스템 keywords
  if (
    text.includes("홈페이지") ||
    text.includes("사이트") ||
    text.includes("후기작성") ||
    text.includes("후기 작성") ||
    text.includes("어플") ||
    text.includes("앱") ||
    text.includes("버그") ||
    text.includes("결제") ||
    text.includes("적립금") ||
    text.includes("고객센터") ||
    text.includes("문의")
  ) {
    return "서비스/시스템";
  }

  // 4. Default -> 품질/상태
  return "품질/상태";
}

// Helper: Determine responsible department based on category
export function getDepartmentForCategory(category: string, rawDept?: string): string {
  if (rawDept && rawDept.trim()) return rawDept.trim();
  switch (category) {
    case "품질/상태":
      return "SCM & MD";
    case "배송/포장":
      return "SCM & CS";
    case "상품구성/양":
      return "MD";
    case "서비스/시스템":
      return "프로덕트";
    default:
      return "SCM & MD";
  }
}

// Helper: Parse CSV string while respecting quoted fields containing commas or newlines
function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export interface CSVParseResult {
  reviews: Review[];
  totalRows: number;
  validCount: number;
  autoClassifiedCount: number;
  dateRange: { start: string; end: string };
  categoriesSummary: Record<string, number>;
  typesSummary: Record<string, number>;
}

// Main CSV Parser Function
export function parseCSVToReviews(csvText: string, startId: number = 1): CSVParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return {
      reviews: [],
      totalRows: 0,
      validCount: 0,
      autoClassifiedCount: 0,
      dateRange: { start: "", end: "" },
      categoriesSummary: {},
      typesSummary: {}
    };
  }

  // Detect Headers
  const headerRow = rawRows[0].map(h => h.toLowerCase());
  let hasHeader = false;

  let colId = -1;
  let colDate = -1;
  let colProduct = -1;
  let colRating = -1;
  let colReview = -1;
  let colType = -1;
  let colCategory = -1;
  let colDept = -1;
  let colReviewer = -1;
  let colIncidentStatus = -1;
  let colAccidentType = -1;
  let colAccidentDetail = -1;
  let colAccidentDesc = -1;
  let colRefundAmount = -1;
  let colAccidentImage = -1;

  headerRow.forEach((rawCol, index) => {
    const col = rawCol.trim().replaceAll('"', '').toLowerCase();

    if (/^(id|no|번호|index|접수번호|순번)$/i.test(col)) { 
      colId = index; hasHeader = true; 
    }
    else if (col.includes("접수시간") || col.includes("작성일") || col.includes("등록일") || col.includes("수령일") || col.includes("접수일") || col.includes("날짜") || col === "date" || col === "일시") { 
      if (colDate === -1 || col.includes("작성일") || col.includes("접수시간") || col.includes("접수일")) colDate = index; 
      hasHeader = true; 
    }
    else if (col.includes("상품명") || col.includes("주문상품") || col.includes("상품") || col.includes("제품") || col === "product") { 
      colProduct = index; hasHeader = true; 
    }
    else if (col.includes("별점") || col.includes("평점") || col.includes("점수") || col === "rating") { 
      colRating = index; hasHeader = true; 
    }
    else if (col.includes("상태") || col.includes("처리상태") || col.includes("접수상태") || col.includes("승인여부") || col.includes("처리결과") || col.includes("진행상태") || col.includes("사고상태") || col.includes("cs상태")) { 
      colIncidentStatus = index; hasHeader = true; 
    }
    else if (col.includes("사고 유형") || col.includes("사고유형") || col.includes("사고구분") || col.includes("사고분류") || col.includes("cs유형") || col.includes("cs구분") || col.includes("접수유형") || col.includes("클레임유형")) { 
      colAccidentType = index; hasHeader = true; 
    }
    else if (col.includes("상세 유형") || col.includes("상세유형") || col.includes("세부분류") || col.includes("세부원인") || col.includes("사고상세") || col.includes("세부유형") || col.includes("불량원인") || col.includes("사유") || col.includes("세부사유")) { 
      colAccidentDetail = index; hasHeader = true; 
    }
    else if (col.includes("사고 범위 설명") || col.includes("사고설명") || col.includes("사고내용") || col.includes("고객설명") || col.includes("접수내용") || col.includes("클레임내용")) { 
      colAccidentDesc = index; hasHeader = true; 
    }
    else if (col.includes("환불 금액") || col.includes("환불금액") || col.includes("보상금액") || col.includes("환불금") || col.includes("보상금") || col.includes("환불") || col.includes("보상")) { 
      colRefundAmount = index; hasHeader = true; 
    }
    else if (col.includes("사고접수 이미지") || col.includes("증빙사진") || col.includes("사고이미지") || col.includes("증빙") || (col.includes("이미지") && col.includes("사고")) || (col.includes("사진") && col.includes("사고"))) { 
      colAccidentImage = index; hasHeader = true; 
    }
    else if (col.includes("후기") || col.includes("리뷰") || col.includes("내용") || col.includes("본문") || col.includes("고객후기") || col.includes("평가") || col === "review") { 
      if (colReview === -1 || col.includes("후기") || col.includes("리뷰") || col.includes("본문")) colReview = index; 
      hasHeader = true; 
    }
    else if (col.includes("추천여부") || col.includes("유형") || col.includes("구분") || col.includes("분류") || col === "type") { 
      if (colType === -1) colType = index;
      hasHeader = true; 
    }
    else if (col.includes("카테고리") || col.includes("속성") || col.includes("이슈") || col === "category") { 
      colCategory = index; hasHeader = true; 
    }
    else if (col.includes("부서") || col.includes("담당부서") || col === "department") { 
      colDept = index; hasHeader = true; 
    }
    else if (col.includes("작성자") || col.includes("고객명") || col.includes("주문자") || col.includes("이름") || col.includes("성함") || col.includes("고객") || col === "reviewer") { 
      colReviewer = index; hasHeader = true; 
    }
  });

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  // Fallback positional indexing if header not matched
  if (colProduct === -1 && colReview === -1) {
    if (dataRows[0] && dataRows[0].length >= 5) {
      colId = 0;
      colDate = 1;
      colProduct = 2;
      colRating = 3;
      colReview = 4;
    }
  }

  const reviews: Review[] = [];
  let autoClassifiedCount = 0;
  let currentId = startId;

  const categoriesSummary: Record<string, number> = {
    "품질/상태": 0,
    "배송/포장": 0,
    "상품구성/양": 0,
    "서비스/시스템": 0
  };

  const typesSummary: Record<string, number> = {
    "추천": 0,
    "중립": 0,
    "비추천": 0
  };

  const dates: string[] = [];

  dataRows.forEach((row, rowIndex) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    // Resolve ID
    let rawId = colId !== -1 ? Number(row[colId]) : NaN;
    if (isNaN(rawId) || rawId <= 0) {
      rawId = currentId;
    }
    currentId = Math.max(currentId, rawId + 1);

    // Resolve Date
    let rawDate = colDate !== -1 ? row[colDate] : "";
    let date = normalizeDateStr(rawDate);
    if (!date) {
      const today = new Date();
      date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
    }
    dates.push(date);

    // Resolve Product
    let product = colProduct !== -1 && row[colProduct] ? row[colProduct].trim() : "일반 생화 상품";
    if (product.includes("/")) {
      // Clean product code e.g. "페니쿰/4-5대/반단/그린(gPANi1cxs-SF)" -> "페니쿰" or title before first slash if option code attached
      const pName = product.split("/")[0].trim();
      if (pName.length > 1) product = pName;
    }

    // Resolve Incident/Accident specific fields if present
    let incidentStatus: "처리완료" | "반려됨" | "접수중" | undefined = undefined;
    let rawStatus = colIncidentStatus !== -1 && row[colIncidentStatus] ? row[colIncidentStatus].trim() : "";
    if (rawStatus) {
      const statusUpper = rawStatus.toUpperCase();
      if (rawStatus.includes("완료") || rawStatus.includes("승인") || rawStatus.includes("환불") || rawStatus.includes("종료") || rawStatus.includes("처리") || statusUpper === "Y" || statusUpper === "O" || statusUpper === "1" || statusUpper === "TRUE" || rawStatus === "예") {
        incidentStatus = "처리완료";
      } else if (rawStatus.includes("반려") || rawStatus.includes("미인정") || rawStatus.includes("취소") || rawStatus.includes("거부") || rawStatus.includes("부적합") || statusUpper === "N" || rawStatus === "아니오") {
        incidentStatus = "반려됨";
      } else if (rawStatus.includes("접수") || rawStatus.includes("대기") || rawStatus.includes("검수") || rawStatus.includes("진행") || rawStatus.includes("신청")) {
        incidentStatus = "접수중";
      }
    }

    let accidentType = colAccidentType !== -1 && row[colAccidentType] ? row[colAccidentType].trim() : undefined;
    let accidentDetail = colAccidentDetail !== -1 && row[colAccidentDetail] ? row[colAccidentDetail].trim() : undefined;
    let refundAmount = colRefundAmount !== -1 && row[colRefundAmount] && !isNaN(Number(row[colRefundAmount].replace(/[^0-9]/g, ""))) ? Number(row[colRefundAmount].replace(/[^0-9]/g, "")) : undefined;
    let image_url = colAccidentImage !== -1 && row[colAccidentImage] ? row[colAccidentImage].replace(/="|"$/g, "").trim() : undefined;

    let rawType = colType !== -1 && row[colType] ? row[colType].trim() : "";

    // Check if row is an accident report
    const isAccidentRow = Boolean(
      incidentStatus !== undefined || 
      accidentType || 
      accidentDetail || 
      refundAmount !== undefined || 
      image_url ||
      colAccidentType !== -1 ||
      colAccidentDetail !== -1 ||
      colIncidentStatus !== -1 ||
      colRefundAmount !== -1 ||
      rawType.includes("사고") ||
      rawType.includes("CS") ||
      rawType.includes("클레임")
    );

    // If accident row and incidentStatus is not explicitly determined from rawStatus, default to "처리완료"
    if (isAccidentRow && !incidentStatus) {
      incidentStatus = "처리완료";
    }

    // Resolve Review Text
    let reviewText = colReview !== -1 && row[colReview] ? row[colReview].trim() : "";
    if (!reviewText && colAccidentDesc !== -1 && row[colAccidentDesc]) {
      reviewText = row[colAccidentDesc].trim();
    }
    if (!reviewText && isAccidentRow) {
      reviewText = `사고접수 [${accidentDetail || accidentType || "CS/품질 접수건"}]`;
    }

    // Resolve Rating
    let rawRatingStr = colRating !== -1 && row[colRating] ? row[colRating].trim() : "";
    let rawRatingVal = Number(rawRatingStr);
    let rating: number;

    if (!isNaN(rawRatingVal) && rawRatingVal >= 1 && rawRatingVal <= 5) {
      rating = rawRatingVal;
    } else {
      // Missing or invalid rating -> Default strictly to 1 star for accident rows or negative text!
      if (isAccidentRow) {
        rating = 1; // ACCIDENT SUBMISSIONS WITHOUT RATING ARE UNCONDITIONALLY 1 STAR (1점)
      } else {
        // General reviews without rating column: analyze review text
        const lowerTxt = reviewText.toLowerCase();
        if (
          lowerTxt.includes("불만") || lowerTxt.includes("상함") || lowerTxt.includes("시들") ||
          lowerTxt.includes("별로") || lowerTxt.includes("아쉽") || lowerTxt.includes("환불") ||
          lowerTxt.includes("파손") || lowerTxt.includes("부러") || lowerTxt.includes("비추")
        ) {
          rating = 1;
        } else if (lowerTxt.includes("보통") || lowerTxt.includes("그냥")) {
          rating = 3;
        } else {
          rating = 5;
        }
      }
    }

    // Resolve Type ("추천" | "중립" | "비추천")
    let type: "추천" | "중립" | "비추천" = "추천";

    if (["추천", "중립", "비추천"].includes(rawType)) {
      type = rawType as any;
    } else {
      if (rating <= 2 && rating > 0) {
        type = "비추천";
      } else if (rating === 3) {
        type = "중립";
      } else if (rating >= 4) {
        type = "추천";
      } else {
        type = "중립";
      }
    }

    // Resolve Category
    let rawCategory = colCategory !== -1 ? row[colCategory] : "";
    if (!rawCategory && (accidentDetail || accidentType)) {
      const combined = `${accidentDetail || ""} ${accidentType || ""}`;
      if (combined.includes("품질") || combined.includes("온해") || combined.includes("물내림") || combined.includes("갈변") || combined.includes("꺾임")) {
        rawCategory = "품질/상태";
      } else if (combined.includes("누락") || combined.includes("출고") || combined.includes("구성")) {
        rawCategory = "상품구성/양";
      } else if (combined.includes("배송") || combined.includes("택배") || combined.includes("지연")) {
        rawCategory = "배송/포장";
      }
    }
    let category = classifyCategory(reviewText, rating, rawCategory);
    if (!rawCategory) autoClassifiedCount++;
    categoriesSummary[category] = (categoriesSummary[category] || 0) + 1;

    // Resolve Department
    let rawDept = colDept !== -1 ? row[colDept] : "";
    let department = getDepartmentForCategory(category, rawDept);

    // Resolve Reviewer Name
    let rawReviewer = colReviewer !== -1 ? row[colReviewer] : "";
    let reviewer = maskCustomerName(rawId, rawReviewer);

    // User Rule: Separate CS Accident Reports from Customer '비추천' Reviews.
    // - If CSV contains explicit rating (1~5), set exact rating & type (1~2: 비추천, 3: 중립, 4~5: 추천).
    // - If CS accident row is unrated (no customer star review), set rating = 0 (unrated) and do NOT force '비추천'.
    if (!isNaN(rawRatingVal) && rawRatingVal >= 1 && rawRatingVal <= 5) {
      rating = rawRatingVal;
      if (!["추천", "중립", "비추천"].includes(rawType)) {
        if (rating <= 2) type = "비추천";
        else if (rating === 3) type = "중립";
        else type = "추천";
      }
    } else if (isAccidentRow) {
      rating = 0; // 평점 없음 (Unrated CS accident report - excluded from average rating calculation)
      if (!["추천", "중립", "비추천"].includes(rawType)) {
        type = "중립"; // Keep separate from customer '비추천' reviews
      }
    }
    typesSummary[type] = (typesSummary[type] || 0) + 1;

    const itemObj: Review = {
      id: rawId,
      date,
      product,
      rating,
      type,
      category,
      department,
      review: reviewText,
      archived: false,
      reviewer
    };

    if (rawReviewer !== undefined) itemObj.rawReviewer = rawReviewer;
    if (image_url !== undefined) itemObj.image_url = image_url;
    if (incidentStatus !== undefined) itemObj.incidentStatus = incidentStatus;
    if (accidentType !== undefined) itemObj.accidentType = accidentType;
    if (accidentDetail !== undefined) itemObj.accidentDetail = accidentDetail;
    if (refundAmount !== undefined) itemObj.refundAmount = refundAmount;

    reviews.push(itemObj);
  });

  // Post-processing deduplication & merging according to User Rule:
  // "만약 비추천 리뷰도 썼다면 리뷰에다가 사고접수완료라고 표식이 있으면 된다는 거지 따로 생성되는 것이 아니라 사고접수만 했다면 비추천 새로 생성해야하고"
  const mergedReviews: Review[] = [];

  reviews.forEach(item => {
    // Find if there's already an existing review for the exact same explicit raw customer + product + date, or identical review content
    const existingIndex = mergedReviews.findIndex(m => {
      if (m.id === item.id) return true;
      
      const hasExplicitRawReviewers = Boolean(item.rawReviewer && m.rawReviewer && item.rawReviewer.trim() && m.rawReviewer.trim());
      if (hasExplicitRawReviewers) {
        return item.rawReviewer!.trim() === m.rawReviewer!.trim() && m.product === item.product && m.date === item.date;
      }

      // If no explicit raw reviewer, only merge if review text is identical (length >= 8) on the same date for the same product
      const itemText = (item.review || "").trim();
      const mText = (m.review || "").trim();
      if (itemText.length >= 8 && itemText === mText && m.product === item.product && m.date === item.date) {
        return true;
      }

      return false;
    });

    if (existingIndex !== -1) {
      const existing = mergedReviews[existingIndex];

      // Merge accident report onto the existing review row
      if (item.incidentStatus) existing.incidentStatus = item.incidentStatus;
      if (item.accidentType) existing.accidentType = item.accidentType;
      if (item.accidentDetail) existing.accidentDetail = item.accidentDetail;
      if (item.refundAmount) existing.refundAmount = item.refundAmount;
      if (item.image_url) {
        existing.image_url = item.image_url;
        if (!existing.image_urls) existing.image_urls = [];
        if (!existing.image_urls.includes(item.image_url)) existing.image_urls.push(item.image_url);
      }

      // If accident report was approved ("처리완료"), set existing review to "비추천" & "사고접수완료"
      if (item.incidentStatus === "처리완료") {
        existing.type = "비추천";
        existing.rating = 1;
        existing.incidentStatus = "처리완료";
      }

      // Use customer's written review text if current item has written review text
      if ((!existing.review || existing.review.startsWith("사고접수")) && item.review && !item.review.startsWith("사고접수")) {
        existing.review = item.review;
      }
    } else {
      mergedReviews.push(item);
    }
  });

  // Re-calculate summaries based on final deduplicated merged reviews
  const finalCategoriesSummary: Record<string, number> = {
    "품질/상태": 0,
    "배송/포장": 0,
    "상품구성/양": 0,
    "서비스/시스템": 0
  };

  const finalTypesSummary: Record<string, number> = {
    "추천": 0,
    "중립": 0,
    "비추천": 0
  };

  mergedReviews.forEach(r => {
    if (finalCategoriesSummary[r.category] !== undefined) {
      finalCategoriesSummary[r.category]++;
    } else {
      finalCategoriesSummary["품질/상태"]++;
    }
    if (finalTypesSummary[r.type] !== undefined) {
      finalTypesSummary[r.type]++;
    }
  });

  dates.sort();
  const dateRange = {
    start: dates.length > 0 ? dates[0] : "",
    end: dates.length > 0 ? dates[dates.length - 1] : ""
  };

  const sanitizedMergedReviews = mergedReviews.map(reviewObj => {
    const clean: Record<string, any> = {};
    Object.keys(reviewObj).forEach(k => {
      const val = (reviewObj as any)[k];
      if (val !== undefined) {
        clean[k] = val;
      }
    });
    return clean as Review;
  });

  return {
    reviews: sanitizedMergedReviews,
    totalRows: dataRows.length,
    validCount: mergedReviews.length,
    autoClassifiedCount,
    dateRange,
    categoriesSummary: finalCategoriesSummary,
    typesSummary: finalTypesSummary
  };
}

export interface IncidentParseResult {
  incidents: Incident[];
  totalRows: number;
  validCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  dateRange: { start: string; end: string };
  accidentDetailsSummary: Record<string, number>;
  totalRefundAmount: number;
}

// Automatic format detector: Identifies if a CSV is a Review CSV or a CS Incident CSV
export function detectCSVType(csvText: string): "reviews" | "incidents" {
  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return "reviews";
  
  const headerLine = rows[0].join(" ").toLowerCase();
  
  if (
    headerLine.includes("사고") ||
    headerLine.includes("상세유형") ||
    headerLine.includes("사고유형") ||
    headerLine.includes("환불") ||
    headerLine.includes("접수상태") ||
    headerLine.includes("처리상태") ||
    headerLine.includes("클레임") ||
    headerLine.includes("증빙") ||
    headerLine.includes("보상")
  ) {
    return "incidents";
  }
  
  return "reviews";
}

// Main CS Accident Incidents CSV Parser Function
export function parseCSVToIncidents(csvText: string): IncidentParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return {
      incidents: [],
      totalRows: 0,
      validCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      dateRange: { start: "", end: "" },
      accidentDetailsSummary: {},
      totalRefundAmount: 0
    };
  }

  // Detect Headers
  const headerRow = rawRows[0].map(h => h.toLowerCase());
  let hasHeader = false;

  let colId = -1;
  let colDate = -1;
  let colProduct = -1;
  let colReviewer = -1;
  let colStatus = -1;
  let colAccidentType = -1;
  let colAccidentDetail = -1;
  let colClaimText = -1;
  let colRefundAmount = -1;
  let colImage = -1;
  let colOrderNo = -1;
  let colCsResponse = -1;

  headerRow.forEach((rawCol, index) => {
    const col = rawCol.trim().replaceAll('"', '').toLowerCase();

    if (/^(id|no|번호|index|접수번호|순번)$/i.test(col)) {
      colId = index; hasHeader = true;
    }
    else if (col === "접수시간" || col === "접수일자" || col === "접수일" || col === "등록일" || col === "작성일" || col === "date" || col === "created_at") {
      colDate = index; hasHeader = true;
    }
    else if (colDate === -1 && (col.includes("접수시간") || col.includes("접수일") || col.includes("작성일") || col.includes("등록일") || col.includes("날짜"))) {
      if (!col.includes("재접수") && !col.includes("완료시간") && !col.includes("수령일")) {
        colDate = index; hasHeader = true;
      }
    }
    else if (col.includes("상품명") || col.includes("주문상품") || col.includes("상품") || col === "product") {
      colProduct = index; hasHeader = true;
    }
    else if (col.includes("작성자") || col.includes("고객명") || col.includes("주문자") || col.includes("이름") || col === "reviewer" || col === "customer") {
      colReviewer = index; hasHeader = true;
    }
    else if (col.includes("상태") || col.includes("처리상태") || col.includes("접수상태") || col.includes("승인여부") || col.includes("처리결과") || col.includes("진행상태") || col.includes("status")) {
      colStatus = index; hasHeader = true;
    }
    else if (col.includes("사고 유형") || col.includes("사고유형") || col.includes("사고구분") || col.includes("사고분류") || col.includes("cs유형") || col.includes("대분류")) {
      colAccidentType = index; hasHeader = true;
    }
    else if (col.includes("상세 유형") || col.includes("상세유형") || col.includes("세부분류") || col.includes("세부원인") || col.includes("사고상세") || col.includes("소분류") || col.includes("사유")) {
      colAccidentDetail = index; hasHeader = true;
    }
    else if (col.includes("사고 범위 설명") || col.includes("사고설명") || col.includes("사고내용") || col.includes("고객설명") || col.includes("접수내용") || col.includes("내용") || col === "claim" || col === "review") {
      colClaimText = index; hasHeader = true;
    }
    else if (col.includes("환불 금액") || col.includes("환불금액") || col.includes("보상금액") || col.includes("환불") || col.includes("보상") || col === "refund") {
      colRefundAmount = index; hasHeader = true;
    }
    else if (col.includes("이미지") || col.includes("사진") || col.includes("증빙") || col === "image_url") {
      colImage = index; hasHeader = true;
    }
    else if (col.includes("주문번호") || col.includes("주문id") || col === "orderno" || col === "order_id") {
      colOrderNo = index; hasHeader = true;
    }
    else if (col.includes("답변") || col.includes("조치") || col.includes("cs답변") || col.includes("처리내용") || col === "response") {
      colCsResponse = index; hasHeader = true;
    }
  });

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const rawIncidents: Incident[] = [];

  dataRows.forEach((row, idx) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const rowNum = idx + 1;
    let rawIdCol = colId !== -1 && row[colId] ? row[colId].trim() : "";
    let idStr = rawIdCol || `INC-${String(rowNum).padStart(3, "0")}`;
    if (!idStr.startsWith("INC-")) {
      const numOnly = parseInt(idStr.replace(/[^0-9]/g, ""), 10);
      idStr = !isNaN(numOnly) ? `INC-${String(numOnly).padStart(3, "0")}` : `INC-${String(rowNum).padStart(3, "0")}`;
    }

    let date = colDate !== -1 && row[colDate] ? normalizeDateStr(row[colDate]) : "";
    if (!date) {
      const today = new Date();
      date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
    }

    let product = colProduct !== -1 && row[colProduct] ? row[colProduct].trim() : "일반 생화 상품";
    if (product.includes("/")) {
      const pName = product.split("/")[0].trim();
      if (pName.length > 1) product = pName;
    }

    let rawReviewer = colReviewer !== -1 && row[colReviewer] ? row[colReviewer].trim() : "";
    let customerName = rawReviewer || maskCustomerName(rowNum, rawReviewer);

    // Resolve Incident Status
    let incidentStatus: "처리완료" | "반려됨" | "접수중" = "처리완료";
    let rawStatus = colStatus !== -1 && row[colStatus] ? row[colStatus].trim() : "";
    if (rawStatus) {
      const st = rawStatus.toUpperCase();
      if (st.includes("반려") || st.includes("미인정") || st.includes("취소") || st.includes("거부") || st === "N") {
        incidentStatus = "반려됨";
      } else if (st.includes("접수") || st.includes("대기") || st.includes("검수") || st.includes("진행")) {
        incidentStatus = "접수중";
      } else {
        incidentStatus = "처리완료";
      }
    }

    let accidentType = colAccidentType !== -1 && row[colAccidentType] ? row[colAccidentType].trim() : "품질 불량";
    let accidentDetail = colAccidentDetail !== -1 && row[colAccidentDetail] ? row[colAccidentDetail].trim() : "기타 불만";
    let claimText = colClaimText !== -1 && row[colClaimText] ? row[colClaimText].trim() : "고객 사고접수 내용이 없습니다.";
    
    let refundAmount = 0;
    if (colRefundAmount !== -1 && row[colRefundAmount]) {
      const numericVal = parseInt(row[colRefundAmount].replace(/[^0-9]/g, ""), 10);
      if (!isNaN(numericVal)) refundAmount = numericVal;
    }

    let image_url = colImage !== -1 && row[colImage] ? row[colImage].replace(/="|"$/g, "").trim() : undefined;
    let orderNumber = colOrderNo !== -1 && row[colOrderNo] ? row[colOrderNo].replace(/="|"$/g, "").trim() : undefined;
    let csResponse = colCsResponse !== -1 && row[colCsResponse] ? row[colCsResponse].replace(/="|"$/g, "").trim() : undefined;

    rawIncidents.push({
      id: idStr,
      date,
      product,
      customerName,
      reviewer: customerName,
      rawReviewer,
      incidentStatus,
      accidentType,
      accidentDetail,
      claimText,
      refundAmount: refundAmount > 0 ? refundAmount : undefined,
      image_url: image_url || undefined,
      orderNumber: orderNumber || undefined,
      csResponse: csResponse || undefined
    });
  });

  // Smart Deduplication for Incidents (Merge duplicate rows by ID, Order Number, or Content Signature)
  const incidents: Incident[] = [];
  const dates: string[] = [];
  const accidentDetailsSummary: Record<string, number> = {};
  let totalRefundAmount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  rawIncidents.forEach(item => {
    const existingIndex = incidents.findIndex(existing => {
      // Match by exact incident ID
      if (existing.id && item.id && existing.id === item.id) return true;
      
      // Match by exact order number if provided
      if (existing.orderNumber && item.orderNumber && existing.orderNumber === item.orderNumber && existing.product === item.product) {
        return true;
      }

      // Match by date + product + customer + claim text similarity
      if (existing.date === item.date && existing.product === item.product) {
        const itemText = (item.claimText || "").trim();
        const existingText = (existing.claimText || "").trim();
        if (itemText.length >= 6 && existingText.length >= 6 && (itemText === existingText || itemText.includes(existingText) || existingText.includes(itemText))) {
          return true;
        }
      }

      return false;
    });

    if (existingIndex !== -1) {
      // Merge into existing
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
      incidents.push(item);
    }
  });

  // Calculate statistics on the deduplicated incidents
  incidents.forEach(item => {
    dates.push(item.date);
    if (item.incidentStatus === "처리완료") approvedCount++;
    else if (item.incidentStatus === "반려됨") rejectedCount++;
    else pendingCount++;

    const detailKey = item.accidentDetail || item.accidentType || "기타 불만";
    accidentDetailsSummary[detailKey] = (accidentDetailsSummary[detailKey] || 0) + 1;

    if (item.refundAmount) {
      totalRefundAmount += item.refundAmount;
    }
  });

  dates.sort();
  const dateRange = {
    start: dates.length > 0 ? dates[0] : "",
    end: dates.length > 0 ? dates[dates.length - 1] : ""
  };

  return {
    incidents,
    totalRows: dataRows.length,
    validCount: incidents.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    dateRange,
    accidentDetailsSummary,
    totalRefundAmount
  };
}
