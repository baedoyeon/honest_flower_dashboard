#!/usr/bin/env node
// ============================================================================
// 정합성 감사 스크립트 — 대시보드 앱 코드(claimCostEngine.ts, csvParser.ts)를
// 전혀 재사용하지 않는다. 목적 자체가 "같은 코드로 같은 실수를 반복하는지"를
// 잡아내는 거라서, 여기 로직은 일부러 단순하고 짧게 유지한다 — 이 파일 하나를
// 처음부터 끝까지 읽고 "이 계산이 맞다"를 직접 판단할 수 있어야 의미가 있다.
//
// 사용법:
//   node scripts/audit_consistency.mjs \
//     --orderitem ~/Downloads/orderitem_XXXX.csv \
//     --problemform ~/Downloads/problemform_XXXX.csv \
//     --review ~/Downloads/review_XXXX.csv
//
// 세 파일 다 줄 필요는 없다 — 준 파일에 대한 체크만 실행된다.
// 외부 npm 패키지 의존성 없음 (fs만 사용) — 아무 컴퓨터에서나 그냥 실행 가능.
// ============================================================================

import fs from "fs";

// ---------------------------------------------------------------------------
// 1. CSV 파싱 — 따옴표/개행 안전 처리. 앱의 parseCSVRows와 별개로 새로 짠 것.
// ---------------------------------------------------------------------------
function parseCSVRows(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur.trim()); cur = ""; }
      else if (c === "\r") { if (n === "\n") i++; row.push(cur.trim()); if (row.some(x => x.length)) rows.push(row); row = []; cur = ""; }
      else if (c === "\n") { row.push(cur.trim()); if (row.some(x => x.length)) rows.push(row); row = []; cur = ""; }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur.trim()); if (row.some(x => x.length)) rows.push(row); }
  return rows;
}

function loadCSV(path) {
  const text = fs.readFileSync(path, "utf8");
  const rows = parseCSVRows(text);
  const header = rows[0].map(h => h.replace(/^﻿/, "").trim());
  return { header, dataRows: rows.slice(1) };
}

