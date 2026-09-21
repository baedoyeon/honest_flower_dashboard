import { Review } from "../data/classifiedReviews";
import { Incident } from "../data/initialIncidents";
import { OrderItem } from "../data/orderItems";
import { ProblemForm } from "../data/problemForms";
import { ChatRoom } from "../data/chatRooms";
import {
  detectColumns, ColumnRule, checkSchemaMismatch,
  isIdColumn, isProductColumn, isProductNameColumn, isRatingColumn, isRefundAmountColumn,
  isAccidentTypeColumn, isAccidentDetailColumn, isReviewerNameColumn, isIncidentStatusColumn
} from "./csvColumnMatcher";

export function maskCustomerName(id: number, rawName?: string): string {
  if (rawName && rawName.trim()) {
    const trimmed = rawName.trim();
    if (trimmed.includes("*")) return trimmed;
    if (trimmed.length <= 1) return trimmed;
    if (trimmed.length === 2) return trimmed[0] + "*";
    // 3글자를 넘는 이름(영문 닉네임, "성 이름" 조합 등)에서 trimmed.slice(2)를 쓰면 두 번째
    // 글자만 가리고 나머지 전체가 그대로 노출됨(실측: "Youngmee Lee" -> "Y*ungmee Lee") — 길이와
    // 무관하게 마지막 한 글자만 보이도록 고정해서, 원본 이름을 절대 유추 불가능하게 만든다.
    return trimmed[0] + "*" + trimmed.slice(-1);
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

// 실제 ARES 어드민 export의 주문번호/그룹주문번호 값에 Excel 텍스트 강제 escape 래퍼(="...")가
// 실제로 존재한다(예: ="26082017871915400-1"). 그대로 두면 OrderItem-ProblemForm 조인 시 문자열이
// 정확히 일치하지 않아 매칭이 실패할 수 있으므로, FK로 쓰는 값은 항상 이 함수로 벗겨내고 저장한다.
function stripExcelWrapper(v: string): string {
  return v.replace(/^="|"$/g, "").trim();
}

export interface CSVParseResult {
  reviews: Review[];
  totalRows: number;
  validCount: number;
  autoClassifiedCount: number;
  dateRange: { start: string; end: string };
  categoriesSummary: Record<string, number>;
  typesSummary: Record<string, number>;
  // 헤더는 인식됐지만 평점/상품명처럼 중요한 컬럼을 못 찾은 경우의 사용자용 한글 라벨 목록.
  // 비어있지 않으면 업로드 화면에서 경고를 띄워야 한다("총점" 사고 재발 방지).
  missingCriticalColumns: string[];
  // true = 핵심 컬럼이 전부 안 잡혔음 — 리뷰 CSV가 아닌 완전히 다른 파일일 가능성이 큼.
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
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
      typesSummary: {},
      missingCriticalColumns: [],
      isLikelyWrongFileType: false,
      detectedColumns: []
    };
  }

  // Detect Headers — 공유 컬럼매칭 엔진(csvColumnMatcher.ts) 사용. rules 순서가 우선순위이며
  // 기존 if/else-if 체인의 순서·오버라이드 동작을 그대로 옮긴 것이다.
  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const reviewColumnRules: ColumnRule[] = [
    { key: "id", test: isIdColumn },
    {
      key: "date",
      test: (col) => col.includes("접수시간") || col.includes("작성일") || col.includes("등록일") || col.includes("수령일") || col.includes("접수일") || col.includes("날짜") || col === "date" || col === "일시",
      shouldOverride: (col, hasExisting) => !hasExisting || col.includes("작성일") || col.includes("접수시간") || col.includes("접수일"),
    },
    { key: "product", test: isProductNameColumn },
    { key: "product", guard: (hasExisting) => !hasExisting, test: isProductColumn },
    { key: "rating", test: isRatingColumn },
    { key: "incidentStatus", test: isIncidentStatusColumn },
    { key: "accidentType", test: isAccidentTypeColumn },
    { key: "accidentDetail", test: isAccidentDetailColumn },
    { key: "accidentDesc", test: (col) => col.includes("사고 범위 설명") || col.includes("사고설명") || col.includes("사고내용") || col.includes("고객설명") || col.includes("접수내용") || col.includes("클레임내용") },
    { key: "refundAmount", test: isRefundAmountColumn },
    { key: "accidentImage", test: (col) => col.includes("사고접수 이미지") || col.includes("증빙사진") || col.includes("사고이미지") || col.includes("증빙") || (col.includes("이미지") && col.includes("사고")) || (col.includes("사진") && col.includes("사고")) },
    // 고객이 후기 작성 시 첨부한 일반 사진(사고접수 증빙사진과는 별개) — 예: "이미지 url" 컬럼
    { key: "reviewImage", test: (col) => col.includes("이미지") || col.includes("사진") || col === "image_url" || col === "imageurl" },
    // 고객에게 공개 노출되는지 여부. false로 숨김 처리된 리뷰가 오히려 내부 VOC 관점에선 더 중요한
    // 신호이므로(어드민이 문제 있다고 판단해 내린 것) 절대 필터링해서 빼면 안 되고, 캡처만 해서
    // 화면에 구분 표시하는 용도로 쓴다.
    { key: "exposed", test: (col) => col.includes("노출여부") || col.includes("노출") || col === "exposed" || col === "is_exposed" },
    {
      key: "review",
      test: (col) => col.includes("후기") || col.includes("리뷰") || col.includes("내용") || col.includes("본문") || col.includes("고객후기") || col.includes("평가") || col === "review",
      shouldOverride: (col, hasExisting) => !hasExisting || col.includes("후기") || col.includes("리뷰") || col.includes("본문"),
    },
    { key: "type", test: (col) => col.includes("추천여부") || col.includes("유형") || col.includes("구분") || col.includes("분류") || col === "type", shouldOverride: (_col, hasExisting) => !hasExisting },
    { key: "category", test: (col) => col.includes("카테고리") || col.includes("속성") || col.includes("이슈") || col === "category" },
    { key: "department", test: (col) => col.includes("부서") || col.includes("담당부서") || col === "department" },
    { key: "customerId", test: (col) => col === "고객id" || col === "고객 id" || col === "customerid" },
    { key: "reviewer", test: isReviewerNameColumn },
  ];

  const { indices: reviewCols, hasHeader } = detectColumns(headerRow, reviewColumnRules);
  let colId = reviewCols.id;
  let colDate = reviewCols.date;
  let colProduct = reviewCols.product;
  let colRating = reviewCols.rating;
  let colReview = reviewCols.review;
  let colType = reviewCols.type;
  let colCategory = reviewCols.category;
  let colDept = reviewCols.department;
  let colReviewer = reviewCols.reviewer;
  let colCustomerId = reviewCols.customerId;
  let colIncidentStatus = reviewCols.incidentStatus;
  let colAccidentType = reviewCols.accidentType;
  let colAccidentDetail = reviewCols.accidentDetail;
  let colAccidentDesc = reviewCols.accidentDesc;
  let colRefundAmount = reviewCols.refundAmount;
  let colAccidentImage = reviewCols.accidentImage;
  let colReviewImage = reviewCols.reviewImage;
  let colExposed = reviewCols.exposed;

  // 평점/상품명은 리뷰 데이터의 핵심 필드라 못 찾으면 추측(키워드 매칭·기본값)으로 채워지는데,
  // 이게 바로 "총점" 사고의 정체였다 — 조용히 넘어가지 않고 업로드 화면에 경고로 띄운다.
  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, reviewCols, [
    { key: "rating", label: "평점(총점/별점/평점/점수)" },
    { key: "product", label: "상품명" },
  ], rawRows[0]);

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
    let refundAmount = colRefundAmount !== -1 && row[colRefundAmount] && !isNaN(Number(row[colRefundAmount].replace(/[^0-9.-]/g, ""))) ? Math.round(Number(row[colRefundAmount].replace(/[^0-9.-]/g, ""))) : undefined;
    let image_url = colAccidentImage !== -1 && row[colAccidentImage]
      ? row[colAccidentImage].replace(/="|"$/g, "").trim()
      : (colReviewImage !== -1 && row[colReviewImage] ? row[colReviewImage].replace(/="|"$/g, "").trim() : undefined);

    // 기본값은 true(노출 중) — 신규 리뷰는 어드민에서 기본적으로 노출 체크 상태로 생성되고,
    // 컬럼이 없거나 빈 값인 CSV(옛 스키마)도 "아직 모름"이 아니라 "노출 중"으로 간주한다.
    // 명시적으로 false 계열 값(미노출/비노출/N/0/아니오 등)으로 표기된 경우만 false로 뒤집는다.
    let exposed: boolean = true;
    if (colExposed !== -1 && row[colExposed]) {
      const rawExposed = row[colExposed].trim().toLowerCase();
      if (["false", "n", "0", "아니오", "미노출", "비노출"].includes(rawExposed)) exposed = false;
    }

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

    // Resolve Customer ID (preferred identifier over reviewer name when present)
    let rawCustomerId = colCustomerId !== -1 && row[colCustomerId] ? stripExcelWrapper(row[colCustomerId]) : undefined;

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
    if (rawCustomerId !== undefined) itemObj.rawCustomerId = rawCustomerId;
    if (exposed !== undefined) itemObj.exposed = exposed;
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

      // Customer ID is the most reliable identifier when present (avoids reviewer-name/phone-number mixups)
      const hasCustomerIds = Boolean(item.rawCustomerId && m.rawCustomerId);
      if (hasCustomerIds) {
        return item.rawCustomerId === m.rawCustomerId && m.product === item.product && m.date === item.date;
      }

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

      // 사고접수 확정 여부는 (위에서 이미 복사한) incidentStatus 뱃지("🚨 사고접수완료")로 별도
      // 표시한다 — 원래 리뷰의 rating/type은 덮어쓰지 않는다. 저품질 리뷰이면서 동시에 사고접수도
      // 된 건을 rating=1로 뭉개버리면, 정상 별점으로 남아있는 다른 사고접수 건과 구분이 안 되고
      // 원본 데이터도 사라진다.

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
    typesSummary: finalTypesSummary,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
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
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
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
export function parseCSVToIncidents(csvText: string, importChannel: "일반" | "플라워고" = "일반"): IncidentParseResult {
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
      totalRefundAmount: 0,
      missingCriticalColumns: [],
      isLikelyWrongFileType: false,
      detectedColumns: []
    };
  }

  // Detect Headers — 공유 컬럼매칭 엔진 사용(csvColumnMatcher.ts).
  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const incidentColumnRules: ColumnRule[] = [
    { key: "id", test: isIdColumn },
    { key: "date", test: (col) => col === "접수시간" || col === "접수일자" || col === "접수일" || col === "등록일" || col === "작성일" || col === "date" || col === "created_at" },
    {
      key: "date",
      guard: (hasExisting) => !hasExisting,
      test: (col) => (col.includes("접수시간") || col.includes("접수일") || col.includes("작성일") || col.includes("등록일") || col.includes("날짜")) && !col.includes("재접수") && !col.includes("완료시간") && !col.includes("수령일"),
    },
    { key: "product", test: (col) => col.includes("상품명") || col.includes("주문상품") || col === "product" },
    { key: "product", guard: (hasExisting) => !hasExisting, test: (col) => col.includes("상품") },
    { key: "reviewer", test: isReviewerNameColumn },
    { key: "status", test: isIncidentStatusColumn },
    { key: "accidentType", test: isAccidentTypeColumn },
    { key: "accidentDetail", test: isAccidentDetailColumn },
    { key: "claimText", test: (col) => col.includes("사고 범위 설명") || col.includes("사고설명") || col.includes("사고내용") || col.includes("고객설명") || col.includes("접수내용") || col.includes("내용") || col === "claim" || col === "review" },
    { key: "refundAmount", test: isRefundAmountColumn },
    { key: "image", test: (col) => col.includes("이미지") || col.includes("사진") || col.includes("증빙") || col === "image_url" },
    { key: "orderNo", test: (col) => col.includes("주문번호") || col.includes("주문id") || col === "orderno" || col === "order_id" },
    { key: "csResponse", test: (col) => col.includes("답변") || col.includes("조치") || col.includes("cs답변") || col.includes("처리내용") || col === "response" },
  ];

  const { indices: incCols, hasHeader } = detectColumns(headerRow, incidentColumnRules);
  let colId = incCols.id;
  let colDate = incCols.date;
  let colProduct = incCols.product;
  let colReviewer = incCols.reviewer;
  let colStatus = incCols.status;
  let colAccidentType = incCols.accidentType;
  let colAccidentDetail = incCols.accidentDetail;
  let colClaimText = incCols.claimText;
  let colRefundAmount = incCols.refundAmount;
  let colImage = incCols.image;
  let colOrderNo = incCols.orderNo;
  let colCsResponse = incCols.csResponse;

  // "상품명"은 다른 종류의 CSV(예: CS비용 다운로드 export)에도 흔히 있어 구분력이 약하므로,
  // 이 사고접수 전용 임포터에서만 나오는 개념(사고유형/사고내용)으로 판단한다 — 그래야
  // "완전히 다른 파일을 잘못 올렸다"는 신호(isLikelyWrongFileType)가 오탐 없이 정확해진다.
  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, incCols, [
    { key: "claimText", label: "사고 범위 설명/사고내용" },
    { key: "accidentType", label: "사고 유형" },
  ], rawRows[0]);

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
    // rawReviewer가 있으면 그걸 그대로 쓰고 없을 때만 마스킹하던 이전 로직은 원본 이름을 그대로
    // 노출시키는 버그였음(maskCustomerName은 rawName이 있으면 마스킹, 없으면 대체 이름을 만들어주므로
    // 항상 이 함수를 거쳐야 함).
    let customerName = maskCustomerName(rowNum, rawReviewer);

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
      const numericVal = Math.round(parseFloat(row[colRefundAmount].replace(/[^0-9.-]/g, "")));
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
      csResponse: csResponse || undefined,
      importChannel
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
    totalRefundAmount,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}

