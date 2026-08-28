// OrderItem: ARES III 어드민의 `bloom/orders/orderitem/` CSV 내보내기에 대응하는 주문 행 데이터.
// 클레임 비용 코호트 계산(src/utils/claimCostEngine.ts)의 유일한 입력 소스.
export interface OrderItem {
  id: string;
  paymentDate: string; // 결제일 (YYYY.MM.DD, normalizeDateStr 적용됨)
  groupOrderNumber?: string; // 그룹주문번호 — 재발송(-CS) 행을 원본 주문과 묶는 매칭 키
  orderNumber: string; // 주문번호
  product: string;
  deliveryDate: string; // 수령일 (YYYY.MM.DD)
  price?: number;
  settlementPrice?: number; // 정산 가격 (수량 * 1개당 정산가)
  quantity?: number;
  claimStatus?: string; // claim 상태
  farmSettlementRatio?: string; // 농가정산비율 — ProblemForm의 "생산자 정산" enum과 동일 정보인지 검증 대상
  refundAmount?: number; // 환불금액
  isReshipCost: boolean; // 주문번호가 "-CS"로 끝나는 재발송 비용 행인지 여부
  customerName?: string;
  orderTitle?: string;
}

export const initialOrderItemsData: OrderItem[] = [];
