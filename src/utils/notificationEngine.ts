import { Review } from "../data/classifiedReviews";
import { Incident } from "../data/initialIncidents";

export type NotificationType = "review" | "incident";
export type NotificationSeverity = "low" | "medium" | "high";

export interface AppNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  product: string;
  occurredAt: string; // "YYYY.MM.DD"
  targetId: string; // review.id (as string) or incident.id
  read: boolean;
}

// 데이터 출처(CSV 업로드든 향후 실시간 API든)와 무관하게 동작해야 하므로, "새로 반영된 것"의 판단
// 기준은 CSV 업로드 시각이 아니라 이전에 관측했던 review id 집합 / incident id별 상태값과의 diff다.
// generateNotifications를 호출할 때마다 이 snapshot을 최신 상태로 갱신해 다음 호출에서 같은 항목이
// "새로운 것"으로 다시 잡히지 않게 한다(= 이미 확인한 시점 이후 변경분만 알림).
export interface NotificationSnapshot {
  knownNegativeReviewIds: number[];
  incidentStatusById: Record<string, string>;
}

export const EMPTY_NOTIFICATION_SNAPSHOT: NotificationSnapshot = {
  knownNegativeReviewIds: [],
  incidentStatusById: {},
};

export function generateNotifications(
  reviews: Review[],
  incidents: Incident[],
  prevSnapshot: NotificationSnapshot
): { notifications: AppNotification[]; snapshot: NotificationSnapshot } {
  const notifications: AppNotification[] = [];
  const prevReviewIds = new Set(prevSnapshot.knownNegativeReviewIds);
  const prevIncidentStatus = prevSnapshot.incidentStatusById;

  // 리뷰: 새로 반영된 비추천(rating<=2 포함)만 알림. 추천/중립은 알림 없음.
  // exposed === false(CX가 비공개 처리)는 CX가 이미 수동으로 조치를 취했다는 뜻이므로 알릴 필요 없다.
  reviews.forEach(r => {
    const isNegative = r.type === "비추천" || (r.rating > 0 && r.rating <= 2);
    if (!isNegative) return;
    if (prevReviewIds.has(r.id)) return;
    if (r.exposed === false) return;

    notifications.push({
      id: `review-${r.id}`,
      type: "review",
      severity: "medium",
      title: `비추천 리뷰 - ${r.product}`,
      detail: (r.review || "").slice(0, 90),
      product: r.product,
      occurredAt: r.date,
      targetId: String(r.id),
      read: false,
    });
  });

  // 사고접수: 신규 반영된 건은 상태 무관 전부 알림. 기존 건의 상태가 바뀐 경우도 알림.
  incidents.forEach(inc => {
    const prevStatus = prevIncidentStatus[inc.id];
    if (prevStatus === undefined) {
      notifications.push({
        id: `incident-new-${inc.id}`,
        type: "incident",
        severity: inc.incidentStatus === "접수중" ? "high" : "medium",
        title: `신규 사고접수 - ${inc.product}`,
        detail: (inc.claimText || "").slice(0, 90),
        product: inc.product,
        occurredAt: inc.date,
        targetId: inc.id,
        read: false,
      });
    } else if (prevStatus !== inc.incidentStatus) {
      notifications.push({
        id: `incident-status-${inc.id}-${inc.incidentStatus}-${Date.now()}`,
        type: "incident",
        severity: "low",
        title: `사고접수 상태 변경 - ${inc.product}`,
        detail: `${prevStatus} → ${inc.incidentStatus}`,
        product: inc.product,
        occurredAt: inc.date,
        targetId: inc.id,
        read: false,
      });
    }
  });

  const snapshot: NotificationSnapshot = {
    knownNegativeReviewIds: reviews
      .filter(r => r.type === "비추천" || (r.rating > 0 && r.rating <= 2))
      .map(r => r.id),
    incidentStatusById: Object.fromEntries(incidents.map(inc => [inc.id, inc.incidentStatus])),
  };

  return { notifications, snapshot };
}
