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
}

// Automatically parse the comprehensive, updated raw incidents CSV (all processed, 0 pending)
export const initialIncidentsData: Incident[] = parseCSVToIncidents(rawIncidentsCSV).incidents;
