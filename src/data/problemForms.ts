// ProblemForm: ARES III 어드민의 `bloom/problems/problemform/`(사고접수) CSV 내보내기에 대응하는 행 데이터.
// 클레임코스트 계산에 필요한 필드만 우선 파싱한다(전체 아카이브 탭 Phase 2.3은 별도 작업).
export interface ProblemForm {
  id: string;
  orderItemRef: string; // FK — OrderItem.orderNumber와 매칭. 실제 export 헤더는 "주문번호"(옛 목업 스키마의 "주문 아이템" 아님)
  receivedDate?: string; // "접수시간"의 날짜 부분(YYYY.MM.DD) — 시각은 버림. 라이프사이클 전체는 Phase 2.3에서 다룸
  accidentType: string; // 사고 유형: 상품 누락 / 상품 오배송 / 품질 이상 / 기타
  accidentDetail: string; // 상세 유형
  handlingMethod: string; // 처리 방법: 재발송 / 결제 수단으로 환불 / 교환 / 반품 / 적립금 환불
  accidentScope?: number; // 사고 범위(%) — 0~100 사이 실수값(부분환불 비율). 전체/부분 이분법 아님
  channel?: string; // 채널 — 일반/B2B(플라워고) 등이 한 CSV에 섞여 있음. Phase 1은 채널 구분 없이 통합 처리,
                     // 세그먼트 분리는 필드만 보존해두고 추후 필요 시 추가
  status: string; // 상태: 접수중 / 처리완료 / 반려됨 / 최종반려됨
  refundAmount?: number; // 환불 금액(현금성)
  // 플라워고 사고접수(`/bloom/problems/problemform/`와 스키마가 거의 동일한 별도 엔드포인트) 전용 필드.
  // "환불 적립금"은 현금성 환불(refundAmount)과 별개 필드라 합산하지 않고 그대로 보존한다
  // (클레임비용 집계에서 현금환불/적립금환불을 구분해야 할 수 있어서).
  pointRefundAmount?: number;
  // 업로드 시점에 사용자가 지정하는 수집 채널 — CSV 자체엔 이 구분이 없어 업로드 UI에서 채널을
  // 골라 태그한다(그 아래 channel?: string 필드는 CSV 자체의 "채널" 컬럼값으로 별개 개념). 없으면
  // (하위호환, 옛 데이터) "일반"으로 취급.
  importChannel?: "일반" | "플라워고";
  // 아래 2개 필드는 파싱해서 값은 보존하지만 계산/화면 표시에는 사용하지 않기로 확정됨
  // (택배사 정산은 정산 시점이 리포팅 주기와 맞지 않아 이번 스코프 제외; 나중에 필요하면 바로 재사용 가능하도록 필드만 유지).
  producerSettlement?: string; // 생산자 정산: 농가부담 / 반반부담 / 본사부담 — 미사용
  courierSettlement?: number; // 택배사 정산 — 미사용
}

export const initialProblemFormsData: ProblemForm[] = [];
