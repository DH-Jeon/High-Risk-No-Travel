/**
 * 모듈 레벨 TTL 프로미스 캐시 — kma.ts·airkorea.ts 공용.
 *
 * - 프로미스 자체를 캐시해 동시 요청을 1회 호출로 합친다
 *   (getPlacesWithSafety가 2,091곳을 Promise.all로 돌려도 시군당 1회만 호출).
 * - 실패한 프로미스는 짧은 TTL로 교체해 재시도 폭주를 막으면서도 곧 복구 시도한다.
 * - SWR: 성공값이 있는 키는 TTL이 지나도 스테일을 즉시 반환하고 백그라운드로 갱신한다.
 *   페이지 전환이 외부 API(수 초, 무응답 가능)를 동기로 기다리지 않게 하기 위함 —
 *   기상·미세먼지류 데이터는 TTL+갱신 소요만큼 오래된 값이어도 화면 가치가 유지된다.
 *   갱신이 계속 실패하면 스테일이 계속 나가는 대신 get마다 재시도한다
 *   (블로킹으로 바꿔도 어차피 실패 → mock 폴백이므로 스테일 실값이 낫다).
 */

interface Entry<T> {
  promise: Promise<T>;
  expiresAt: number;
  /** 프로미스가 거부됨 — 만료 후 SWR 대상이 아니라 블로킹 재시도 대상 */
  failed?: boolean;
  /** 백그라운드 갱신 진행 중 — 만료 후 연속 get의 중복 갱신 방지 */
  refreshing?: boolean;
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

      // 만료됐지만 성공값이 있다 → 스테일 즉시 반환 + 백그라운드 갱신 (SWR)
      if (hit && !hit.failed) {
        if (!hit.refreshing) {
          hit.refreshing = true;
          const fresh = factory();
          fresh.then(
            () =>
              store.set(key, { promise: fresh, expiresAt: Date.now() + ttlMs }),
            () => {
              // 갱신 실패 — 스테일 유지, 다음 get에서 재시도
              hit.refreshing = false;
            },
          );
        }
        return hit.promise;
      }

      // 콜드 시작 또는 실패 엔트리 만료 → 블로킹 호출 (기존 동작)
      const entry: Entry<T> = { promise: factory(), expiresAt: now + ttlMs };
      store.set(key, entry);
      // 실패 시 짧은 TTL — 거부된 프로미스가 1시간 동안 눌러앉지 않도록
      entry.promise.catch(() => {
        entry.failed = true;
        entry.expiresAt = Math.min(entry.expiresAt, now + failTtlMs);
      });
      return entry.promise;
    },
    clear() {
      store.clear();
    },
  };
}
