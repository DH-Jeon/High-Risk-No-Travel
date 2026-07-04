/**
 * 모듈 레벨 TTL 프로미스 캐시 — kma.ts·airkorea.ts 공용.
 *
 * - 프로미스 자체를 캐시해 동시 요청을 1회 호출로 합친다
 *   (getPlacesWithSafety가 2,091곳을 Promise.all로 돌려도 시군당 1회만 호출).
 * - 실패한 프로미스는 짧은 TTL로 교체해 재시도 폭주를 막으면서도 곧 복구 시도한다.
 */

interface Entry<T> {
  promise: Promise<T>;
  expiresAt: number;
}

export interface TtlCache<T> {
  get(key: string, factory: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createTtlCache<T>(ttlMs: number, failTtlMs: number): TtlCache<T> {
  const store = new Map<string, Entry<T>>();
  return {
    get(key, factory) {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && hit.expiresAt > now) return hit.promise;

      const entry: Entry<T> = { promise: factory(), expiresAt: now + ttlMs };
      store.set(key, entry);
      // 실패 시 짧은 TTL — 거부된 프로미스가 1시간 동안 눌러앉지 않도록
      entry.promise.catch(() => {
        entry.expiresAt = Math.min(entry.expiresAt, now + failTtlMs);
      });
      return entry.promise;
    },
    clear() {
      store.clear();
    },
  };
}
