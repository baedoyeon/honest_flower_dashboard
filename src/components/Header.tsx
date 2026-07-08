import { ClipboardCheck, Calendar, FileText, RefreshCw, Cloud, AlertCircle } from "lucide-react";
import { useReviews } from "../context/ReviewsContext";

// Helper: Get current date in KST (YYYY.MM.DD)
function getKSTDateString(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (3600000 * 9));
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, "0");
  const dd = String(kst.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export default function Header() {
  const { weeklyReviews, isUsingLocalData, refreshData, isSyncing } = useReviews();
  const todayStr = getKSTDateString();

  return (
    <header className="bg-white border-b border-slate-200 shrink-0">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Elegant brand logo mark from design */}
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-100">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <div>
              {/* Brand Category Badge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  CS & QUALITY VOC REPORT
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <ClipboardCheck className="h-3.5 w-3.5 text-slate-400" /> 전사 공유 위클리 리포트
                </span>
              </div>
              
              {/* Main Title */}
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                어니스트플라워 위클리 후기 모니터링
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
            {/* Firebase connection status badge */}
            {isUsingLocalData ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl font-bold">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                로컬 데이터뷰 (임시)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl font-bold">
                <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                파이어베이스 실시간 연동 중
              </span>
            )}

            {/* Manual refresh button */}
            <button
              onClick={() => refreshData()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold shadow-xs transition duration-200 cursor-pointer disabled:opacity-50"
              title="파이어베이스에서 최신 데이터를 새로 가져옵니다."
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isSyncing ? "animate-spin text-blue-600" : ""}`} />
              데이터 새로고침
            </button>

            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> 
              {todayStr} 기준
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-2xl font-bold">
              <FileText className="h-3.5 w-3.5 text-blue-500" /> 
              사진 후기 {weeklyReviews.length}건 분석
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

