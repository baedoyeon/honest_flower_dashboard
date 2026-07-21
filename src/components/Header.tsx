import { Calendar, FileText, RefreshCw, Cloud, AlertCircle } from "lucide-react";
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
          <div className="flex flex-col gap-2">
            {/* Beautiful Honest Flower Trademark Replica from PDF */}
            <div className="flex flex-col justify-center bg-brand-green px-5 py-3.5 rounded-2xl shrink-0 shadow-lg shadow-brand-green/20 text-white select-none transition-transform hover:scale-105 duration-300 w-fit">
              <span className="text-[8px] font-bold tracking-wider opacity-90 leading-none font-sans uppercase">
                Flowers make feel better.
              </span>
              <span className="text-lg font-black tracking-widest uppercase mt-1.5 font-sans leading-none">
                HONEST FLOWER
              </span>
            </div>
            
            {/* Brand Category Badge under the Trademark */}
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-full bg-brand-green-light px-2.5 py-0.5 text-[10px] font-bold text-brand-green-dark uppercase tracking-wider">
                CS & QUALITY VOC REPORT
              </span>
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
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isSyncing ? "animate-spin text-brand-green" : ""}`} />
              데이터 새로고침
            </button>

            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> 
              {todayStr} 기준
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-green-light text-brand-green-dark rounded-2xl font-bold">
              <FileText className="h-3.5 w-3.5 text-brand-green" /> 
              사진 후기 {weeklyReviews.length}건 분석
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

