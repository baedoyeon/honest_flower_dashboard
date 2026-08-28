// 5개 CSV 파서(Review/Incident/OrderItem/ProblemForm/CsCostExport)가 각자 따로 손으로 짠
// 컬럼 헤더 매칭 로직을 한 곳으로 모은 공용 엔진이다. 예전엔 같은 개념(평점, 상품명, 환불금액 등)의
// 별칭 목록이 파서마다 미묘하게 달라서, 실제 어드민 export가 컬럼명을 조금만 바꿔도(예: "총점")
// 어느 한 파서에서만 조용히 인식 실패하는 사고가 반복됐다. 이제는 컬럼 하나(concept)의 별칭을
// 한 군데서 고치면 그 concept를 쓰는 모든 파서에 동시에 적용된다.

export interface ColumnRule {
  // null = "이 컬럼명을 만나면 조용히 소비하고 아무 필드에도 배정하지 않는다" — 더 넓은 후속 규칙이
  // 이 컬럼을 잘못 가져가지 않게 막는 명시적 제외 규칙(예: "기존 수령일"이 "수령일" 규칙에 안 걸리게).
  key: string | null;
  // 이 헤더 셀이 이 rule(=concept)에 속하는지 여부. true를 반환하면 이 셀은 이 rule에 "소비"되어
  // 이후 rule은 검사하지 않는다(기존 if/else-if 체인과 동일한 배타성).
  test: (col: string) => boolean;
  // true를 반환해야 이 rule이 이 컬럼의 후보가 된다(false면 이 rule을 건너뛰고 다음 rule을 검사) —
  // "다른 컬럼이 이미 이 필드를 잡았으면 더 넓은 이 패턴은 아예 검사하지 말고 다음 필드로 넘겨라"는
  // 케이스(예: OrderItem의 상품 2단계 우선순위, ProblemForm의 사고범위 원본값 제외)를 표현한다.
  guard?: (hasExisting: boolean) => boolean;
  // 이미 다른 셀이 같은 key에 배정돼 있을 때, 이번 매칭으로 덮어쓸지 결정한다. 생략하면 기본값은
  // "항상 덮어씀"(마지막 매칭 우선) — 원본 if/else-if 체인의 각 분기가 가드 없이 무조건 대입했던
  // 것과 동일한 기본 동작이다. 선착순이 필요하면(예: colType) shouldOverride에서 !hasExisting만 반환.
  shouldOverride?: (col: string, hasExisting: boolean) => boolean;
}

export interface ColumnDetectionResult {
  indices: Record<string, number>;
  hasHeader: boolean;
}

// 헤더 행 하나를 순회하며, 각 셀에 대해 rules를 순서대로 검사해 첫 매칭 rule에 그 컬럼 인덱스를
// 배정한다. rules의 순서가 우선순위다(기존 if/else-if 체인 순서를 그대로 옮긴 것).
export function detectColumns(headerRow: string[], rules: ColumnRule[]): ColumnDetectionResult {
  const indices: Record<string, number> = {};
  rules.forEach(r => { if (r.key !== null && indices[r.key] === undefined) indices[r.key] = -1; });
  let hasHeader = false;

  headerRow.forEach((rawCol, index) => {
    const col = rawCol.trim().replaceAll('"', '').toLowerCase();
    for (const rule of rules) {
      const hasExisting = rule.key !== null && indices[rule.key] !== -1;
      if (rule.guard && !rule.guard(hasExisting)) continue;
      if (rule.test(col)) {
        if (rule.key === null) break; // 의도적으로 무시 — hasHeader도 건드리지 않고 이 컬럼 처리를 끝낸다
        hasHeader = true;
        const doAssign = rule.shouldOverride ? rule.shouldOverride(col, hasExisting) : true;
        if (doAssign) indices[rule.key] = index;
        break;
      }
    }
  });

  return { indices, hasHeader };
}

// ============================================================================
// 여러 파서가 공유하는 개념(concept)별 표준 별칭 목록. 하나 고치면 이 concept를 쓰는 모든 파서에
// 동시 반영된다 — "총점" 버그가 재발하지 않도록 하는 것이 이 파일의 핵심 목적이다.
// ============================================================================

export const isIdColumn = (col: string) => /^(id|no|번호|index|접수번호|순번)$/i.test(col);

// "상품명"류 구체적 컬럼명만 매칭 — "상품 사이즈명"/"상품 색상명"처럼 "상품"을 포함하지만 실제로는
// 다른 개념인 컬럼과 겹치지 않는다(둘 다 "상품명"을 연속 부분문자열로 포함하지 않음). 우선순위 1.
export const isProductNameColumn = (col: string) =>
  col.includes("상품명") || col.includes("주문상품") || col.includes("제품") || col === "product";

// 위 구체적 매칭이 하나도 안 걸렸을 때만 쓰는 광범위 폴백("상품"만 포함해도 매칭) — 반드시
// `guard: (hasExisting) => !hasExisting`와 함께, isProductNameColumn 규칙 다음 순위로만 사용할 것.
// 그렇지 않으면 "상품 사이즈명"/"상품 색상명"이 헤더에서 "상품명"보다 뒤에 오는 실제 CSV(예:
// 어드민 "CS 비용 다운로드" export)에서 올바른 "상품명" 컬럼을 잘못 덮어쓰는 사고가 재발한다.
export const isProductColumn = (col: string) =>
  col.includes("상품명") || col.includes("주문상품") || col.includes("상품") || col.includes("제품") || col === "product";

