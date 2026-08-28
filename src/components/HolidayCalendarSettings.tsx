import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarOff, ChevronDown, ChevronUp, Plus, RotateCcw, X } from "lucide-react";
import { defaultCompanyHolidays } from "../data/companyHolidays";

// 영업시간 필터(월~금 10-17시)가 회사가 실제로 쉰 날까지 정상 영업일로 잘못 계산하지 않도록 하는
// 휴무일 캘린더 설정 — 코드 재배포 없이 여기서 직접 날짜를 추가/삭제할 수 있다(ReviewsContext에
// localStorage로 저장). 연차 몰림/명절/회사 자체 휴무 등 새 휴무일이 생길 때마다 여기서 관리한다.
export default function HolidayCalendarSettings({
  holidays, setHolidays,
}: { holidays: string[]; setHolidays: (dates: string[]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [newDate, setNewDate] = useState("");

  const sortedHolidays = [...holidays].sort();

  const addDate = () => {
    if (!newDate || holidays.includes(newDate)) { setNewDate(""); return; }
    setHolidays([...holidays, newDate].sort());
    setNewDate("");
  };

  const removeDate = (date: string) => {
    setHolidays(holidays.filter(d => d !== date));
  };

  const resetToDefault = () => {
    setHolidays([...defaultCompanyHolidays]);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-800">휴무일 캘린더 설정</span>
          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {holidays.length}일 등록됨
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                평균 FRT/RT·ART 계산의 영업시간(월~금 10-17시) 필터가 이 날짜들을 휴무일로 취급합니다(주말은 이미 자동 제외).
                연차 몰림/명절/회사 자체 휴무가 생기면 여기서 추가해주세요.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                />
                <button
                  onClick={addDate}
                  disabled={!newDate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>추가</span>
                </button>
                <button
                  onClick={resetToDefault}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>기본값으로 초기화</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {sortedHolidays.length === 0 ? (
                  <p className="text-xs text-slate-400">등록된 휴무일이 없습니다.</p>
                ) : (
                  sortedHolidays.map(date => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-700 px-2.5 py-1 text-[11px] font-mono font-bold"
                    >
                      {date}
                      <button
                        onClick={() => removeDate(date)}
                        className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="삭제"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
