import { useState } from "react";
import Header from "./components/Header";
import WeeklyMetricsTab from "./components/WeeklyMetricsTab";
import ProductStatusTab from "./components/ProductStatusTab";
import AccidentIncidentsTab from "./components/AccidentIncidentsTab";
import VOCAnaTab from "./components/VOCAnaTab";
import ReviewArchiveTab from "./components/ReviewArchiveTab";
import ClaimCostTab from "./components/ClaimCostTab";
import ActionBoardTab from "./components/ActionBoardTab";
import ChatResponseTab from "./components/ChatResponseTab";
import { BarChart2, Sprout, ShieldAlert, PieChart, Archive, Sparkles, Building2, Calendar, Wallet, ListChecks, Headphones } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReviewsProvider, useReviews } from "./context/ReviewsContext";

export default function App() {
  return (
    <ReviewsProvider>
      <AppContent />
    </ReviewsProvider>
  );
}

function AppContent() {
  const { weekFilter, setWeekFilter, weekRanges, activeTab, setActiveTab, isLoading, actionItems } = useReviews();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-brand-green animate-spin" />
          <p className="text-xs font-bold">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "metrics", label: "주간 핵심 지표", icon: <BarChart2 className="h-4 w-4" /> },
    { id: "products", label: "상품별 현황", icon: <Sprout className="h-4 w-4" /> },
    { id: "incidents", label: "사고접수", icon: <ShieldAlert className="h-4 w-4" /> },
    { id: "actionboard", label: "처리 필요", icon: <ListChecks className="h-4 w-4" /> },
    { id: "csresponse", label: "CS 응대 현황", icon: <Headphones className="h-4 w-4" /> },
    { id: "voc", label: "VOC 카테고리 분석", icon: <PieChart className="h-4 w-4" /> },
    { id: "claimcost", label: "매출/클레임비용", icon: <Wallet className="h-4 w-4" /> },
    { id: "archive", label: "원본 후기 아카이브", icon: <Archive className="h-4 w-4" /> },
  ] as const;

  const filterOptions = [
    { id: "this", label: weekRanges.thisWeek.label },
    { id: "last", label: weekRanges.lastWeek.label },
    { id: "all", label: weekRanges.allPeriod.label },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 antialiased font-sans flex flex-col">
      {/* 1. Header */}
      <Header />

      {/* 2. Main Tab Content Container */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        
        {/* Week Filter Bar */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-green" />
            <span className="text-xs font-black text-slate-800">주차별 VOC 조회 필터</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">월요일 시작 기준</span>
          </div>
          <div className="flex bg-slate-100/70 rounded-2xl p-1 gap-1 self-start sm:self-auto border border-slate-200/40">
            {filterOptions.map((opt) => {
              const isSelected = weekFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setWeekFilter(opt.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-white text-brand-green-dark shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Selection Row - Elegant, clean border bottom & animated indicator */}
        <div className="border-b border-slate-200 bg-white rounded-2xl shadow-sm p-1 flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-bold transition duration-200 cursor-pointer ${
                  isActive 
                    ? "text-brand-green-dark bg-brand-green-light" 
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {/* Active Tab Background Indicator Bar */}
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute left-1.5 right-1.5 bottom-0 h-0.5 bg-brand-green rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === "actionboard" && actionItems.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none">
                    {actionItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Render Screen */}
        <div className="min-h-[450px]">
          <AnimatePresence mode="wait">
            <div key={activeTab}>
              {activeTab === "metrics" && <WeeklyMetricsTab />}
              {activeTab === "products" && <ProductStatusTab />}
              {activeTab === "incidents" && <AccidentIncidentsTab />}
              {activeTab === "actionboard" && <ActionBoardTab />}
              {activeTab === "csresponse" && <ChatResponseTab />}
              {activeTab === "voc" && <VOCAnaTab />}
              {activeTab === "claimcost" && <ClaimCostTab />}
              {activeTab === "archive" && <ReviewArchiveTab />}
            </div>
          </AnimatePresence>
        </div>
      </main>

      {/* 3. Global Dashboard Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center sm:flex sm:items-center sm:justify-between text-xs text-slate-400">
          <p>&copy; 2026 어니스트플라워 (Honest Flower). All rights reserved.</p>
          <div className="mt-2 sm:mt-0 flex justify-center gap-4">
            <span className="flex items-center gap-1 font-semibold text-slate-500">
              <Sparkles className="h-3 w-3 text-brand-green" /> CS & SCM 조기대응시스템
            </span>
            <span>|</span>
            <span className="flex items-center gap-1 font-semibold text-slate-500">
              <Building2 className="h-3 w-3 text-slate-400" /> 전사 품질 공유 대시보드
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