export interface OrderItemParseResult {
  orderItems: OrderItem[];
  totalRows: number;
  validCount: number;
  reshipCount: number;
  dateRange: { start: string; end: string };
  totalRefundAmount: number;
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
}

// Main OrderItem CSV Parser Function (ARES III `bloom/orders/orderitem/` export, 32 columns)
export function parseCSVToOrderItems(csvText: string): OrderItemParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return {
      orderItems: [],
      totalRows: 0,
      validCount: 0,
      reshipCount: 0,
      dateRange: { start: "", end: "" },
      totalRefundAmount: 0,
      missingCriticalColumns: [],
      isLikelyWrongFileType: false,
      detectedColumns: []
    };
  }

  // Detect Headers — 공유 컬럼매칭 엔진 사용(csvColumnMatcher.ts).
  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const orderItemColumnRules: ColumnRule[] = [
    { key: "id", test: isIdColumn },
    { key: "groupOrderNumber", test: (col) => col.includes("그룹주문번호") || col.includes("그룹 주문번호") },
    { key: "paymentDate", test: (col) => col.includes("결제일") },
    { key: "orderNumber", test: (col) => col.includes("주문번호") && !col.includes("외부") && !col.includes("세부채널") },
    { key: "product", test: (col) => col.includes("상품 상세 명") || col.includes("상품상세명") },
    { key: "product", guard: (hasExisting) => !hasExisting, test: (col) => col.includes("상품 상세") || col.includes("상품명") || col === "상품" },
    // 기존 수령일은 별도 참고용 컬럼이라 매핑하지 않음(수령일과 구분만 함) — 아래 "수령일" 규칙에
    // 잘못 걸리지 않도록 여기서 조용히 소비만 하고 아무 필드에도 배정하지 않는다.
    { key: null, test: (col) => col.includes("기존 수령일") || col.includes("기존수령일") },
    { key: "deliveryDate", test: (col) => col.includes("수령일") },
    { key: "settlementPrice", test: (col) => col.includes("정산 가격") || col.includes("정산가격") || col.includes("정산 금액") },
    { key: "price", guard: (hasExisting) => !hasExisting, test: (col) => col.includes("가격") },
    { key: "quantity", test: (col) => col.includes("수량") },
    { key: "claimStatus", test: (col) => col.includes("claim") || col.includes("클레임") },
    { key: "farmSettlementRatio", test: (col) => col.includes("농가정산비율") || col.includes("농가 정산 비율") || col.includes("농가정산 비율") },
    { key: "refundAmount", test: (col) => col.includes("환불금액") || col.includes("환불 금액") },
    { key: "customerName", test: (col) => col.includes("이름") || col === "customer" },
    { key: "orderTitle", test: (col) => col.includes("주문서 제목") || col.includes("주문자 제목") },
  ];

  const { indices: orderCols, hasHeader } = detectColumns(headerRow, orderItemColumnRules);
  let colId = orderCols.id;
  let colPaymentDate = orderCols.paymentDate;
  let colGroupOrderNumber = orderCols.groupOrderNumber;
  let colOrderNumber = orderCols.orderNumber;
  let colProduct = orderCols.product;
  let colDeliveryDate = orderCols.deliveryDate;
  let colPrice = orderCols.price;
  let colSettlementPrice = orderCols.settlementPrice;
  let colQuantity = orderCols.quantity;
  let colClaimStatus = orderCols.claimStatus;
  let colFarmSettlementRatio = orderCols.farmSettlementRatio;
  let colRefundAmount = orderCols.refundAmount;
  let colCustomerName = orderCols.customerName;
  let colOrderTitle = orderCols.orderTitle;

  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, orderCols, [
    { key: "paymentDate", label: "결제일" },
    { key: "orderNumber", label: "주문번호" },
    { key: "product", label: "상품 상세 명/상품명" },
  ], rawRows[0]);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const rawOrderItems: OrderItem[] = [];

  dataRows.forEach((row, idx) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const rowNum = idx + 1;
    const rawId = colId !== -1 && row[colId] ? row[colId].trim() : "";

    const orderNumber = colOrderNumber !== -1 && row[colOrderNumber] ? stripExcelWrapper(row[colOrderNumber]) : "";
    const id = rawId || orderNumber || `ORD-${String(rowNum).padStart(4, "0")}`;

    let paymentDate = colPaymentDate !== -1 && row[colPaymentDate] ? normalizeDateStr(row[colPaymentDate]) : "";
    let deliveryDate = colDeliveryDate !== -1 && row[colDeliveryDate] ? normalizeDateStr(row[colDeliveryDate]) : "";

    const product = colProduct !== -1 && row[colProduct] ? row[colProduct].trim() : "알 수 없는 상품";
    const groupOrderNumber = colGroupOrderNumber !== -1 && row[colGroupOrderNumber] ? stripExcelWrapper(row[colGroupOrderNumber]) : undefined;

    // "정산 가격" 등 일부 컬럼은 어드민에서 "6000.0"처럼 소수점 붙은 float로 export된다.
    // 예전엔 [^0-9]로 숫자 아닌 문자를 전부 제거했는데, 그러면 소수점(".")도 같이 사라져서
    // "6000.0" → "60000"으로 10배 부풀려지는 사고가 실측으로 확인됨(재발송비용 전반에 영향).
    // 소수점/부호는 남기고 parseFloat로 정확히 읽은 뒤 정수 원 단위로 반올림한다.
    const parseNumeric = (colIdx: number): number | undefined => {
      if (colIdx === -1 || !row[colIdx]) return undefined;
      const numericVal = parseFloat(row[colIdx].replace(/[^0-9.-]/g, ""));
      return isNaN(numericVal) ? undefined : Math.round(numericVal);
    };

    const price = parseNumeric(colPrice);
    const settlementPrice = parseNumeric(colSettlementPrice);
    const quantity = parseNumeric(colQuantity);
    const refundAmount = parseNumeric(colRefundAmount);

    const claimStatus = colClaimStatus !== -1 && row[colClaimStatus] ? row[colClaimStatus].trim() : undefined;
    const farmSettlementRatio = colFarmSettlementRatio !== -1 && row[colFarmSettlementRatio] ? row[colFarmSettlementRatio].trim() : undefined;
    const customerName = colCustomerName !== -1 && row[colCustomerName] ? row[colCustomerName].trim() : undefined;
    const orderTitle = colOrderTitle !== -1 && row[colOrderTitle] ? row[colOrderTitle].trim() : undefined;

    const isReshipCost = orderNumber.trim().toUpperCase().endsWith("-CS");

    if (!paymentDate && !orderNumber) return; // skip fully empty/garbage rows

    rawOrderItems.push({
      id,
      paymentDate,
      groupOrderNumber,
      orderNumber,
      product,
      deliveryDate,
      price,
      settlementPrice,
      quantity,
      claimStatus,
      farmSettlementRatio,
      refundAmount,
      isReshipCost,
      customerName,
      orderTitle
    });
  });

  // Deduplicate by exact id match. 주문번호는 한 주문(체크아웃)에 여러 상품이 담기면 그 상품 줄들이
  // 전부 같은 값을 공유한다(그룹주문번호처럼 동작) — 실측으로 확인됨(같은 주문번호, 다른 id·다른
  // 상품 3줄). id만 CSV 원본에서 행 단위로 100% 유일하다.
  const orderItemsMap = new Map<string, OrderItem>();
  rawOrderItems.forEach(item => {
    const key = item.id;
    const existing = orderItemsMap.get(key);
    if (existing) {
      if (item.refundAmount !== undefined && existing.refundAmount === undefined) existing.refundAmount = item.refundAmount;
      if (item.settlementPrice !== undefined && existing.settlementPrice === undefined) existing.settlementPrice = item.settlementPrice;
    } else {
      orderItemsMap.set(key, item);
    }
  });

  const orderItems = Array.from(orderItemsMap.values());

  const dates: string[] = [];
  let totalRefundAmount = 0;
  let reshipCount = 0;
  orderItems.forEach(item => {
    if (item.paymentDate) dates.push(item.paymentDate);
    if (item.refundAmount) totalRefundAmount += item.refundAmount;
    if (item.isReshipCost) reshipCount++;
  });
  dates.sort();
  const dateRange = {
    start: dates.length > 0 ? dates[0] : "",
    end: dates.length > 0 ? dates[dates.length - 1] : ""
  };

  return {
    orderItems,
    totalRows: dataRows.length,
    validCount: orderItems.length,
    reshipCount,
    dateRange,
    totalRefundAmount,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}

