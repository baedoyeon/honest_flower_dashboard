import { XCircle } from "lucide-react";

// 5개 CSV 임포터(Review/Incident/OrderItem/ProblemForm/ChatRoom) 공용 — 핵심 컬럼이 하나도 안 잡혔을 때
// (parseCSVTo*의 isLikelyWrongFileType) 조용히 0건 처리 대신 화면에 명확하게 띄우는 경고.
// 어드민에 이름이 비슷한 export 버튼이 여러 개 있어(예: 사고접수 "내보내기" vs "CS 비용 다운로드")
// 실제로 다른 종류의 CSV를 잘못 올리는 사고가 반복됐기 때문에, 기존의 부드러운 "일부 컬럼 인식 못함"
// 경고(missingCriticalColumns)와 구분되는 더 강한 표시가 필요하다.
export default function SchemaMismatchError({ detectedColumns, guidance }: { detectedColumns: string[]; guidance: string }) {
  return (
    <div className="rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 flex items-start gap-2.5">
      <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="text-xs text-rose-900 leading-relaxed space-y-1.5">
        <p className="font-extrabold">이 CSV는 이 업로드 칸의 형식이 아닌 것 같습니다 — 필수 컬럼이 하나도 인식되지 않았습니다.</p>
        <p>
          <span className="font-bold">감지된 컬럼:</span>{" "}
          <span className="font-mono">{detectedColumns.length > 0 ? detectedColumns.join(", ") : "(헤더를 인식하지 못함)"}</span>
        </p>
        <p>{guidance}</p>
      </div>
    </div>
  );
}