export const isRatingColumn = (col: string) =>
  col.includes("별점") || col.includes("평점") || col.includes("총점") || col.includes("점수") || col === "rating";

export const isRefundAmountColumn = (col: string) =>
  col.includes("환불 금액") || col.includes("환불금액") || col.includes("보상금액") || col.includes("환불금") ||
  col.includes("보상금") || col.includes("환불") || col.includes("보상") || col === "refund";

export const isAccidentTypeColumn = (col: string) =>
  col.includes("사고 유형") || col.includes("사고유형") || col.includes("사고구분") || col.includes("사고분류") ||
  col.includes("cs유형") || col.includes("cs구분") || col.includes("접수유형") || col.includes("클레임유형") || col.includes("대분류");

export const isAccidentDetailColumn = (col: string) =>
  col.includes("상세 유형") || col.includes("상세유형") || col.includes("세부분류") || col.includes("세부원인") ||
  col.includes("사고상세") || col.includes("세부유형") || col.includes("불량원인") || col.includes("사유") ||
  col.includes("세부사유") || col.includes("소분류");

export const isReviewerNameColumn = (col: string) =>
  col.includes("작성자") || col.includes("고객명") || col.includes("주문자") || col.includes("이름") ||
  col.includes("성함") || col === "reviewer" || col === "customer";

// 헤더는 인식됐는데(hasHeader) 특정 핵심 필드만 못 찾은 경우를 사용자에게 알리기 위한 헬퍼.
// "총점" 사고처럼 컬럼명이 안 맞아 조용히 잘못된 값으로 채워지는 대신, 업로드 화면에서 바로
// 경고를 띄워 사용자가 CSV 헤더명을 확인하게 만든다. 헤더 자체를 못 찾은 경우(포지셔널 폴백)는
// 개별 컬럼 경고가 의미가 약해 제외한다.
export function findMissingCriticalColumns(
  hasHeader: boolean,
  indices: Record<string, number>,
  criticalFields: { key: string; label: string }[]
): string[] {
  if (!hasHeader) return [];
  return criticalFields.filter(f => indices[f.key] === -1).map(f => f.label);
}

export interface SchemaMismatchCheck {
  // true = 이 임포터가 요구하는 핵심 컬럼이 하나도 안 잡혔음 — 헤더는 있는데(hasHeader) 그 헤더가
  // 이 임포터용 스키마와 아예 다른 파일일 가능성이 크다는 뜻(예: "CS 비용 다운로드" export를
  // 사고접수 메인 임포터에 잘못 올린 경우). 조용히 0건 처리하는 대신 화면에 강한 에러로 표시할 것.
  isLikelyWrongFileType: boolean;
  missingCriticalColumns: string[];
  detectedColumns: string[]; // 실제로 인식된 헤더 원문 — 사용자가 스스로 "내가 뭘 올렸는지" 확인하게
}

// findMissingCriticalColumns를 감싸서, "일부만 못 찾음"(헤더명 확인 필요)과 "전부 못 찾음"(완전히
// 다른 종류의 CSV일 가능성)을 구분해준다. 5개 CSV 임포터(Review/Incident/OrderItem/ProblemForm/
// ChatRoom/CsCostExport)가 전부 이 헬퍼 하나를 공유 — 어드민에 이름이 비슷한 export 버튼이 여러 개
// 있어 실제로 잘못 올리는 사고가 반복됐기 때문에(사고접수 메인 임포터 vs "CS 비용 다운로드"), 매
// 임포터마다 따로 판단 로직을 두지 않고 한 곳에서 재사용한다.
export function checkSchemaMismatch(
  hasHeader: boolean,
  indices: Record<string, number>,
  criticalFields: { key: string; label: string }[],
  rawHeaderRow: string[]
): SchemaMismatchCheck {
  const missingCriticalColumns = findMissingCriticalColumns(hasHeader, indices, criticalFields);
  // isLikelyWrongFileType은 일부러 hasHeader를 안 본다 — hasHeader 자체가 "이 규칙셋이 헤더의 어느
  // 컬럼이든 하나라도 알아봤는가"로 정해지는데, 규칙이 몇 개 안 되는 파서(예: 이미 집계된 CSV를
  // 받는 파서)는 완전히 무관한 파일을 올리면 단 하나도 안 걸려서 hasHeader가 false가 되고, 그러면
  // 원래 이 함수가 잡아야 할 "가장 확실한 오업로드" 케이스에서 오히려 조용히 넘어가 버렸다(실측
  // 확인됨). indices만 직접 보면 hasHeader 판정과 무관하게 "핵심 컬럼이 전부 -1인가"를 정확히 알 수
  // 있다 — 이 6개 파서 전부 named-key 매칭만 쓰고 포지셔널 폴백이 없어서, hasHeader가 false인
  // 케이스는 항상 validCount 0으로 이어지므로 이 신호를 숨길 이유가 없다.
  const isLikelyWrongFileType = criticalFields.length > 0 && criticalFields.every(f => indices[f.key] === -1);
  return {
    isLikelyWrongFileType,
    missingCriticalColumns,
    detectedColumns: rawHeaderRow.map(h => h.trim().replaceAll('"', '')).filter(Boolean),
  };
}

export const isIncidentStatusColumn = (col: string) =>
  col.includes("상태") || col.includes("처리상태") || col.includes("접수상태") || col.includes("승인여부") ||
  col.includes("처리결과") || col.includes("진행상태") || col.includes("사고상태") || col.includes("cs상태") || col.includes("status");