export interface ProblemFormParseResult {
  problemForms: ProblemForm[];
  totalRows: number;
  validCount: number;
  totalRefundAmount: number;
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
}

// Main ProblemForm(사고접수) CSV Parser Function — 클레임코스트 계산에 필요한 필드만 파싱한다
// (접수시간/재접수시간/환불시간/반려시간 등 라이프사이클 필드는 Phase 2.3 아카이브 탭에서 다룸).
// 채널(일반/B2B 등)은 파싱해서 보존하되, Phase 1 계산/화면에서는 채널 구분 없이 통합 처리한다.
//
// importChannel: 플라워고 사고접수(`/bloom/problems/problemform/`와 스키마가 거의 동일한 별도
// 엔드포인트)는 CSV 자체에 채널 구분 컬럼이 없어 업로드 시점에 사용자가 지정한 값을 그대로 태그한다.
// 컬럼명 차이(그룹주문번호→주문번호 FK, 사고 처리 비율 %→사고 범위 %, 환불 적립금 신규 필드)는
// 아래 rules에 별칭으로 추가해뒀기 때문에, 어느 채널 CSV든 같은 파서가 자동으로 올바르게 인식한다 —
// importChannel 파라미터는 오직 결과 태깅용이고 파싱 로직 분기에는 쓰이지 않는다.
export function parseCSVToProblemForms(csvText: string, importChannel: "일반" | "플라워고" = "일반"): ProblemFormParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return {
      problemForms: [],
      totalRows: 0,
      validCount: 0,
      totalRefundAmount: 0,
      missingCriticalColumns: [],
      isLikelyWrongFileType: false,
      detectedColumns: []
    };
  }

  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const problemFormColumnRules: ColumnRule[] = [
    { key: "id", test: isIdColumn },
    // FK 조인 키: 실제 어드민 export는 "주문번호" 컬럼명을 쓴다(옛 목업 스키마의 "주문 아이템"이 아님).
    // 플라워고 CSV는 "상품주문번호"가 항상 빈 값이고 대신 "그룹주문번호"가 실제 FK 역할을 한다 —
    // "상품주문번호"도 문자열상 "주문번호"를 포함하므로, 먼저 매칭되면 빈 값으로 override해버려
    // 모든 행이 조용히 스킵되는 사고가 날 뻔했다(실제 CSV로 검증하다 발견). 그래서 "그룹주문번호"/
    // "주문번호"(정확 매칭류)를 높은 우선순위로 먼저 잡고, "상품주문번호"는 그게 비어있을 때만
    // 후순위 폴백으로 둔다. 재접수시간/처리완료시간과 헷갈리지 않도록 "접수시간"만 명시적으로 잡는다.
    {
      key: "orderItemRef",
      test: (col) => col.includes("그룹주문번호") || col.includes("그룹 주문번호") || col.includes("주문 아이템") || col.includes("주문아이템") ||
        (col.includes("주문번호") && !col.includes("상품주문번호") && !col.includes("상품 주문번호")),
    },
    { key: "orderItemRef", guard: (hasExisting) => !hasExisting, test: (col) => col.includes("상품주문번호") || col.includes("상품 주문번호") },
    { key: "productName", test: (col) => col.includes("상품명") },
    { key: "customerName", test: isReviewerNameColumn },
    { key: "receivedDate", test: (col) => col === "접수시간" || (col.includes("접수시간") && !col.includes("재접수")) },
    { key: "accidentType", test: isAccidentTypeColumn },
    { key: "accidentDetail", test: isAccidentDetailColumn },
    { key: "handlingMethod", test: (col) => col.includes("처리 방법") || col.includes("처리방법") },
    { key: "producerSettlement", test: (col) => col.includes("생산자 정산") || col.includes("생산자정산") },
    { key: "courierSettlement", test: (col) => col.includes("택배사 정산") || col.includes("택배사정산") },
    // "고객 입력 사고 범위 %"(고객 최초 신고값)는 참고용일 뿐 최종 확정치가 아니므로 명시적으로 제외하고,
    // "사고 범위 %"(최종 확정값)와 "사고 범위 설명"만 각각 걸러서 처리한다 — 아래 "사고 범위" 규칙에
    // 잘못 걸리지 않도록 여기서 조용히 소비만 한다.
    { key: null, test: (col) => col.includes("고객 입력") && (col.includes("사고 범위") || col.includes("사고범위")) },
    // 플라워고는 "사고 범위 %"/"고객 입력 사고 범위 %" 두 필드가 아니라 "사고 처리 비율 %" 하나로
    // 통합돼 있다 — 기존 accidentScope(최종 확정값)에 그대로 매핑.
    { key: "accidentScope", test: (col) => ((col.includes("사고 범위") || col.includes("사고범위")) && !col.includes("설명")) || col.includes("사고 처리 비율") || col.includes("사고처리비율") },
    { key: "channel", test: (col) => col.includes("채널") },
    { key: "status", test: (col) => col === "상태" || col.includes("처리상태") || col.includes("접수상태") },
    { key: "refundAmount", test: (col) => col.includes("환불 금액") || col.includes("환불금액") },
    // 플라워고 전용 — 적립금 환불액. 현금환불(환불 금액)과는 별개 필드로 보존(합산하지 않음).
    { key: "pointRefundAmount", test: (col) => col.includes("환불 적립금") || col.includes("환불적립금") },
  ];

  const { indices: pfCols, hasHeader } = detectColumns(headerRow, problemFormColumnRules);
  let colId = pfCols.id;
  let colOrderItemRef = pfCols.orderItemRef;
  let colProductName = pfCols.productName;
  let colCustomerName = pfCols.customerName;
  let colReceivedDate = pfCols.receivedDate;
  let colAccidentType = pfCols.accidentType;
  let colAccidentDetail = pfCols.accidentDetail;
  let colHandlingMethod = pfCols.handlingMethod;
  let colProducerSettlement = pfCols.producerSettlement;
  let colCourierSettlement = pfCols.courierSettlement;
  let colAccidentScope = pfCols.accidentScope;
  let colChannel = pfCols.channel;
  let colStatus = pfCols.status;
  let colRefundAmount = pfCols.refundAmount;
  let colPointRefundAmount = pfCols.pointRefundAmount;

  // 주문번호(FK)를 못 찾으면 모든 행이 조인 불가로 조용히 스킵되므로, 이건 다른 필드보다 훨씬
  // 치명적이라 반드시 경고해야 한다. accidentType/accidentDetail/refundAmount는 실제로 헤더가
  // 비슷한 이름의 다른 export(예: 어드민 "CS 비용 다운로드" — 상품명/처리방법/CS 비용(원)만 있고
  // 사고 유형/상세 유형/환불 금액은 없음)와 혼동해서 잘못 올리는 사고가 실제로 있었던 컬럼들이라,
  // 이 4개가 전부 안 잡히면 "사고접수 CSV가 아니다"로 판단한다(isLikelyWrongFileType).
  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, pfCols, [
    { key: "orderItemRef", label: "주문번호(FK)" },
    { key: "accidentType", label: "사고 유형" },
    { key: "accidentDetail", label: "상세 유형" },
    { key: "refundAmount", label: "환불 금액" },
  ], rawRows[0]);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const problemForms: ProblemForm[] = [];
  let totalRefundAmount = 0;

  dataRows.forEach((row, idx) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const rowNum = idx + 1;
    const rawId = colId !== -1 && row[colId] ? row[colId].trim() : "";
    const id = rawId || `PF-${String(rowNum).padStart(4, "0")}`;

    const orderItemRef = colOrderItemRef !== -1 && row[colOrderItemRef] ? stripExcelWrapper(row[colOrderItemRef]) : "";
    if (!orderItemRef) return; // FK 없는 행은 클레임코스트 계산에 쓸 수 없으므로 스킵

    const productName = colProductName !== -1 && row[colProductName] ? row[colProductName].trim() : undefined;
    const customerName = colCustomerName !== -1 && row[colCustomerName] ? row[colCustomerName].trim() : undefined;
    const receivedDate = colReceivedDate !== -1 && row[colReceivedDate] ? normalizeDateStr(row[colReceivedDate]) : undefined;
    const accidentType = colAccidentType !== -1 && row[colAccidentType] ? row[colAccidentType].trim() : "기타";
    const accidentDetail = colAccidentDetail !== -1 && row[colAccidentDetail] ? row[colAccidentDetail].trim() : "";
    const handlingMethod = colHandlingMethod !== -1 && row[colHandlingMethod] ? row[colHandlingMethod].trim() : "";
    const producerSettlement = colProducerSettlement !== -1 && row[colProducerSettlement] ? row[colProducerSettlement].trim() : undefined;
    const channel = colChannel !== -1 && row[colChannel] ? row[colChannel].trim() : undefined;
    const status = colStatus !== -1 && row[colStatus] ? row[colStatus].trim() : "처리완료";

    let refundAmount: number | undefined;
    if (colRefundAmount !== -1 && row[colRefundAmount]) {
      const numericVal = Math.round(parseFloat(row[colRefundAmount].replace(/[^0-9.-]/g, "")));
      if (!isNaN(numericVal)) refundAmount = numericVal;
    }

    let courierSettlement: number | undefined;
    if (colCourierSettlement !== -1 && row[colCourierSettlement]) {
      const numericVal = Math.round(parseFloat(row[colCourierSettlement].replace(/[^0-9.-]/g, "")));
      if (!isNaN(numericVal)) courierSettlement = numericVal;
    }

    let pointRefundAmount: number | undefined;
    if (colPointRefundAmount !== -1 && row[colPointRefundAmount]) {
      const numericVal = Math.round(parseFloat(row[colPointRefundAmount].replace(/[^0-9.-]/g, "")));
      if (!isNaN(numericVal)) pointRefundAmount = numericVal;
    }

    let accidentScope: number | undefined;
    if (colAccidentScope !== -1 && row[colAccidentScope]) {
      const numericVal = parseFloat(row[colAccidentScope].replace(/[^0-9.]/g, ""));
      if (!isNaN(numericVal)) accidentScope = numericVal;
    }

    if (refundAmount) totalRefundAmount += refundAmount;

    problemForms.push({
      id,
      orderItemRef,
      productName,
      customerName,
      receivedDate,
      accidentType,
      accidentDetail,
      handlingMethod,
      accidentScope,
      channel,
      status,
      refundAmount,
      producerSettlement,
      courierSettlement,
      pointRefundAmount,
      importChannel
    });
  });

  return {
    problemForms,
    totalRows: dataRows.length,
    validCount: problemForms.length,
    totalRefundAmount,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}

