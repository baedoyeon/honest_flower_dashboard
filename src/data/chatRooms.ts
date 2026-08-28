// ChatRoom: ARES III 어드민의 `bloom/chatbots/chatroom/`(상담/채팅+전화) CSV 내보내기에 대응하는
// 행 데이터. "CS 응대 현황" 탭(응대율/FRT/RT/ART/부재중율 등 SLA 지표)에 필요한 필드만 파싱한다.
export interface ChatRoom {
  key: string;
  customerId?: string; // 고객 ID
  // 고객 이름 — 전화 행은 회원 매칭이 안 되면 이름 대신 전화번호 문자열이 들어옴(예: "01090113599")
  customerName?: string;
  userChatStatus?: "active" | "closed" | "chatbot" | string; // 유저챗 상태 — 응대 여부 판정에는 쓰지 않음(아래 isAnswered 참고)
  participatingManagers?: string; // 참가한 매니저들
  assignee?: string; // 담당자
  consultTags: string[]; // 상담 태그 — 콤마로 join된 문자열 1개 컬럼을 split(",")로 배열화
  chatOpenedAt?: string; // 유저챗 처음 오픈된 시간 ("YYYY-MM-DD HH:mm") — 채팅 세션 시작
  chatClosedAt?: string; // 유저챗 종료된 시간
  firstManagerReplyAt?: string; // "매지너 최초 답변 시간"(어드민 원본 컬럼명 오탈자, 우리 필드명은 정상 표기) — 채팅 최초 응답, 값 없으면 미응대
  chatbotCreatedAt?: string; // 챗봇 생성 시간 — 채팅/전화 모두 레코드 생성(문의 발생) 시각으로 항상 채워짐
  managerReplyCount?: number; // 매니저 답변 횟수
  operationStatus?: string; // 운영 상태: 운영중 / 비운영중 / ""(전화 행 등 해당 없음)
  category: "채팅" | "전화(인바운드)" | "전화(아웃바운드)" | string; // 구분 — 3종
  phoneStatus?: "종료됨" | "부재중" | string; // 전화 상태 — 채팅 행은 항상 빈값
  callStartedAt?: string; // 전화 시작 시간 — 전화 상태==="종료됨"일 때만 채워짐
  callEndedAt?: string; // 전화 종료 시간 — 전화 상태==="종료됨"일 때만 채워짐
  missedReason?: "ring_time_over" | "not_in_operation" | "no_operator" | "user_left" | string; // 부재중 이유
  // reconcileCallbacks()가 채워주는 파생 필드(원본 CSV엔 없음) — 인바운드 부재중 건이 같은 고객의
  // 이후 아웃바운드 성공 통화로 실제로는 응대됐다고 재분류된 경우 true. true면 phoneStatus가
  // "부재중"이어도 isChatRoomAnswered()가 응대로 인정하고 부재중율 집계에서 제외한다.
  reconciledAsCallback?: boolean;
  // 이번 SLA 스펙에서는 지표 계산에 사용하지 않는 고객 프로필 부가정보 — 파싱만 하고 보존
  // (추후 tag_daily 세분화 작업 때 재검토 예정).
  uid?: string;
  subscribed?: string; // 정기구독 구독 여부
  joinedAt?: string; // 가입일
  totalPurchaseAmount?: number; // 총 구매 금액
  totalPurchaseCount?: number; // 총 구매 횟수
  lastAccessedAt?: string; // 최근 접속일
  lastPurchasedAt?: string; // 최근 구매일
  npsSubmitted?: string; // nps 제출 여부
  directLinkFlag?: string; // 다이렉트 링크 여부
}

export const initialChatRoomsData: ChatRoom[] = [];
