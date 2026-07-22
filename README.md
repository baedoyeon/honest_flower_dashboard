# 💐 어니스트플라워 CS & QUALITY VOC REPORT
> 고객 후기 분석 및 조기대응 대시보드
> 실시간 VOC 수집, 상품별 품질/배송 이슈 트래킹, 주간 CS 지표 모니터링을 위한 대시보드 시스템입니다.

---

## 🔗 Live Preview (대시보드 바로가기)
- **배포 뷰어 링크**: [어니스트플라워 VOC 대시보드 접속하기](https://ais-pre-yqgsrdq342kx2cafnbxe7w-616075167331.asia-northeast1.run.app)
*(개발 환경 접근 권한 없이 누구나 접속 가능한 전용 웹 뷰어 링크입니다.)*

---

## 📌 주요 기능 (Key Features)

### 1. 📊 주간 핵심 지표 (Weekly Metrics)
- 주간 전체 리뷰 수, 추천/중립/비추천 비율 및 이슈 리뷰 발생 건수 요약
- 주차별 VOC 변화 추이 차트 시각화

### 2. 🌸 상품별 VOC 현황 (Product Status)
- 꽃 품종/상품별 고객 만족도 및 주요 불만 요인(품질, 배송, 포장 등) 파악
- 주의 필요 상품 및 급증 이슈 품종에 대한 SCM 조기 대응 지원

### 3. 🔍 VOC 유형 상세 분석 (VOC Analysis)
- 분류 가이드 기반 부정/긍정 VOC 패턴 분석
- 키워드 필터링 및 원인별(생화 신선도, 줄기 꺾임, 배송 지연 등) 딥다이브

### 4. 🗂️ 실시간 리뷰 아카이브 (Review Archive)
- Google Cloud Firestore 기반 실시간 리뷰 동기화 (`onSnapshot`)
- 검색, 별점/카테고리 필터링, 이미지 첨부 리뷰 확인 및 신규 리뷰 실시간 반영

---

## 🛠️ 기술 스택 (Tech Stack)

- Frontend: React 18, TypeScript, Vite
- Styling & UI: Tailwind CSS, Lucide React (Icons), Framer Motion
- Data Visualization: Recharts
- Backend & Database: Firebase Firestore (Realtime DB)

---

## 🚀 로컬 개발 환경 실행 방법

```bash
# 1. 클론
git clone https://github.com/사용자명/저장소명.git

# 2. 패키지 설치
npm install

# 3. 개발 서버 실행
npm run dev