// ============================================================================
// CS 비용 다운로드 export — 어드민의 별도 "CS 비용 다운로드" 버튼에서 나오는 파일.
// 컬럼: id, 접수일, 상태, 처리방법, 상품명, 상품 사이즈명, 상품 색상명, 배송타입,
// 사고 처리 비율 %, CS 비용(원). 주문번호/FK가 없어 메인 계산(OrderItem/ProblemForm 조인)에는
// 못 쓰고, 기간 합계를 우리 계산 결과와 비교하는 진단(verifyClaimCostAgainstCsExport)에만 쓴다.
// ============================================================================
export interface CsCostExportRow {
  id: string;
  receivedDate: string; // 접수일 (YYYY.MM.DD, normalizeDateStr 적용)
  status: string;
  handlingMethod: string;
  productName: string;
  productSizeName?: string;
  productColorName?: string;
  deliveryType?: string;
  accidentHandlingRatio?: number; // 사고 처리 비율(%) — 0~100
  csCostWon?: number; // CS 비용(원)
}

export interface CsCostExportParseResult {
  rows: CsCostExportRow[];
  totalRows: number;
  validCount: number;
  dateRange: { start: string; end: string };
  totalCsCost: number;
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
}

export function parseCSVToCsCostExport(csvText: string): CsCostExportParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return {
      rows: [], totalRows: 0, validCount: 0, dateRange: { start: "", end: "" }, totalCsCost: 0,
      missingCriticalColumns: [], isLikelyWrongFileType: false, detectedColumns: []
    };
  }

  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const csCostColumnRules: ColumnRule[] = [
    { key: "id", test: isIdColumn },
    { key: "receivedDate", test: (col) => col.includes("접수일") },
    { key: "handlingMethod", test: (col) => col.includes("처리방법") || col.includes("처리 방법") },
    { key: "productSizeName", test: (col) => col.includes("사이즈명") || col.includes("사이즈") },
    { key: "productColorName", test: (col) => col.includes("색상명") || col.includes("색상") },
    { key: "productName", test: (col) => col.includes("상품명") },
    { key: "deliveryType", test: (col) => col.includes("배송타입") || col.includes("배송 타입") },
    { key: "accidentRatio", test: (col) => col.includes("사고") && col.includes("비율") },
    { key: "csCost", test: (col) => col.includes("cs") && col.includes("비용") },
    { key: "status", test: (col) => col.includes("상태") },
  ];

  const { indices: csCostCols, hasHeader } = detectColumns(headerRow, csCostColumnRules);
  let colId = csCostCols.id;
  let colReceivedDate = csCostCols.receivedDate;
  let colStatus = csCostCols.status;
  let colHandlingMethod = csCostCols.handlingMethod;
  let colProductName = csCostCols.productName;
  let colProductSizeName = csCostCols.productSizeName;
  let colProductColorName = csCostCols.productColorName;
  let colDeliveryType = csCostCols.deliveryType;
  let colAccidentRatio = csCostCols.accidentRatio;
  let colCsCost = csCostCols.csCost;

  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, csCostCols, [
    { key: "csCost", label: "CS 비용(원)" },
    { key: "productName", label: "상품명" },
  ], rawRows[0]);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const rows: CsCostExportRow[] = [];
  let totalCsCost = 0;
  const dates: string[] = [];

  dataRows.forEach((row, idx) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const rowNum = idx + 1;
    const rawId = colId !== -1 && row[colId] ? row[colId].trim() : "";
    const id = rawId || `CS-${String(rowNum).padStart(4, "0")}`;

    const receivedDate = colReceivedDate !== -1 && row[colReceivedDate] ? normalizeDateStr(row[colReceivedDate]) : "";
    const status = colStatus !== -1 && row[colStatus] ? row[colStatus].trim() : "";
    const handlingMethod = colHandlingMethod !== -1 && row[colHandlingMethod] ? row[colHandlingMethod].trim() : "";
    const productName = colProductName !== -1 && row[colProductName] ? row[colProductName].trim() : "알 수 없는 상품";
    const productSizeName = colProductSizeName !== -1 && row[colProductSizeName] ? row[colProductSizeName].trim() : undefined;
    const productColorName = colProductColorName !== -1 && row[colProductColorName] ? row[colProductColorName].trim() : undefined;
    const deliveryType = colDeliveryType !== -1 && row[colDeliveryType] ? row[colDeliveryType].trim() : undefined;

    let accidentHandlingRatio: number | undefined;
    if (colAccidentRatio !== -1 && row[colAccidentRatio]) {
      const numericVal = parseFloat(row[colAccidentRatio].replace(/[^0-9.]/g, ""));
      if (!isNaN(numericVal)) accidentHandlingRatio = numericVal;
    }

    let csCostWon: number | undefined;
    if (colCsCost !== -1 && row[colCsCost]) {
      const numericVal = Math.round(parseFloat(row[colCsCost].replace(/[^0-9.-]/g, "")));
      if (!isNaN(numericVal)) csCostWon = numericVal;
    }

    if (csCostWon) totalCsCost += csCostWon;
    if (receivedDate) dates.push(receivedDate);

    rows.push({
      id,
      receivedDate,
      status,
      handlingMethod,
      productName,
      productSizeName,
      productColorName,
      deliveryType,
      accidentHandlingRatio,
      csCostWon
    });
  });

  dates.sort();
  const dateRange = { start: dates.length > 0 ? dates[0] : "", end: dates.length > 0 ? dates[dates.length - 1] : "" };

  return {
    rows,
    totalRows: dataRows.length,
    validCount: rows.length,
    dateRange,
    totalCsCost,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}