// 헤더에서 컬럼 인덱스를 하나 찾는다. 후보 이름을 순서대로 시도하고, 어떤 걸로
// 찾았는지 콘솔에 그대로 찍는다 — "엉뚱한 컬럼을 잡았는데 조용히 넘어가는" 사고를
// 막으려면, 이 감사 스크립트 자체가 자기가 뭘 골랐는지 숨기면 안 된다.
function findCol(header, ...candidates) {
  for (const cand of candidates) {
    const idx = header.findIndex(h => h === cand);
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = header.findIndex(h => h.includes(cand));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseMoney(raw) {
  if (!raw) return NaN;
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? NaN : n;
}

function normDate(raw) {
  const m = String(raw || "").match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : "";
}

// 실제 ARES 어드민 export의 주문번호 값엔 Excel 텍스트 강제용 래퍼(="...")가 붙어있다
// (예: ="26082617877060760-1"). CSV 자체의 따옴표 문법이 아니라 셀 내용 그 자체라서
// parseCSVRows로는 안 벗겨진다 — 조인 키 비교 전엔 반드시 이걸 벗겨야 한다.
function stripExcelWrapper(v) {
  return String(v || "").replace(/^="|"$/g, "").trim();
}

// ---------------------------------------------------------------------------
// 리포트 출력 헬퍼 — PASS/WARN/INFO만 쓴다. FAIL 판정은 일부러 안 한다:
// 뭐가 "정답"인지는 이 스크립트가 아니라 사람이 최종 판단해야 한다.
// ---------------------------------------------------------------------------
let warnCount = 0;
function pass(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { warnCount++; console.log(`  ⚠️  ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function section(title) { console.log(`\n=== ${title} ===`); }

// ---------------------------------------------------------------------------
// 2. 공통 체크: 파일 구조 무결성 — 행마다 컬럼 개수가 헤더랑 같은가.
// (따옴표 이스케이프 깨짐 → 컬럼 밀림 사고를 잡는다. 이게 제일 흔하고 위험한
// 종류의 CSV 사고다 — 밀리면 엉뚱한 값이 엉뚱한 필드에 들어가는데 겉보기엔
// 멀쩡해 보인다.)
// ---------------------------------------------------------------------------
function checkStructuralIntegrity(name, header, dataRows) {
  section(`[${name}] 파일 구조 무결성`);
  const mismatched = dataRows.filter(r => r.length !== header.length);
  if (mismatched.length === 0) {
    pass(`전체 ${dataRows.length}행, 컬럼 개수 불일치 0건 (따옴표 escape 깨짐 없음)`);
  } else {
    warn(`${mismatched.length}행이 헤더(${header.length}개 컬럼)와 다른 컬럼 개수를 가짐 — 이 행들은 컬럼이 밀렸을 가능성이 높음`);
    info(`샘플 첫 행: ${JSON.stringify(mismatched[0].slice(0, 5))}...`);
  }
}

// ---------------------------------------------------------------------------
// 3. 소수점 파싱 라운드트립 체크 — "10배 부풀려짐" 버그 재발 방지용 일반 체크.
// 원본 문자열에 "."이 있는데 숫자만 남기고 지워버리면 값이 왜곡된다.
// 이 체크는 그 왜곡이 실제로 일어나는 컬럼이 있는지 일반적으로 찾아낸다 —
// 특정 버그를 아는 게 아니라 "이 클래스의 버그가 또 있는가"를 묻는다.
// ---------------------------------------------------------------------------
function checkDecimalRoundTrip(name, header, dataRows, colIndicesToCheck) {
  section(`[${name}] 소수점 파싱 안전성 (10배 부풀림류 버그 재발 체크)`);
  for (const [label, idx] of colIndicesToCheck) {
    if (idx === -1) { info(`"${label}" 컬럼을 못 찾음 — 건너뜀`); continue; }
    let decimalCount = 0;
    let corruptionExamples = [];
    dataRows.forEach(r => {
      const raw = r[idx];
      if (!raw || !raw.includes(".")) return;
      decimalCount++;
      const naiveDigitsOnly = Number(raw.replace(/[^0-9]/g, "")); // 옛날 버그가 하던 방식
      const correct = parseMoney(raw); // 소수점 보존 파싱
      if (!isNaN(naiveDigitsOnly) && !isNaN(correct) && naiveDigitsOnly !== correct) {
        corruptionExamples.push({ raw, naiveDigitsOnly, correct });
      }
    });
    if (decimalCount === 0) {
      info(`"${label}": 소수점 포함 값 0건 — 이 컬럼은 현재 정수 포맷만 사용 중 (안전)`);
    } else if (corruptionExamples.length === 0) {
      pass(`"${label}": 소수점 포함 값 ${decimalCount}건, 전부 파싱 정상`);
    } else {
      warn(`"${label}": 소수점 포함 값 ${decimalCount}건 중 ${corruptionExamples.length}건에서 "숫자만 남기고 파싱"하면 값이 달라짐 (예: "${corruptionExamples[0].raw}" → 잘못 파싱시 ${corruptionExamples[0].naiveDigitsOnly}, 올바르게는 ${corruptionExamples[0].correct}) — 실제 앱 파서가 지금 올바른 쪽으로 파싱하는지 src/utils/csvParser.ts를 확인할 것`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. ProblemForm → OrderItem 조인율 — "이 사고접수 건이 어느 주문에 해당하는지
// 실제로 몇 %나 찾을 수 있는가"를 정직하게 보여준다. 조인 실패율이 높으면
// 클레임비용/재발송비용 계산이 그만큼 과소집계될 수밖에 없다.
// ---------------------------------------------------------------------------
function checkProblemFormJoinRate(pfHeader, pfRows, oiHeader, oiRows) {
  section("ProblemForm ↔ OrderItem 조인율");
  const colPfOrderRef = findCol(pfHeader, "주문번호", "그룹주문번호");
  const colOiOrderNum = findCol(oiHeader, "주문번호");
  if (colPfOrderRef === -1 || colOiOrderNum === -1) {
    warn("주문번호 컬럼을 양쪽에서 못 찾음 — 조인율 체크 스킵");
    return;
  }
  const orderNumberSet = new Set(oiRows.map(r => stripExcelWrapper(r[colOiOrderNum])).filter(Boolean));
  let matched = 0, total = 0;
  pfRows.forEach(r => {
    const ref = stripExcelWrapper(r[colPfOrderRef]);
    if (!ref) return;
    total++;
    if (orderNumberSet.has(ref)) matched++;
  });
  const rate = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0;
  if (total === 0) {
    warn("주문번호가 있는 ProblemForm 행이 0건");
  } else if (rate >= 95) {
    pass(`${total}건 중 ${matched}건 조인 성공 (${rate}%)`);
  } else {
    warn(`${total}건 중 ${matched}건만 조인 성공 (${rate}%) — 나머지 ${total - matched}건은 어느 주문/상품인지 알 수 없어 클레임비용 계산에서 누락되고 있을 가능성. OrderItem CSV가 해당 기간을 다 커버하는지 확인할 것`);
  }
}

// ---------------------------------------------------------------------------
// 5. 재발송비용 합계 재현 — "부분합을 다 더하면 전체합이랑 같아야 한다"는
// 제일 기본적인 산수 불변식. 이게 깨지면 어딘가에서 행이 누락되거나 이중계산되고
// 있다는 뜻이다 (실제로 이 앱에서 과거에 발견된 적 있는 종류의 불일치).
// ---------------------------------------------------------------------------
function checkReshipCostReconciliation(oiHeader, oiRows) {
  section("재발송비용 합계 재현 (부분합 = 전체합 검증)");
  const colOrderNum = findCol(oiHeader, "주문번호");
  const colProduct = findCol(oiHeader, "상품 상세 명", "상품");
  const colSettlement = findCol(oiHeader, "정산 가격");
  if ([colOrderNum, colProduct, colSettlement].includes(-1)) {
    warn("필요한 컬럼(주문번호/상품명/정산가격)을 못 찾음 — 스킵");
    return;
  }
  const reshipRows = oiRows.filter(r => (r[colOrderNum] || "").includes("-CS"));
  const overallTotal = reshipRows.reduce((sum, r) => sum + (parseMoney(r[colSettlement]) || 0), 0);
  const byProduct = new Map();
  reshipRows.forEach(r => {
    const p = r[colProduct] || "(상품명 없음)";
    byProduct.set(p, (byProduct.get(p) || 0) + (parseMoney(r[colSettlement]) || 0));
  });
  const sumOfParts = Array.from(byProduct.values()).reduce((a, b) => a + b, 0);
  const diff = Math.round(overallTotal - sumOfParts);
  info(`재발송(-CS) 행 ${reshipRows.length}건, 전체 합계 ₩${Math.round(overallTotal).toLocaleString()}`);
  if (Math.abs(diff) < 1) {
    pass("상품별 부분합을 다 더한 값이 전체 합계와 정확히 일치");
  } else {
    warn(`상품별 부분합 합계(₩${Math.round(sumOfParts).toLocaleString()})가 전체 합계와 ₩${diff.toLocaleString()} 차이남 — 상품명이 비어있거나 그룹 분배 로직에서 일부 금액이 어디에도 안 잡히고 있을 가능성`);
  }
}

// ---------------------------------------------------------------------------
// 6. 리뷰 rating vs 감정 키워드 불일치 — 참고용 휴리스틱. 이건 "정답"이 아니라
// "사람이 직접 눈으로 봐야 할 후보 목록"을 좁혀주는 용도다. 오탐(false positive)이
// 당연히 섞여있으니 이 리스트에 뜬 것 = 버그 라고 단정하면 안 된다.
// ---------------------------------------------------------------------------
function checkReviewRatingSentimentOutliers(header, dataRows) {
  section("리뷰 rating vs 텍스트 감정 불일치 후보 (참고용, 사람이 최종 판단)");
  const colRating = findCol(header, "총점", "평점", "별점");
  const colContent = findCol(header, "내용", "리뷰");
  const colProduct = findCol(header, "상품");
  const colId = findCol(header, "id");
  if (colRating === -1 || colContent === -1) {
    warn("총점/내용 컬럼을 못 찾음 — 스킵");
    return;
  }
  const POS = ["좋아", "만족", "예뻐", "이뻐", "감사", "최고", "행복", "싱싱", "풍성", "완벽", "추천해요", "재구매"];
  const NEG = ["별로", "최악", "불만", "환불", "시들", "파손", "부러", "상함", "속상", "아쉽", "안좋"];

  const lowRatingPositiveText = [];
  const highRatingNegativeText = [];
  dataRows.forEach(r => {
    const rating = Number(r[colRating]);
    const text = r[colContent] || "";
    if (isNaN(rating) || rating <= 0) return;
    const hasPos = POS.some(w => text.includes(w));
    const hasNeg = NEG.some(w => text.includes(w));
    if (rating <= 1 && hasPos && !hasNeg) {
      lowRatingPositiveText.push({ id: colId !== -1 ? r[colId] : "?", product: colProduct !== -1 ? r[colProduct] : "?", text: text.slice(0, 80) });
    }
    if (rating >= 4 && hasNeg && !hasPos) {
      highRatingNegativeText.push({ id: colId !== -1 ? r[colId] : "?", product: colProduct !== -1 ? r[colProduct] : "?", text: text.slice(0, 80) });
    }
  });

  if (lowRatingPositiveText.length === 0 && highRatingNegativeText.length === 0) {
    pass("rating과 텍스트 감정이 뚜렷하게 어긋나는 후보 없음");
  } else {
    if (lowRatingPositiveText.length > 0) {
      warn(`1점인데 긍정적 키워드만 있는 리뷰 ${lowRatingPositiveText.length}건 (사람이 직접 확인 필요):`);
      lowRatingPositiveText.slice(0, 10).forEach(x => console.log(`      [${x.id}] ${x.product}: ${x.text}`));
    }
    if (highRatingNegativeText.length > 0) {
      warn(`4~5점인데 부정적 키워드만 있는 리뷰 ${highRatingNegativeText.length}건 (사람이 직접 확인 필요):`);
      highRatingNegativeText.slice(0, 10).forEach(x => console.log(`      [${x.id}] ${x.product}: ${x.text}`));
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const orderItemPath = getArg("orderitem");
const problemFormPath = getArg("problemform");
const reviewPath = getArg("review");

if (!orderItemPath && !problemFormPath && !reviewPath) {
  console.log(`사용법: node scripts/audit_consistency.mjs --orderitem <path> --problemform <path> --review <path>`);
  console.log(`(세 개 다 줄 필요 없음 — 준 파일에 대한 체크만 실행됨)`);
  process.exit(1);
}

console.log("정합성 감사 스크립트 — 대시보드 앱 코드와 무관하게 독립적으로 재계산합니다.\n");

let oi = null, pf = null, rv = null;

if (orderItemPath) {
  oi = loadCSV(orderItemPath);
  checkStructuralIntegrity("OrderItem", oi.header, oi.dataRows);
  checkDecimalRoundTrip("OrderItem", oi.header, oi.dataRows, [
    ["정산 가격", findCol(oi.header, "정산 가격")],
    ["가격", findCol(oi.header, "가격")],
    ["환불금액", findCol(oi.header, "환불금액")],
  ]);
}

if (problemFormPath) {
  pf = loadCSV(problemFormPath);
  checkStructuralIntegrity("ProblemForm", pf.header, pf.dataRows);
  checkDecimalRoundTrip("ProblemForm", pf.header, pf.dataRows, [
    ["환불 금액", findCol(pf.header, "환불 금액")],
  ]);
}

if (reviewPath) {
  rv = loadCSV(reviewPath);
  checkStructuralIntegrity("Review", rv.header, rv.dataRows);
  checkReviewRatingSentimentOutliers(rv.header, rv.dataRows);
}

if (oi && pf) {
  checkProblemFormJoinRate(pf.header, pf.dataRows, oi.header, oi.dataRows);
  checkReshipCostReconciliation(oi.header, oi.dataRows);
}

console.log(`\n${warnCount === 0 ? "✅ 전부 통과 — 경고 없음" : `⚠️  총 ${warnCount}건의 경고 — 위 항목들을 직접 확인해보세요`}`);
