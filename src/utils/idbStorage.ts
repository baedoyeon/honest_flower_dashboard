import { openDB, IDBPDatabase } from "idb";

// 대용량 CSV 업로드 데이터(주문/사고접수/리뷰/상담 등)를 localStorage 대신 IndexedDB에 저장한다.
// localStorage는 브라우저당 보통 5~10MB 한도라 1년치 주문 데이터(추정 15MB+)를 못 담고, 한도 초과 시
// 저장이 조용히 실패하는 문제가 있었다(에러를 콘솔에만 찍고 사용자에게 알리지 않음). IndexedDB는
// 보통 수백MB~GB 단위라 이 문제가 없다.
//
// 나중에 실제 백엔드 API 연동 시 이 파일의 idbLoad/idbSave 호출부만 API 호출로 바꾸면 되도록,
// ReviewsContext.tsx 등 호출부는 "키로 불러오기/저장하기"라는 인터페이스만 알고 내부 구현(지금은
// IndexedDB)은 몰라도 되게 분리해뒀다 — localStorage 버전과 동일한 키-값 계약을 유지한 이유.
const DB_NAME = "honestflower_dashboard";
const DB_VERSION = 1;
const STORE_NAME = "kv";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

// 이전 버전(localStorage 저장)에서 쓰던 데이터를 잃어버리지 않도록, 같은 키의 IndexedDB 값이 아직
// 없을 때만 localStorage에 남아있는 값을 1회 옮겨온다(성공하면 localStorage 쪽은 지워 용량 회수).
async function migrateFromLocalStorageOnce<T>(key: string): Promise<T | undefined> {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw) as T;
    localStorage.removeItem(key);
    return parsed;
  } catch (err) {
    console.error(`localStorage → IndexedDB 마이그레이션 오류 (${key}):`, err);
    return undefined;
  }
}

// 같은 key로 동시에 여러 번 idbLoad가 호출되면(예: React 18/19 StrictMode가 개발 모드에서 effect를
// 마운트→클린업→재마운트로 일부러 두 번 실행하는 것), 마이그레이션(localStorage 읽기+삭제)이 두 번
// 실행되면서 두 번째 호출이 "이미 첫 번째가 지워버린 localStorage"와 "아직 첫 번째의 db.put이 안
// 끝난 빈 IndexedDB"를 동시에 보고 fallback으로 떨어지는 경쟁 상태가 실제로 발생했다(실측 확인).
// 같은 key에 대한 로드를 하나의 Promise로 캐싱해서, 동시 호출은 전부 같은 결과를 공유하게 한다.
const inFlightLoads = new Map<string, Promise<unknown>>();

export function idbLoad<T>(key: string, fallback: T): Promise<T> {
  const existingLoad = inFlightLoads.get(key);
  if (existingLoad) return existingLoad as Promise<T>;

  const loadPromise = (async (): Promise<T> => {
    try {
      const db = await getDb();
      const existing = await db.get(STORE_NAME, key);
      if (existing !== undefined) return existing as T;

      const migrated = await migrateFromLocalStorageOnce<T>(key);
      if (migrated !== undefined) {
        await db.put(STORE_NAME, migrated, key);
        return migrated;
      }
      return fallback;
    } catch (err) {
      console.error(`IndexedDB load error (${key}):`, err);
      return fallback;
    } finally {
      inFlightLoads.delete(key);
    }
  })();

  inFlightLoads.set(key, loadPromise);
  return loadPromise;
}

export async function idbSave(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_NAME, value, key);
  } catch (err) {
    console.error(`IndexedDB save error (${key}):`, err);
  }
}