export interface ChatRoomParseResult {
  chatRooms: ChatRoom[];
  totalRows: number;
  validCount: number;
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
}

// Main ChatRoom(상담/채팅+전화) CSV Parser Function (ARES III `bloom/chatbots/chatroom/` export, 27 columns).
// 이 CSV는 다른 4개 파서(Review/Incident/OrderItem/ProblemForm)와 달리 사용자가 직접 다운로드해
// 손으로 편집할 일이 없는 단일 출처 어드민 export라, 공용 유사매칭(alias) 엔진 대신 정확한 컬럼명
// 정확매칭을 쓴다 — 특히 "매지너 최초 답변 시간"은 어드민 자체의 오탈자라 느슨한 매칭으로 잘못
// 흡수되면 오히려 위험하다(정확히 이 문자열이어야만 매칭되게 유지).
export function parseCSVToChatRooms(csvText: string): ChatRoomParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return { chatRooms: [], totalRows: 0, validCount: 0, missingCriticalColumns: [], isLikelyWrongFileType: false, detectedColumns: [] };
  }

  const headerRow = rawRows[0].map(h => h.trim().toLowerCase());

  const chatRoomColumnRules: ColumnRule[] = [
    { key: "key", test: (col) => col === "key" },
    { key: "customerId", test: (col) => col === "고객 id" || col === "고객id" },
    { key: "customerName", test: (col) => col === "고객 이름" || col === "고객이름" },
    { key: "userChatStatus", test: (col) => col === "유저챗 상태" },
    { key: "participatingManagers", test: (col) => col === "참가한 매니저들" },
    { key: "assignee", test: (col) => col === "담당자" },
    { key: "consultTags", test: (col) => col === "상담 태그" || col === "상담태그" },
    { key: "chatOpenedAt", test: (col) => col === "유저챗 처음 오픈된 시간" },
    { key: "chatClosedAt", test: (col) => col === "유저챗 종료된 시간" },
    // 어드민 원본 컬럼명 자체의 오탈자("매니저"가 아니라 "매지너") — 그대로 정확매칭해야 한다.
    { key: "firstManagerReplyAt", test: (col) => col === "매지너 최초 답변 시간" },
    { key: "chatbotCreatedAt", test: (col) => col === "챗봇 생성 시간" },
    { key: "managerReplyCount", test: (col) => col === "매니저 답변 횟수" },
    { key: "operationStatus", test: (col) => col === "운영 상태" },
    { key: "category", test: (col) => col === "구분" },
    { key: "phoneStatus", test: (col) => col === "전화 상태" },
    { key: "callStartedAt", test: (col) => col === "전화 시작 시간" },
    { key: "callEndedAt", test: (col) => col === "전화 종료 시간" },
    { key: "missedReason", test: (col) => col === "부재중 이유" },
    { key: "uid", test: (col) => col === "uid" },
    { key: "subscribed", test: (col) => col === "정기구독 구독 여부" },
    { key: "joinedAt", test: (col) => col === "가입일" },
    { key: "totalPurchaseAmount", test: (col) => col === "총 구매 금액" },
    { key: "totalPurchaseCount", test: (col) => col === "총 구매 횟수" },
    { key: "lastAccessedAt", test: (col) => col === "최근 접속일" },
    { key: "lastPurchasedAt", test: (col) => col === "최근 구매일" },
    { key: "npsSubmitted", test: (col) => col === "nps 제출 여부" },
    { key: "directLinkFlag", test: (col) => col === "다이렉트 링크 여부" },
  ];

  const { indices: crCols, hasHeader } = detectColumns(headerRow, chatRoomColumnRules);

  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, crCols, [
    { key: "category", label: "구분" },
    { key: "chatbotCreatedAt", label: "챗봇 생성 시간" },
  ], rawRows[0]);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const chatRooms: ChatRoom[] = [];

  const wrapped = (idx: number, row: string[]): string | undefined => {
    if (idx === -1 || !row[idx]) return undefined;
    const v = stripExcelWrapper(row[idx]);
    return v || undefined;
  };
  const plain = (idx: number, row: string[]): string | undefined => {
    if (idx === -1 || !row[idx]) return undefined;
    const v = row[idx].trim();
    return v || undefined;
  };
  const numeric = (idx: number, row: string[]): number | undefined => {
    if (idx === -1 || !row[idx]) return undefined;
    const n = parseFloat(row[idx].replace(/[^0-9.]/g, ""));
    return isNaN(n) ? undefined : n;
  };

  dataRows.forEach((row, idx) => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const key = wrapped(crCols.key, row) || `CHAT-${String(idx + 1).padStart(4, "0")}`;
    const consultTagsRaw = plain(crCols.consultTags, row) || "";
    const consultTags = consultTagsRaw ? consultTagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

    chatRooms.push({
      key,
      customerId: plain(crCols.customerId, row),
      customerName: wrapped(crCols.customerName, row),
      userChatStatus: plain(crCols.userChatStatus, row),
      participatingManagers: plain(crCols.participatingManagers, row),
      assignee: plain(crCols.assignee, row),
      consultTags,
      chatOpenedAt: wrapped(crCols.chatOpenedAt, row),
      chatClosedAt: wrapped(crCols.chatClosedAt, row),
      firstManagerReplyAt: wrapped(crCols.firstManagerReplyAt, row),
      chatbotCreatedAt: wrapped(crCols.chatbotCreatedAt, row),
      managerReplyCount: numeric(crCols.managerReplyCount, row),
      operationStatus: plain(crCols.operationStatus, row),
      category: plain(crCols.category, row) || "채팅",
      phoneStatus: plain(crCols.phoneStatus, row),
      callStartedAt: wrapped(crCols.callStartedAt, row),
      callEndedAt: wrapped(crCols.callEndedAt, row),
      missedReason: plain(crCols.missedReason, row),
      uid: plain(crCols.uid, row),
      subscribed: plain(crCols.subscribed, row),
      joinedAt: wrapped(crCols.joinedAt, row),
      totalPurchaseAmount: numeric(crCols.totalPurchaseAmount, row),
      totalPurchaseCount: numeric(crCols.totalPurchaseCount, row),
      lastAccessedAt: wrapped(crCols.lastAccessedAt, row),
      lastPurchasedAt: wrapped(crCols.lastPurchasedAt, row),
      npsSubmitted: plain(crCols.npsSubmitted, row),
      directLinkFlag: plain(crCols.directLinkFlag, row),
    });
  });

  return {
    chatRooms,
    totalRows: dataRows.length,
    validCount: chatRooms.length,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}

