import { rawIncidentsCSV } from "./rawIncidents";
import { parseCSVToIncidents } from "../utils/csvParser";

export interface Incident {
  id: string; // e.g. "INC-001"
  date: string;
  product: string;
  customerName?: string;
  reviewer?: string;
  rawReviewer?: string;
  incidentStatus: "처리완료" | "반려됨" | "접수중";
  accidentType: string;
  accidentDetail: string;
  claimText: string;
  refundAmount?: number;
  image_url?: string;
  orderNumber?: string;
  csResponse?: string;
  // 업로드 시점에 사용자가 지정하는 수집 채널(ProblemForm과 동일 개념) — 없으면(하위호환,
  // 옛 데이터/일반 CS 사고접수) "일반"으로 취급.
  importChannel?: "일반" | "플라워고";
}

// Automatically parse the comprehensive, updated raw incidents CSV (all processed, 0 pending)
export const initialIncidentsData: Incident[] = parseCSVToIncidents(rawIncidentsCSV).incidents;
