import { ChatRoom } from "../data/chatRooms";
import { ProblemForm } from "../data/problemForms";
import { OrderItem } from "../data/orderItems";

// ChatRoom 시각 컬럼은 "YYYY-MM-DD HH:mm" 형식(어드민 원본, Excel 래퍼는 파서에서 이미 제거됨).
// Date 파싱을 위해 공백을 "T"로 바꿔 표준 형식에 맞춘다.
function parseDT(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? undefined : d;
}

function diffMinutes(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60000;
}

// FRT/ART는 소수의 장기 미응답 건이 평균을 크게 끌어올리는 우측 꼬리 분포라, 평균만 보여주면
// "평균이 왜 이렇게 크냐"는 오해를 산다(실측 확인됨). 중앙값을 병기해 대표값을 보완한다.
function median(samples: number[]): number | undefined {
  if (samples.length === 0) return undefined;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 전역 주차 필터("YYYY.MM.DD" 문자열 범위, ReviewsContext의 weekRanges와 동일 포맷)를 채팅방/전화
// 행에 적용하기 위한 헬퍼. 이벤트 시각은 다른 함수들과 동일한 관례(채팅="유저챗 처음 오픈된 시간",
// 그 외="챗봇 생성 시간")를 쓴다. 시각을 못 읽는 행은 어느 주차에도 속하지 않는 것으로 취급해 제외한다.
export function isChatRoomInRange(room: ChatRoom, range: { start: string; end: string }): boolean {
  const eventTime = parseDT(room.category === "채팅" ? room.chatOpenedAt : room.chatbotCreatedAt);
  if (!eventTime) return false;
  const dateKey = formatYmdLocal(eventTime).replace(/-/g, ".");
  return dateKey >= range.start && dateKey <= range.end;
}

// OrderItem.paymentDate("YYYY.MM.DD")와 ProblemForm.receivedDate("YYYY.MM.DD"), ChatRoom 이벤트
// 시각("YYYY-MM-DD HH:mm") 모두를 "YYYY-MM" 월 키로 통일해 다루기 위한 구분자 무관 헬퍼.
function monthKeyOfFlexible(s?: string): string {
  if (!s) return "";
  const parts = s.split(/[.\-]/).filter(Boolean);
  if (parts.length < 2) return "";
  return `${parts[0]}-${parts[1].padStart(2, "0")}`;
}

function isPhoneCategory(category: string): boolean {
  return category === "전화(인바운드)" || category === "전화(아웃바운드)";
}

// 응대 여부 판정: 유저챗 상태(active/closed/chatbot)만으로는 판단하지 않는다 — 실측 데이터에
// active 상태인데도 이미 매니저가 답변한 케이스(6건)가 있었기 때문. 채팅은 "매지너 최초 답변
// 시간" 유무, 전화는 "전화 상태 === 종료됨"(또는 reconcileCallbacks가 콜백 응대로 재분류한 경우)으로 판정한다.
export function isChatRoomAnswered(room: ChatRoom): boolean {
  if (room.category === "채팅") return !!room.firstManagerReplyAt;
  if (room.reconciledAsCallback) return true;
  return room.phoneStatus === "종료됨";
}

// ============================================================================
// Part B-1 — 영업시간 필터 (평균 FRT/RT/ART 왜곡 방지)
// ============================================================================

// 휴무일 캘린더("YYYY-MM-DD" 집합) — 코드에 하드코딩하지 않고 ReviewsContext(localStorage, 초기값은
// data/companyHolidays.ts의 시드)에서 관리해 사용자가 재배포 없이 날짜를 추가/삭제할 수 있게 한다.
// 이 파일의 함수들은 전부 이 집합을 파라미터로 받기만 하고 직접 정의하지 않는다.
export type HolidaySet = ReadonlySet<string>;

function isBusinessDay(d: Date, holidays: HolidaySet): boolean {
  const day = d.getDay(); // 0=일 .. 6=토
  if (day === 0 || day === 6) return false;
  return !holidays.has(formatYmdLocal(d));
}

// 하루 영업시간 창 — 점심시간(12-13시)은 제외한 두 구간으로 나눈다(사용자 확인 완료, 2026-08-23:
// "점심시간 제외야 12~13시" — 옛 스프레드시트 WEEKLY 탭의 요일×시간대 히트맵도 10·11·13·14·15·16시로만
// 되어 있고 12시가 빠져 있어 이 규칙과 일치). 하루 최대 영업시간은 7시간이 아니라 6시간(360분).
const BUSINESS_WINDOWS: { startHour: number; endHour: number }[] = [
  { startHour: 10, endHour: 12 },
  { startHour: 13, endHour: 17 },
];

// 영업시간 = 월~금(휴무일 제외) 10-12시·13-17시(점심 제외). "운영 상태" 컬럼이 비어있는 행(실측
// 데이터에 실제로 존재)의 폴백 판정에 쓰인다.
function isDuringBusinessHours(d: Date, holidays: HolidaySet): boolean {
  if (!isBusinessDay(d, holidays)) return false;
  const hour = d.getHours();
  return BUSINESS_WINDOWS.some(w => hour >= w.startHour && hour < w.endHour);
}

// from~to 사이 실제 경과한 "영업시간(월~금 10-12시·13-17시, 휴무일 제외)" 분량만 합산한다(야간/주말/
// 휴무일/점심시간 대기시간은 0으로 취급). 단순히 "이 행이 영업시간 안이냐" 이진 판정으로 행 전체를
// 넣거나 빼는 방식은, 열었다가 며칠 뒤에나 답변된 채팅(예: 목요일 오픈 → 다음주 월요일 응답)까지
// "영업중"으로 통째로 카운트해 평균을 수백~수천 분 단위로 왜곡시키는 문제가 있었다(실측 데이터로
// 확인). 대신 이 함수로 날짜별로 걸쳐 있는 영업시간 구간과의 교집합만 분 단위로 누적하면, 오픈~응답이
// 실제로 영업시간을 며칠에 걸쳐 소비했어도 그 실질 대기시간만 정확히 반영되고, 밤/주말/휴무일/점심시간은
// 자동으로 0이 된다.
function businessMinutesBetween(from: Date, to: Date, holidays: HolidaySet): number {
  if (to.getTime() <= from.getTime()) return 0;
  let total = 0;
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (day.getTime() <= endDay.getTime()) {
    if (isBusinessDay(day, holidays)) {
      for (const w of BUSINESS_WINDOWS) {
        const windowStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.startHour, 0, 0, 0);
        const windowEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.endHour, 0, 0, 0);
        const segStart = from > windowStart ? from : windowStart;
        const segEnd = to < windowEnd ? to : windowEnd;
        if (segStart < segEnd) total += diffMinutes(segStart, segEnd);
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return total;
}

export interface OperatingHoursValidation {
  markedOperatingCount: number;
  markedOperatingButOutsideHoursCount: number;
  markedOperatingButOutsideHoursRatePct: number;
  markedNonOperatingCount: number;
  markedNonOperatingButInsideHoursCount: number;
  markedNonOperatingButInsideHoursRatePct: number;
}

// "운영 상태" 컬럼 값이 실제 영업시간(월~금 10~17시)과 얼마나 어긋나는지 검증 — 컬럼을 곧이곧대로
// 믿어도 되는지 판단하기 위한 진단용. 불일치율이 높으면(예: 10% 이상) 화면에 경고를 띄운다.
export function validateOperatingHoursColumn(chatRooms: ChatRoom[], holidays: HolidaySet): OperatingHoursValidation {
  let opTotal = 0, opButOutside = 0, nonOpTotal = 0, nonOpButInside = 0;

  chatRooms.forEach(r => {
    if (r.operationStatus !== "운영중" && r.operationStatus !== "비운영중") return;
    const eventTime = parseDT(r.category === "채팅" ? r.chatOpenedAt : r.chatbotCreatedAt);
    if (!eventTime) return;
    const actuallyInside = isDuringBusinessHours(eventTime, holidays);
    if (r.operationStatus === "운영중") {
      opTotal += 1;
      if (!actuallyInside) opButOutside += 1;
    } else {
      nonOpTotal += 1;
      if (actuallyInside) nonOpButInside += 1;
    }
  });

  return {
    markedOperatingCount: opTotal,
    markedOperatingButOutsideHoursCount: opButOutside,
    markedOperatingButOutsideHoursRatePct: opTotal > 0 ? (opButOutside / opTotal) * 100 : 0,
    markedNonOperatingCount: nonOpTotal,
    markedNonOperatingButInsideHoursCount: nonOpButInside,
    markedNonOperatingButInsideHoursRatePct: nonOpTotal > 0 ? (nonOpButInside / nonOpTotal) * 100 : 0,
  };
}

// ============================================================================
// Part B-1 — 콜백 응대 인정 (인바운드 부재중 → 같은 고객의 아웃바운드 성공 통화로 재분류)
// ============================================================================

// 매칭 시간 창(시간 단위) — 기본값은 사실상 "당일" 재콜백 패턴을 커버하는 24시간. 나중에 조정 가능하도록 상수로 분리.
const CALLBACK_MATCH_WINDOW_HOURS = 24;

// 전화 행의 고객 식별 키 — 고객 ID가 있으면 그걸 쓰고, 없으면(회원 매칭 안 된 통화) 고객 이름에
// 들어있는 전화번호 문자열의 숫자만 추출해 키로 쓴다.
function customerMatchKey(room: ChatRoom): string | undefined {
  if (room.customerId) return `id:${room.customerId}`;
  if (room.customerName) {
    const digits = room.customerName.replace(/[^0-9]/g, "");
    if (digits.length >= 8) return `phone:${digits}`;
  }
  return undefined;
}

// 인바운드 "부재중" 건 뒤에 같은 고객의 아웃바운드 "종료됨"(성공) 통화가 매칭 시간 창 안에 있으면
// 상담원이 콜백해서 실제로는 응대됐다고 재분류한다. 매칭된 아웃바운드 행은 별도 문의로 중복
// 집계하지 않도록 결과 목록에서 제거하고(인바운드 건과 합쳐 1건 처리), 인바운드 건은
// reconciledAsCallback=true로 표시하며 종료 시각을 아웃바운드의 통화 종료 시각으로 갱신한다.
export function reconcileCallbacks(chatRooms: ChatRoom[]): { rooms: ChatRoom[]; reconciledCount: number } {
  const nonPhone = chatRooms.filter(r => !isPhoneCategory(r.category));
  const phone = chatRooms.filter(r => isPhoneCategory(r.category));

  const byCustomer = new Map<string, ChatRoom[]>();
  phone.forEach(r => {
    const key = customerMatchKey(r);
    if (!key) return;
    const list = byCustomer.get(key) || [];
    list.push(r);
    byCustomer.set(key, list);
  });

  const consumedOutboundKeys = new Set<string>();
  const reconciledByKey = new Map<string, ChatRoom>();

  byCustomer.forEach(rows => {
    const missed = rows
      .filter(r => r.phoneStatus === "부재중")
      .map(r => ({ room: r, time: parseDT(r.chatbotCreatedAt) }))
      .filter((x): x is { room: ChatRoom; time: Date } => !!x.time)
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    const outbounds = rows
      .filter(r => r.category === "전화(아웃바운드)" && r.phoneStatus === "종료됨")
      .map(r => ({ room: r, start: parseDT(r.callStartedAt) }))
      .filter((x): x is { room: ChatRoom; start: Date } => !!x.start)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (missed.length === 0 || outbounds.length === 0) return;

    missed.forEach(m => {
      const match = outbounds.find(o => {
        const diffMs = o.start.getTime() - m.time.getTime();
        return diffMs >= 0 && diffMs <= CALLBACK_MATCH_WINDOW_HOURS * 3600000;
      });
      if (!match) return;
      consumedOutboundKeys.add(match.room.key);
      reconciledByKey.set(m.room.key, {
        ...m.room,
        reconciledAsCallback: true,
        callStartedAt: match.room.callStartedAt,
        callEndedAt: match.room.callEndedAt,
        chatClosedAt: match.room.callEndedAt || m.room.chatClosedAt,
      });
    });
  });

  const finalPhone = phone
    .filter(r => !consumedOutboundKeys.has(r.key))
    .map(r => reconciledByKey.get(r.key) || r);

  return { rooms: [...nonPhone, ...finalPhone], reconciledCount: reconciledByKey.size };
}

export interface ChatRoomSummary {
  totalInquiries: number; // 챗(봇 전용 세션 포함)+콜 — 실제 유입량 전체(Part B 정의)
  chatCount: number;
  callCount: number;
  botHandledCount: number; // userChatStatus==="chatbot"로 매니저 개입 없이 봇이 끝낸 채팅 건수
  botHandledRatePct: number; // botHandledCount / totalInquiries × 100
  activeUnknownCount: number; // userChatStatus==="active" — export가 응답 정보를 안 채워줘서 응대
  // 여부 판정 불가(실측 확인, "미응답"으로 셈하면 안 됨). 응대율 분모/분자 모두에서 제외됨.
  humanInquiries: number; // "휴먼 응대율"의 분모 — 챗(봇 전용·active 제외)+콜.
  answeredCount: number; // humanInquiries 중 실제 매니저가 응대한 건수
  responseRatePct: number; // "휴먼 응대율" = answeredCount / humanInquiries × 100, 0~100
  avgFrtMinutes?: number; // First Response Time, 채팅 전용
  medianFrtMinutes?: number; // 소수의 장기 미응답 건이 평균을 크게 끌어올리는 우측 꼬리 분포라 평균만으론 오해 소지 있음 — 대표값으로 병기
  frtSampleSize: number;
  avgArtMinutes?: number; // "RT/ART" — 매니저 답변 횟수 기준 평균 응대 간격(세션 소요시간 / 답변횟수), 채팅 전용
  medianArtMinutes?: number;
  artSampleSize: number;
  channelMix: { label: "채팅" | "전화"; count: number; pct: number }[];
  phoneTotal: number;
  phoneMissedCount: number;
  phoneMissedRatePct: number;
  missedReasonBreakdown: { reason: string; count: number }[];
}

export function computeChatRoomSummary(chatRooms: ChatRoom[], holidays: HolidaySet): ChatRoomSummary {
  const chatRows = chatRooms.filter(r => r.category === "채팅");
  const phoneRows = chatRooms.filter(r => isPhoneCategory(r.category));

  // 봇 전용 세션(userChatStatus==="chatbot")은 매니저 응대가 애초에 필요 없었던 건이라 "휴먼 응대율"
  // 분모/분자 양쪽에서 제외한다 — 실측 확인 결과 봇 세션 중 매니저 응답이 달린 모순 건은 0건이라
  // 이 필드만으로 걸러도 안전함.
  const botChatRows = chatRows.filter(r => r.userChatStatus === "chatbot");
  // "active"(아직 종료 안 된 대화)는 응대율 계산에서 별도로 제외한다 — ARES3 export가 "active"
  // 상태인 행엔 매니저 응답 시각/횟수·담당자·상담 태그까지 전부 공란으로 내려주는 것으로 실측
  // 확인됨(오래된 건도 예외 없이 동일 패턴이라 "아직 집계 전"이 아니라 export 자체의 구조적 한계).
  // 즉 실제로 응대했어도 이 필드들만으론 확인 불가능해서, "미응답"으로 셈하면 실제보다 응대율이
  // 부당하게 낮게 나온다(사용자 확인) — "closed"로 전환된 뒤에야 신뢰할 수 있는 응답 정보가 채워짐.
  const activeChatRows = chatRows.filter(r => r.userChatStatus === "active");
  const knownChatRows = chatRows.filter(r => r.userChatStatus !== "chatbot" && r.userChatStatus !== "active");

  const chatAnswered = knownChatRows.filter(r => isChatRoomAnswered(r));
  const phoneAnswered = phoneRows.filter(r => isChatRoomAnswered(r));
  // 콜백으로 재분류된 건은 더 이상 "부재중"이 아니므로 부재중 집계(분모/분자 모두)에서 제외한다.
  const phoneMissed = phoneRows.filter(r => r.phoneStatus === "부재중" && !r.reconciledAsCallback);

  const totalInquiries = chatRows.length + phoneRows.length;
  const botHandledCount = botChatRows.length;
  const botHandledRatePct = totalInquiries > 0 ? (botHandledCount / totalInquiries) * 100 : 0;
  const activeUnknownCount = activeChatRows.length;

  const humanInquiries = knownChatRows.length + phoneRows.length;
  const answeredCount = chatAnswered.length + phoneAnswered.length;
  const responseRatePct = humanInquiries > 0 ? (answeredCount / humanInquiries) * 100 : 0;

  // 평균 FRT/RT/ART는 오픈~응답 사이에 실제로 경과한 "영업시간(월~금 10-17시)" 분량만 합산한다
  // (야간/주말 대기시간은 0으로 취급, businessMinutesBetween 참고). 행 전체를 영업시간 안/밖으로
  // 이진 판정해 넣거나 빼는 방식은 오픈~응답이 여러 날에 걸친 채팅(예: 목요일 오픈 → 다음주 월요일
  // 응답)까지 통째로 카운트해 평균을 수천 분 단위로 왜곡시켰다(실측 데이터로 확인).
  // 건수 지표(총문의량/채널비중/부재중율)는 이 계산과 무관하게 전체 포함.
  const frtSamples: number[] = [];
  chatAnswered.forEach(r => {
    const open = parseDT(r.chatOpenedAt);
    const reply = parseDT(r.firstManagerReplyAt);
    if (open && reply && reply.getTime() >= open.getTime()) {
      frtSamples.push(businessMinutesBetween(open, reply, holidays));
    }
  });
  const avgFrtMinutes = frtSamples.length > 0 ? frtSamples.reduce((a, b) => a + b, 0) / frtSamples.length : undefined;
  const medianFrtMinutes = median(frtSamples);

  // RT/ART = "매니저 답변 횟수 기준 평균 응대 간격" — 세션의 영업시간 기준 소요시간(오픈~종료)을
  // 그 세션의 매니저 답변 횟수로 나눈 값(세션 내 응답이 균등 간격으로 이뤄진다고 가정한 근사치)의 전체 평균.
  const artSamples: number[] = [];
  knownChatRows.forEach(r => {
    const open = parseDT(r.chatOpenedAt);
    const closed = parseDT(r.chatClosedAt);
    if (open && closed && closed.getTime() >= open.getTime() && r.managerReplyCount && r.managerReplyCount > 0) {
      artSamples.push(businessMinutesBetween(open, closed, holidays) / r.managerReplyCount);
    }
  });
  const avgArtMinutes = artSamples.length > 0 ? artSamples.reduce((a, b) => a + b, 0) / artSamples.length : undefined;
  const medianArtMinutes = median(artSamples);

  const channelMix: ChatRoomSummary["channelMix"] = [
    { label: "채팅", count: chatRows.length, pct: totalInquiries > 0 ? (chatRows.length / totalInquiries) * 100 : 0 },
    { label: "전화", count: phoneRows.length, pct: totalInquiries > 0 ? (phoneRows.length / totalInquiries) * 100 : 0 },
  ];

  const phoneTotal = phoneRows.length;
  const phoneMissedRatePct = phoneTotal > 0 ? (phoneMissed.length / phoneTotal) * 100 : 0;

  const missedReasonCounts = new Map<string, number>();
  phoneMissed.forEach(r => {
    const reason = r.missedReason || "미기재";
    missedReasonCounts.set(reason, (missedReasonCounts.get(reason) || 0) + 1);
  });
  const missedReasonBreakdown = Array.from(missedReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalInquiries,
    chatCount: chatRows.length,
    callCount: phoneRows.length,
    botHandledCount,
    botHandledRatePct,
    activeUnknownCount,
    humanInquiries,
    answeredCount,
    responseRatePct,
    avgFrtMinutes,
    medianFrtMinutes,
    frtSampleSize: frtSamples.length,
    avgArtMinutes,
    medianArtMinutes,
    artSampleSize: artSamples.length,
    channelMix,
    phoneTotal,
    phoneMissedCount: phoneMissed.length,
    phoneMissedRatePct,
    missedReasonBreakdown,
  };
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export interface HourlyBottleneckCell {
  weekday: number; // 0=일 .. 6=토
  weekdayLabel: string;
  hour: number; // 0~23
  count: number;
  avgFrtMinutes?: number;
  operatingCount: number;
  nonOperatingCount: number;
}

// 요일×시간대 문의량/FRT 병목 히트맵. 이벤트 시각은 채팅은 "유저챗 처음 오픈된 시간", 전화는
// "챗봇 생성 시간"(응대/부재중 무관하게 항상 채워지는 통화 시도 시각) 기준.
export function computeHourlyBottleneck(chatRooms: ChatRoom[], holidays: HolidaySet): HourlyBottleneckCell[] {
  interface Bucket { count: number; frtSum: number; frtCount: number; operating: number; nonOperating: number; }
  const buckets = new Map<string, Bucket>();

  chatRooms.forEach(r => {
    const eventTime = parseDT(r.category === "채팅" ? r.chatOpenedAt : r.chatbotCreatedAt);
    if (!eventTime) return;
    const weekday = eventTime.getDay();
    const hour = eventTime.getHours();
    const bkey = `${weekday}-${hour}`;
    let bucket = buckets.get(bkey);
    if (!bucket) {
      bucket = { count: 0, frtSum: 0, frtCount: 0, operating: 0, nonOperating: 0 };
      buckets.set(bkey, bucket);
    }
    bucket.count += 1;
    if (r.operationStatus === "운영중") bucket.operating += 1;
    else if (r.operationStatus === "비운영중") bucket.nonOperating += 1;

    if (r.category === "채팅" && r.firstManagerReplyAt) {
      const open = parseDT(r.chatOpenedAt);
      const reply = parseDT(r.firstManagerReplyAt);
      if (open && reply && reply.getTime() >= open.getTime()) {
        bucket.frtSum += businessMinutesBetween(open, reply, holidays);
        bucket.frtCount += 1;
      }
    }
  });

  const cells: HourlyBottleneckCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const bucket = buckets.get(`${weekday}-${hour}`);
      cells.push({
        weekday,
        weekdayLabel: WEEKDAY_LABELS[weekday],
        hour,
        count: bucket?.count || 0,
        avgFrtMinutes: bucket && bucket.frtCount > 0 ? bucket.frtSum / bucket.frtCount : undefined,
        operatingCount: bucket?.operating || 0,
        nonOperatingCount: bucket?.nonOperating || 0,
      });
    }
  }
  return cells;
}

export interface ChannelTrendPoint {
  date: string; // YYYY-MM-DD
  채팅: number;
  콜: number;
}

// "채널별 문의량 추이" — 챗/콜 2종 일별 건수. 이벤트 시각은 히트맵과 동일 기준(채팅=오픈시간, 전화=챗봇생성시간).
export function computeChannelTrendByDay(chatRooms: ChatRoom[]): ChannelTrendPoint[] {
  const map = new Map<string, { 채팅: number; 콜: number }>();
  chatRooms.forEach(r => {
    const eventTime = parseDT(r.category === "채팅" ? r.chatOpenedAt : r.chatbotCreatedAt);
    if (!eventTime) return;
    const dateKey = formatYmdLocal(eventTime);
    let entry = map.get(dateKey);
    if (!entry) { entry = { 채팅: 0, 콜: 0 }; map.set(dateKey, entry); }
    if (r.category === "채팅") entry.채팅 += 1;
    else entry.콜 += 1;
  });
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface FrtArtTrendPoint {
  date: string; // YYYY-MM-DD
  avgFrtMinutes?: number;
  avgArtMinutes?: number;
}

// "FRT/RT/ART 추이선" — 채팅 세션의 오픈일 기준 일별 평균 FRT/ART. 둘 다 "분" 단위라 축 1개 공유.
export function computeFrtArtTrend(chatRooms: ChatRoom[], holidays: HolidaySet): FrtArtTrendPoint[] {
  interface Acc { frtSum: number; frtCount: number; artSum: number; artCount: number; }
  const map = new Map<string, Acc>();

  chatRooms.filter(r => r.category === "채팅").forEach(r => {
    const open = parseDT(r.chatOpenedAt);
    if (!open) return;
    const dateKey = formatYmdLocal(open);
    let entry = map.get(dateKey);
    if (!entry) { entry = { frtSum: 0, frtCount: 0, artSum: 0, artCount: 0 }; map.set(dateKey, entry); }

    const reply = parseDT(r.firstManagerReplyAt);
    if (reply && reply.getTime() >= open.getTime()) {
      entry.frtSum += businessMinutesBetween(open, reply, holidays);
      entry.frtCount += 1;
    }
    const closed = parseDT(r.chatClosedAt);
    if (closed && closed.getTime() >= open.getTime() && r.managerReplyCount && r.managerReplyCount > 0) {
      entry.artSum += businessMinutesBetween(open, closed, holidays) / r.managerReplyCount;
      entry.artCount += 1;
    }
  });

  return Array.from(map.entries())
    .map(([date, v]) => ({
      date,
      avgFrtMinutes: v.frtCount > 0 ? v.frtSum / v.frtCount : undefined,
      avgArtMinutes: v.artCount > 0 ? v.artSum / v.artCount : undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Part C — CPO% + 통합 채널 믹스 (챗/콜/사고접수/플라워고 4종)
// ============================================================================

export interface ChannelMixAndCpo {
  month?: string;
  chatCount: number;
  callCount: number;
  incidentCount: number; // ProblemForm 중 importChannel === "일반"(미기재 포함, 하위호환)
  flowergoIncidentCount: number; // ProblemForm 중 importChannel === "플라워고"
  totalIssues: number;
  orderCount: number;
  cpoPct: number; // totalIssues / orderCount × 100
  channelMix: { label: "챗" | "콜" | "사고접수" | "플라워고"; count: number; pct: number }[];
}

// month("YYYY-MM")를 넘기면 그 달로 스코프를 좁히고, 생략하면 전체 기간 합계.
export function computeChannelMixAndCPO(
  chatRooms: ChatRoom[],
  problemForms: ProblemForm[],
  orderItems: OrderItem[],
  month?: string
): ChannelMixAndCpo {
  const chatRoomsInScope = month
    ? chatRooms.filter(r => monthKeyOfFlexible(r.category === "채팅" ? r.chatOpenedAt : r.chatbotCreatedAt) === month)
    : chatRooms;
  const problemFormsInScope = month
    ? problemForms.filter(p => monthKeyOfFlexible(p.receivedDate) === month)
    : problemForms;
  const orderItemsInScope = (month
    ? orderItems.filter(o => !o.isReshipCost && monthKeyOfFlexible(o.paymentDate) === month)
    : orderItems.filter(o => !o.isReshipCost));

  const chatCount = chatRoomsInScope.filter(r => r.category === "채팅").length;
  const callCount = chatRoomsInScope.filter(r => isPhoneCategory(r.category)).length;
  const incidentCount = problemFormsInScope.filter(p => (p.importChannel || "일반") === "일반").length;
  const flowergoIncidentCount = problemFormsInScope.filter(p => p.importChannel === "플라워고").length;
  const totalIssues = chatCount + callCount + incidentCount + flowergoIncidentCount;
  const orderCount = orderItemsInScope.length;
  const cpoPct = orderCount > 0 ? (totalIssues / orderCount) * 100 : 0;

  const pct = (n: number) => (totalIssues > 0 ? (n / totalIssues) * 100 : 0);
  const channelMix: ChannelMixAndCpo["channelMix"] = [
    { label: "챗", count: chatCount, pct: pct(chatCount) },
    { label: "콜", count: callCount, pct: pct(callCount) },
    { label: "사고접수", count: incidentCount, pct: pct(incidentCount) },
    { label: "플라워고", count: flowergoIncidentCount, pct: pct(flowergoIncidentCount) },
  ];

  return { month, chatCount, callCount, incidentCount, flowergoIncidentCount, totalIssues, orderCount, cpoPct, channelMix };
}

export interface ChannelMixTrendPoint {
  month: string; // YYYY-MM
  label: string; // "8월"
  totalIssues: number;
  mix: { 챗: number; 콜: number; 사고접수: number; 플라워고: number }; // 비중 %
  counts: { 챗: number; 콜: number; 사고접수: number; 플라워고: number }; // 건수
}

// "채널 믹스 추이" 아코디언(월별 100% 누적 막대)용 — 데이터가 존재하는 모든 월에 대해
// computeChannelMixAndCPO를 재사용해 월별 시리즈로 만든다.
export function computeChannelMixTrendByMonth(
  chatRooms: ChatRoom[],
  problemForms: ProblemForm[],
  orderItems: OrderItem[]
): ChannelMixTrendPoint[] {
  const months = new Set<string>();
  chatRooms.forEach(r => {
    const key = monthKeyOfFlexible(r.category === "채팅" ? r.chatOpenedAt : r.chatbotCreatedAt);
    if (key) months.add(key);
  });
  problemForms.forEach(p => {
    const key = monthKeyOfFlexible(p.receivedDate);
    if (key) months.add(key);
  });

  return Array.from(months).sort().map(month => {
    const result = computeChannelMixAndCPO(chatRooms, problemForms, orderItems, month);
    const mm = Number(month.split("-")[1]);
    const find = (label: string) => result.channelMix.find(m => m.label === label);
    return {
      month,
      label: `${mm}월`,
      totalIssues: result.totalIssues,
      mix: {
        챗: find("챗")?.pct || 0,
        콜: find("콜")?.pct || 0,
        사고접수: find("사고접수")?.pct || 0,
        플라워고: find("플라워고")?.pct || 0,
      },
      counts: {
        챗: result.chatCount,
        콜: result.callCount,
        사고접수: result.incidentCount,
        플라워고: result.flowergoIncidentCount,
      },
    };
  });
}

// ============================================================================
// Part D — 2026년 예측 지표
//
// 시트 셀 수식을 직접 열어보지 못해, 1~7월 실측 입력값과 시트에 찍힌 예상값을 대조하는 방식으로
// 역산 확정했다(7개월 전부 소수점 오차 없이 일치 확인됨). ×1.5 배수의 업무적 의미는 불명이지만
// 구현에는 지장 없음 — 절대 임의로 바꾸지 말 것(바꾸면 실측 대조가 깨짐).
// ============================================================================

const MONTHLY_FORECAST_MULTIPLIER = 1.5;
const FORECAST_DAYS_PER_MONTH = 30; // 그 달 실제 일수(28~31)가 아니라 고정 30 — 실측 대조로 확인됨

export interface Forecast2026 {
  month?: string;
  label?: string;
  totalIssuesActual: number; // 그 달 실측 총 CS 이슈량(챗+콜+사고접수+플라워고)
  orderCount: number;
  monthlyAvgInquiries: number; // 26년 월 평균 문의량 예상 = 실측 총이슈량 × 1.5
  dailyAvgInquiries: number; // 26년 일평균 문의량 예상 = round(월평균문의량 / 30)
  cpoForecastPct: number; // 26년 cpo 예상 = 월평균문의량 / 주문건수 × 100
  monthlyCsLaborCostAllocationKrw: number; // 건당코스트예상 계산에 쓰인 그 시점의 월 CS 인건비 배분 추정치
  costPerInquiryForecast?: number; // 26년 예상 건당 코스트 = 월 CS 인건비 배분 추정치 / 월평균문의량
}

// 옛 시트 MONTHLY 탭 23행 수식을 C~I열(1~7월) 전부 직접 열어 확인한 결과, 분자가 7개월 내내 완전히
// 동일한 하드코딩 상수(2,000,000원)였다 — 월별로 변하는 실측 CS비용이 아니었다. 사용자 확인(2026-08-23):
// "인건비겠지... CS말고도 다른 업무가 많아서 대략적으로 200만원 정도 넣어서 인건비 넣은듯", "배분은
// 임의대로 하는 거지 정확하지는 않아 200이면 합리적으로 보이긴 함" — 즉 CS 전담이 아닌 담당자의
// 인건비 중 CS 업무 배분분을 주관적으로 추산한 근사치이지, 실측값이 아니다. (참고: 어드민의 "CS 비용
// 다운로드" export는 이것과 무관하다 — 실제로 열어보면 그 값은 `가격 × 사고 처리 비율 %`, 즉 이미
// ProblemForm/OrderItem으로 추적 중인 환불금액의 재계산 사본일 뿐, 인건비 요소가 전혀 없다.)
// 정밀 계산값이 아니라 주관적 배분 추정치라 시간이 지나면(인건비 인상, 업무 비중 변화) 또 바뀔 수
// 있으므로, 시트처럼 코드에 리터럴로 박아넣지 않고 ReviewsContext에 사용자가 수정 가능한 값으로 둔다.
export const DEFAULT_MONTHLY_CS_LABOR_COST_ALLOCATION_KRW = 2_000_000;

// month("YYYY-MM")를 생략하면 전체 기간 합계 기준.
export function compute2026Forecast(
  chatRooms: ChatRoom[],
  problemForms: ProblemForm[],
  orderItems: OrderItem[],
  monthlyCsLaborCostAllocationKrw: number,
  month?: string
): Forecast2026 {
  const mix = computeChannelMixAndCPO(chatRooms, problemForms, orderItems, month);
  const monthlyAvgInquiries = mix.totalIssues * MONTHLY_FORECAST_MULTIPLIER;
  const dailyAvgInquiries = Math.round(monthlyAvgInquiries / FORECAST_DAYS_PER_MONTH);
  const cpoForecastPct = mix.orderCount > 0 ? (monthlyAvgInquiries / mix.orderCount) * 100 : 0;
  const costPerInquiryForecast = monthlyAvgInquiries > 0
    ? monthlyCsLaborCostAllocationKrw / monthlyAvgInquiries
    : undefined;

  return {
    month,
    label: month ? `${Number(month.split("-")[1])}월` : undefined,
    totalIssuesActual: mix.totalIssues,
    orderCount: mix.orderCount,
    monthlyAvgInquiries,
    dailyAvgInquiries,
    cpoForecastPct,
    monthlyCsLaborCostAllocationKrw,
    costPerInquiryForecast,
  };
}

// "2026년 예측" 아코디언의 월별 sparkline/미니테이블용 — 데이터가 존재하는 모든 월에 대해 계산.
export function compute2026ForecastTrendByMonth(
  chatRooms: ChatRoom[],
  problemForms: ProblemForm[],
  orderItems: OrderItem[],
  monthlyCsLaborCostAllocationKrw: number
): Forecast2026[] {
  const months = new Set<string>();
  chatRooms.forEach(r => {
    const key = monthKeyOfFlexible(r.category === "채팅" ? r.chatOpenedAt : r.chatbotCreatedAt);
    if (key) months.add(key);
  });
  problemForms.forEach(p => {
    const key = monthKeyOfFlexible(p.receivedDate);
    if (key) months.add(key);
  });

  return Array.from(months).sort().map(month =>
    compute2026Forecast(chatRooms, problemForms, orderItems, monthlyCsLaborCostAllocationKrw, month)
  );
}