// ============================================================================
// Part E — 발송불가율(SCM VOC) CSV 파서
//
// 다른 5개 파서와 달리 이 CSV는 이미 SQL 단(디비버로 직접 실행한 쿼리)에서 주/월별로 집계까지
// 끝난 형태(receipt_week 또는 receipt_month, total_qty, dispatch_failed_qty, dispatch_failure_rate)라,
// row-level 원본을 다시 계산할 필요가 없다 — 그대로 파싱해서 차트에 꽂으면 된다. 그래서 별도
// 엔진 파일 없이 여기 파서 하나로 충분하다. 컬럼명은 사용자가 직접 짠 고정 쿼리의 별칭이라
// 어드민 export처럼 이름이 들쭉날쭉할 위험이 없으므로, 다른 파서들의 유사매칭 대신 정확매칭을 쓴다.
// ============================================================================

export interface DispatchFailureRow {
  period: string; // granularity="weekly"면 "IYYY-IW"(예: "2026-05"), "monthly"면 "YYYY-MM"
  totalQty: number;
  dispatchFailedQty: number;
  dispatchFailureRate: number; // 0~1 비율(퍼센트 아님) — SQL의 ROUND(...,4) 결과 그대로
}

export interface DispatchFailureParseResult {
  rows: DispatchFailureRow[];
  totalRows: number;
  validCount: number;
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
}

export function parseCSVToDispatchFailure(csvText: string, granularity: "weekly" | "monthly"): DispatchFailureParseResult {
  const rawRows = parseCSVRows(csvText);

  if (rawRows.length === 0) {
    return { rows: [], totalRows: 0, validCount: 0, missingCriticalColumns: [], isLikelyWrongFileType: false, detectedColumns: [] };
  }

  const headerRow = rawRows[0].map(h => h.trim().toLowerCase());
  const periodColName = granularity === "weekly" ? "receipt_week" : "receipt_month";
  const periodLabel = granularity === "weekly" ? "receipt_week" : "receipt_month";

  const dispatchFailureColumnRules: ColumnRule[] = [
    { key: "period", test: (col) => col === periodColName },
    { key: "totalQty", test: (col) => col === "total_qty" },
    { key: "dispatchFailedQty", test: (col) => col === "dispatch_failed_qty" },
    { key: "dispatchFailureRate", test: (col) => col === "dispatch_failure_rate" },
  ];

  const { indices: dfCols, hasHeader } = detectColumns(headerRow, dispatchFailureColumnRules);
  const colPeriod = dfCols.period;
  const colTotalQty = dfCols.totalQty;
  const colFailedQty = dfCols.dispatchFailedQty;
  const colRate = dfCols.dispatchFailureRate;

  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, dfCols, [
    { key: "period", label: periodLabel },
    { key: "totalQty", label: "total_qty" },
    { key: "dispatchFailedQty", label: "dispatch_failed_qty" },
  ], rawRows[0]);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const rows: DispatchFailureRow[] = [];

  dataRows.forEach(row => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const period = colPeriod !== -1 && row[colPeriod] ? row[colPeriod].trim() : "";
    if (!period) return;

    const totalQty = colTotalQty !== -1 && row[colTotalQty] ? Math.round(parseFloat(row[colTotalQty].replace(/[^0-9.-]/g, ""))) : NaN;
    const dispatchFailedQty = colFailedQty !== -1 && row[colFailedQty] ? Math.round(parseFloat(row[colFailedQty].replace(/[^0-9.-]/g, ""))) : NaN;
    if (isNaN(totalQty) || isNaN(dispatchFailedQty)) return;

    // dispatch_failure_rate은 SQL이 이미 계산해서 내려주지만, 혹시 컬럼이 없거나 비어있으면
    // total_qty/dispatch_failed_qty로부터 안전하게(0으로 나누지 않도록) 재계산한다.
    const rawRate = colRate !== -1 && row[colRate] ? parseFloat(row[colRate]) : NaN;
    const dispatchFailureRate = !isNaN(rawRate) ? rawRate : (totalQty > 0 ? dispatchFailedQty / totalQty : 0);

    rows.push({ period, totalQty, dispatchFailedQty, dispatchFailureRate });
  });

  rows.sort((a, b) => a.period.localeCompare(b.period));

  return {
    rows,
    totalRows: dataRows.length,
    validCount: rows.length,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}

// ============================================================================
// Part F — NPS(전사 순추천고객지수)
//
// ARES III 어드민(/bloom/surveys/netpromoterscore/)이 "내보내기"로 제공하는 건 3.4만 건+ 원본 응답
// 로우 하나뿐이다(집계 요약 문구는 화면 표시용일 뿐 파일로 못 뽑는다). 그래서 임포터는 원본 CSV 하나만
// 받고, import 시점에 필요한 모든 집계(누적 요약/Detractor 워치리스트/월별 추이)를 한 번에 계산해
// state에는 그 소규모 파생값만 남긴다 — 원본 3.4만 건 로우는 파싱이 끝나면 버려진다.
// ============================================================================

export interface NpsSummary {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  // 이 요약치가 반영하는 시점 표시용("YYYY.MM.DD") — 업로드 시점에 컨텍스트에서 채워 넣는다.
  asOf?: string;
}

// 구매빈도 등급 — "고빈도 구매자(단골)일수록 이탈률이 더 높은가"를 보려면 Detractor만 봐선 안 되고
// 전체 응답자를 등급별로 나눈 분모가 있어야 한다. 구간은 서로 겹치지 않게(총합 = validCount) 정의.
// ⚠️ min:0 등급은 라벨을 "0회"라고 쓰면 안 된다(실측으로 확인됨) — 실제 CSV에 "구매 횟수"가
// 리터럴 0으로 찍힌 행은 단 한 건도 없고, 이 등급은 전부 공란(구매이력이 연결 안 된 응답, 회원/
// 비회원 섞여있음)이다. "확인된 0회 구매"처럼 보이면 안 되므로 "미기재"로 명시한다.
export const NPS_PURCHASE_TIERS = [
  { label: "구매이력 미기재", min: 0, max: 0 },
  { label: "1회", min: 1, max: 1 },
  { label: "2~5회", min: 2, max: 5 },
  { label: "6~10회", min: 6, max: 10 },
  { label: "11회+", min: 11, max: Infinity },
] as const;

export function purchaseTierLabel(purchaseCount: number): string {
  const tier = NPS_PURCHASE_TIERS.find(t => purchaseCount >= t.min && purchaseCount <= t.max);
  return tier ? tier.label : NPS_PURCHASE_TIERS[NPS_PURCHASE_TIERS.length - 1].label;
}

export interface NpsPurchaseTierStat {
  tier: string;
  total: number; // 그 등급 전체 응답 수(promoter+passive+detractor)
  detractors: number; // 그 등급 중 Detractor 수
}

// promoterRate/passiveRate/detractorRate는 소수점 첫째자리 %, score는 표준 NPS 정의(프로모터% - 디트랙터%,
// 정수로 반올림) 그대로다. 매번 이 함수로 계산해서 쓰고 파생값을 NpsSummary에 저장해두지 않는다 — 저장해두면
// summary가 갱신될 때 파생값과 어긋날 위험이 있다.
export function computeNpsRates(summary: NpsSummary): { promoterRate: number; passiveRate: number; detractorRate: number; score: number } {
  const total = summary.total > 0 ? summary.total : 1;
  const promoterRate = Math.round((summary.promoters / total) * 1000) / 10;
  const passiveRate = Math.round((summary.passives / total) * 1000) / 10;
  const detractorRate = Math.round((summary.detractors / total) * 1000) / 10;
  const score = Math.round(((summary.promoters - summary.detractors) / total) * 100);
  return { promoterRate, passiveRate, detractorRate, score };
}

// ============================================================================
// Part F 우선순위 1/2/3/4/5 — NPS 원본 응답 CSV 통합 임포터
//
// ARES III "내보내기"(id, 생성일, 회원/비회원, 이메일, 구매 횟수, 총 구매 비용, 최근 구매 상품,
// 꽃 취향, 기본 배송지, 점수, 피드백)를 사전 필터링 없이 그대로 받아, 이 함수 하나가 한 번의 훑기로
// promoter(9~10점)/passive(7~8점)/detractor(0~6점) 집계, Detractor 상세 행, 월별 NPS 추이를 전부
// 계산한다. "요약 갱신"과 "Detractor 추출"과 "추이 집계"를 별개 업로드로 나눌 이유가 없다 — 셋 다
// 같은 로우 하나에서 나오는 값이기 때문이다.
//
// ⚠️ 점수 공란 처리(중요, 실측으로 확인됨): ARES 어드민 자체가 점수 미기재 응답을 Detractor로
// 합산한다(0~6점 실응답 + 공란 = 어드민 표시 detractors와 정확히 일치, 공란을 제외하면 NPS 78이
// 아니라 80으로 어긋남). 그래서 점수 공란 행은 무효 처리(스킵)하지 않고 Detractor로 합산하되,
// score 필드는 null로 남겨 "실제 0~6점"과 "미기재"를 화면에서 구분할 수 있게 한다. 0~10 범위를
// 벗어나는 값(오염된 데이터)만 무효로 스킵한다.
//
// 성능 원칙: "원본 로우를 프론트에 올리지 않는다"는 "state/localStorage에 3.4만 건을 계속 들고
// 있지 않는다"는 뜻이지 "브라우저가 CSV 텍스트를 한 번 파싱하는 것"까지 금지하는 게 아니다 — 이
// 함수는 업로드 시점에 한 번 전체를 훑고, 실제로 저장되는 건 요약 숫자 4개 + detractor 서브셋
// (보통 수백~수천 건) + 월별 추이(수십 건)뿐이다.
// ============================================================================

export interface NpsDetractorRow {
  id: string; // CSV의 ID 컬럼을 우선 쓰고, 없으면 email+응답일로 합성한 안정적인 키
  email?: string;
  isMember: boolean; // "회원/비회원" 컬럼. 비회원은 이메일이 구조적으로 없어 우선순위 5 매칭 대상에서 제외됨.
  score: number | null; // 0~6, 또는 점수 공란이었던 경우 null("미기재" — 그래도 Detractor로 합산됨)
  purchaseCount: number; // CSV 공란도 0으로 저장됨 — "진짜 0회 구매"와 "구매이력 미연결"이 구분 안 됨(실측상 공란만 존재, 리터럴 0은 없음). 등급 표시는 NPS_PURCHASE_TIERS의 "구매이력 미기재" 라벨을 참고.
  totalPurchaseAmount: number;
  lastPurchaseProduct?: string;
  feedback?: string;
  respondedAt?: string; // 생성일 원문 그대로(형식이 CSV마다 다를 수 있어 별도 정규화하지 않음)
}

export interface NpsTrendPoint {
  period: string; // "YYYY-MM" — 생성일 기준 월별 버킷
  score: number; // 그 기간의 NPS 스코어(정수, -100~100)
  total: number; // 그 기간 응답 총 건수(툴팁 표시용)
}

export interface NpsImportResult {
  // 업로드된 CSV 전체(3.4만 건+)를 그대로 훑어 집계한 값 — ARES 내보내기는 항상 전체 응답이므로
  // 별도 "이 파일이 전체 응답인지" 확인 없이 바로 누적 NPS 카드에 반영한다.
  summary: NpsSummary;
  detractorRows: NpsDetractorRow[]; // score 0~6 또는 공란인 행만(우선순위 2/4/5용)
  trend: NpsTrendPoint[]; // 생성일 기준 월별 집계(우선순위 3용)
  purchaseTierStats: NpsPurchaseTierStat[]; // 구매빈도 등급별 전체응답/Detractor 수(NPS_PURCHASE_TIERS 순서)
  totalRows: number;
  validCount: number; // 유효하게 집계된 행 수(점수가 0~10 범위 밖인 오염 행만 제외)
  missingCriticalColumns: string[];
  isLikelyWrongFileType: boolean;
  detectedColumns: string[];
}

export function parseNpsImportCsv(csvText: string): NpsImportResult {
  const rawRows = parseCSVRows(csvText);
  if (rawRows.length === 0) {
    return {
      summary: { total: 0, promoters: 0, passives: 0, detractors: 0 },
      detractorRows: [], trend: [], purchaseTierStats: [], totalRows: 0, validCount: 0,
      missingCriticalColumns: [], isLikelyWrongFileType: false, detectedColumns: []
    };
  }

  const headerRow = rawRows[0].map(h => h.toLowerCase());

  const npsImportColumnRules: ColumnRule[] = [
    { key: "id", test: isIdColumn },
    { key: "respondedAt", test: (col) => col.includes("생성일") || col.includes("작성일") || col.includes("created") || col === "date" },
    { key: "isMember", test: (col) => col.includes("회원") },
    { key: "email", test: (col) => col.includes("이메일") || col.includes("email") },
    { key: "purchaseCount", test: (col) => col.includes("구매횟수") || col.includes("구매 횟수") || col.replace(/\s|_/g, "").includes("purchasecount") },
    // 실제 ARES export 헤더는 "총 구매 비용"/"최근 구매 상품"처럼 단어 사이에 공백이 들어있다
    // (예전엔 공백 없는 형태만 체크해서 매칭 자체가 안 됐음 — 실측으로 확인된 사고). 공백을 지우고
    // 비교해 어느 쪽이든 잡히게 한다.
    { key: "totalPurchaseAmount", test: (col) => { const c = col.replace(/\s|_/g, ""); return c.includes("총구매") || c.includes("구매비용") || c.includes("구매금액") || c.includes("totalpurchase"); } },
    { key: "lastPurchaseProduct", test: (col) => { const c = col.replace(/\s|_/g, ""); return c.includes("최근구매") || c.includes("구매상품") || (c.includes("product") && !c.includes("count")); } },
    { key: "score", test: (col) => col.includes("점수") || col === "score" || col === "nps" },
    { key: "feedback", test: (col) => col.includes("피드백") || col.includes("feedback") || col.includes("의견") },
  ];

  const { indices: cols, hasHeader } = detectColumns(headerRow, npsImportColumnRules);

  const { isLikelyWrongFileType, missingCriticalColumns, detectedColumns } = checkSchemaMismatch(hasHeader, cols, [
    { key: "score", label: "점수(score)" },
  ], rawRows[0]);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const detractorRows: NpsDetractorRow[] = [];
  const trendMap = new Map<string, { promoters: number; passives: number; detractors: number }>();
  const tierMap = new Map<string, { total: number; detractors: number }>();
  let promoters = 0, passives = 0, detractors = 0, validCount = 0;
  let autoSeq = 1;

  dataRows.forEach(row => {
    if (row.length === 0 || (row.length === 1 && !row[0])) return;

    const scoreCell = cols.score !== -1 && row[cols.score] ? row[cols.score].trim() : "";
    // 점수 공란은 "무효"가 아니라 "미기재 Detractor"다 — 위 주석대로 스킵하면 어드민 숫자와 어긋난다.
    let score: number | null;
    if (scoreCell === "") {
      score = null;
    } else {
      const parsed = parseInt(scoreCell.replace(/[^0-9-]/g, ""), 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 10) return; // 0~10 범위 밖 오염 값만 무효 처리
      score = parsed;
    }
    validCount++;

    // 구매빈도는 promoter/passive/detractor 전부에서 필요하다(분모까지 있어야 등급별 이탈"률"이
    // 나온다) — Detractor 상세 필드보다 먼저, 모든 행에 대해 계산한다.
    const purchaseCountRaw = cols.purchaseCount !== -1 ? row[cols.purchaseCount] : "";
    const purchaseCountNum = purchaseCountRaw ? parseInt(purchaseCountRaw.replace(/[^0-9-]/g, ""), 10) : 0;
    const tier = purchaseTierLabel(isNaN(purchaseCountNum) ? 0 : purchaseCountNum);
    const tierEntry = tierMap.get(tier) || { total: 0, detractors: 0 };
    tierEntry.total++;
    tierMap.set(tier, tierEntry);

    const respondedAt = cols.respondedAt !== -1 && row[cols.respondedAt] ? row[cols.respondedAt].trim() : undefined;
    const period = respondedAt ? normalizeDateStr(respondedAt).slice(0, 7).replace(".", "-") : "";
    const bucket = score !== null && score >= 9 ? "promoters" : score !== null && score >= 7 ? "passives" : "detractors";

    if (period) {
      const entry = trendMap.get(period) || { promoters: 0, passives: 0, detractors: 0 };
      entry[bucket]++;
      trendMap.set(period, entry);
    }

    if (bucket === "promoters") { promoters++; return; }
    if (bucket === "passives") { passives++; return; }

    // Detractor(0~6점 또는 공란)만 상세 필드까지 채워서 보관(우선순위 2/4/5용)
    detractors++;
    tierEntry.detractors++;
    const memberCell = cols.isMember !== -1 && row[cols.isMember] ? row[cols.isMember].trim() : "";
    const email = cols.email !== -1 && row[cols.email] ? row[cols.email].trim() : "";
    const isMember = memberCell ? !memberCell.includes("비회원") : Boolean(email);
    const totalAmountRaw = cols.totalPurchaseAmount !== -1 ? row[cols.totalPurchaseAmount] : "";
    const totalAmountNum = totalAmountRaw ? Math.round(parseFloat(totalAmountRaw.replace(/[^0-9.-]/g, ""))) : 0;
    const lastPurchaseProduct = cols.lastPurchaseProduct !== -1 && row[cols.lastPurchaseProduct] ? row[cols.lastPurchaseProduct].trim() : undefined;
    const feedback = cols.feedback !== -1 && row[cols.feedback] ? row[cols.feedback].trim() : "";
    const csvId = cols.id !== -1 && row[cols.id] ? row[cols.id].trim() : "";
    const id = csvId || `${email || "row"}_${respondedAt || autoSeq++}`;

    detractorRows.push({
      id,
      email: email || undefined,
      isMember,
      score,
      purchaseCount: isNaN(purchaseCountNum) ? 0 : purchaseCountNum,
      totalPurchaseAmount: isNaN(totalAmountNum) ? 0 : totalAmountNum,
      lastPurchaseProduct,
      feedback: feedback || undefined,
      respondedAt
    });
  });

  const trend: NpsTrendPoint[] = Array.from(trendMap.entries())
    .map(([period, counts]) => {
      const total = counts.promoters + counts.passives + counts.detractors;
      const score = total > 0 ? Math.round(((counts.promoters - counts.detractors) / total) * 100) : 0;
      return { period, score, total };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  // NPS_PURCHASE_TIERS 순서를 그대로 유지(맵 삽입 순서가 아니라) — 화면에서 항상 0회→11회+ 순으로
  // 나오게 하기 위함. 데이터에 아예 없는 등급도 0/0으로 채워서 등급 목록이 항상 5개로 고정된다.
  const purchaseTierStats: NpsPurchaseTierStat[] = NPS_PURCHASE_TIERS.map(t => {
    const entry = tierMap.get(t.label) || { total: 0, detractors: 0 };
    return { tier: t.label, total: entry.total, detractors: entry.detractors };
  });

  return {
    summary: { total: validCount, promoters, passives, detractors },
    detractorRows,
    trend,
    purchaseTierStats,
    totalRows: dataRows.length,
    validCount,
    missingCriticalColumns,
    isLikelyWrongFileType,
    detectedColumns
  };
}
