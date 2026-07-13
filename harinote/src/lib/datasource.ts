/**
 * [계약 파일] 데이터 소스 스위치 — UI는 이 모듈만 통해 데이터에 접근한다.
 *
 * DATA_SOURCE=json : src/data/gangwon.json — TourAPI 수집 실데이터 내장 (기본값, ADR-004)
 * DATA_SOURCE=mock : 수기 fixture 35건 (키·수집 데이터 없이 개발/테스트)
 * DATA_SOURCE=db   : Supabase 조회 (DB 도입 시점에 활성화)
 * DATA_SOURCE=live : TourAPI 직접 호출 (디버깅·스키마 검증용 — 페이지당 수십 초, 서비스 경로 아님)
 *
 * 서버 전용 모듈 — 클라이언트 컴포넌트에서 import 금지.
 */
import { cache } from "react";
import type { Place } from "@/lib/tour/types";
import type { Profile, RiskBreakdown, RiskInput } from "@/lib/safety/types";
import { computeSafetyScore } from "@/lib/safety/score";
import { getForecastRiskInput, getLiveRiskInput } from "@/lib/risk/live";
import { seasonalRange, type SeasonalRange } from "@/lib/risk/seasonal";
import { dayOffsetSeoul, monthOfISO, toKmaDate } from "@/lib/date";
import { applyEnvTypeOverrides } from "@/lib/tour/env-overrides";
import { gangwonPlaces } from "@/fixtures/tour/gangwon";

export type DataSource = "json" | "mock" | "db" | "live";

export function getDataSource(): DataSource {
  const v = process.env.DATA_SOURCE;
  if (v === "mock" || v === "db" || v === "live") return v;
  return "json";
}

export interface PlaceQuery {
  /** 제목/주소 부분 일치 검색어 */
  q?: string;
  /** 12 관광지, 14 문화시설, 39 음식점 ... */
  contentTypeId?: number;
  /** TourAPI 강원 시군구 코드 (1~18, regions.ts SIGUNGU_SEATS 키) */
  sigunguCode?: number;
}

export interface PlaceWithSafety extends Place {
  safety: RiskBreakdown;
}

/** 요청 스코프 메모이즈(React cache) — generateMetadata와 페이지 본문의 중복 로드를 1회로 (live 쿼터 보호) */
const loadPlaces = cache(async (): Promise<Place[]> => {
  // 소스와 무관하게 envType 데이터 기반 보정을 적용한다 (고지·오지 93곳 → mountain, env-overrides.ts)
  return applyEnvTypeOverrides(await loadPlacesRaw());
});

const loadPlacesRaw = async (): Promise<Place[]> => {
  const source = getDataSource();
  if (source === "live") {
    const { fetchGangwonPlaces } = await import("@/lib/tour/client");
    return fetchGangwonPlaces();
  }
  if (source === "db") {
    throw new Error(
      "DATA_SOURCE=db는 Supabase 도입 시점(ADR-004)에 지원됩니다. json 또는 mock을 사용하세요.",
    );
  }
  if (source === "mock") return gangwonPlaces;
  // json (기본): pnpm seed가 생성한 TourAPI 수집 실데이터
  try {
    const data = await import("@/data/gangwon.json");
    return data.default as Place[];
  } catch (err) {
    // 파일 손상/부재 시에도 화면이 죽지 않도록 mock으로 폴백
    console.warn(
      "[datasource] gangwon.json 로드 실패 — mock fixture(35건)로 폴백합니다:",
      err instanceof Error ? err.message : err,
    );
    return gangwonPlaces;
  }
};

function matches(place: Place, query?: PlaceQuery): boolean {
  if (!query) return true;
  if (query.contentTypeId && place.contentTypeId !== query.contentTypeId) {
    return false;
  }
  if (query.sigunguCode && place.sigunguCode !== query.sigunguCode) {
    return false;
  }
  if (query.q) {
    const q = query.q.trim();
    if (q && !place.title.includes(q) && !place.addr.includes(q)) return false;
  }
  return true;
}

export async function getPlaces(query?: PlaceQuery): Promise<Place[]> {
  const places = await loadPlaces();
  return places.filter((p) => matches(p, query));
}

/** 목록 페이지가 날짜별 전량 캐시 결과를 직접 필터링할 때 사용 */
export function matchesPlaceQuery(place: Place, query?: PlaceQuery): boolean {
  return matches(place, query);
}

export async function getPlace(contentId: number): Promise<Place | null> {
  const places = await loadPlaces();
  return places.find((p) => p.contentId === contentId) ?? null;
}

/**
 * 관광지의 위험 계산 입력값 — 항상 live 경로를 사용한다.
 * getLiveRiskInput은 소스별 폴백을 내장하므로 키가 없어도 안전하며,
 * 응급의료 거리(내장 병원 좌표 실계산)는 키·네트워크 없이도 실값이 나온다.
 * 남은 mock: 산불위험(활용신청 승인 전까지). 대피소는 데이터 확보 전까지 축 비활성.
 */
export async function getRiskInput(place: Place): Promise<RiskInput> {
  return getLiveRiskInput(place);
}

/** 관광지 배열에 안전점수를 계산해 붙인다 — 화면에 실제로 노출될 항목에만 호출할 것 */
export async function attachSafety(
  places: Place[],
  profile: Profile = "default",
): Promise<PlaceWithSafety[]> {
  return Promise.all(
    places.map(async (place) => ({
      ...place,
      safety: computeSafetyScore(await getRiskInput(place), place, profile),
    })),
  );
}

/**
 * 전체 관광지 + 안전점수 (profile별). 두 겹 캐시로 무거운 전량 점수 계산을 줄인다:
 * - 프로세스 메모리 캐시(10분 TTL): 서버 인스턴스가 살아있는 동안 요청 간 재사용.
 *   전체 결과가 ~3MB라 Next 데이터 캐시(2MB 상한) 대신 in-memory를 쓴다. 연속 조회(데모·탐색)에 특히 효과적.
 * - React cache: 같은 요청 안의 중복 호출(generateMetadata·본문·대체지 등)을 1회로.
 * live 소스는 캐시가 특히 중요(직접 호출은 페이지당 수십 초).
 */
const PLACES_CACHE_TTL_MS = 10 * 60 * 1000;
const placesCacheStore = new Map<
  Profile,
  { data: PlaceWithSafety[]; expiresAt: number }
>();

const getAllWithSafety = cache(
  async (profile: Profile): Promise<PlaceWithSafety[]> => {
    const hit = placesCacheStore.get(profile);
    if (hit && hit.expiresAt > Date.now()) return hit.data;
    const data = await attachSafety(await loadPlaces(), profile);
    placesCacheStore.set(profile, {
      data,
      expiresAt: Date.now() + PLACES_CACHE_TTL_MS,
    });
    return data;
  },
);

/**
 * 관광지 + 안전점수 조회. 전체를 캐시로 계산한 뒤 query로 필터하므로
 * 검색·상세·코스가 모두 같은 캐시를 재사용한다. 시그니처는 계약(불변).
 */
export const getPlacesWithSafety = cache(
  async (
    query?: PlaceQuery,
    profile: Profile = "default",
  ): Promise<PlaceWithSafety[]> => {
    const all = await getAllWithSafety(profile);
    return query ? all.filter((p) => matches(p, query)) : all;
  },
);

export async function getPlaceWithSafety(
  contentId: number,
  profile: Profile = "default",
): Promise<PlaceWithSafety | null> {
  const all = await getAllWithSafety(profile);
  return all.find((p) => p.contentId === contentId) ?? null;
}

// ── 날짜 기반 점수 ("그날 가도 될까") ──────────────────────────────
// D+1~3: 단기예보(forecast) — 해당 날짜 예보가 응답에 없으면 계절 모드로 폴백
// D+4~ : 계절 모드(seasonal) — 30년 분위수 시나리오의 점수 "범위"

export type DateSafetyMode = "forecast" | "seasonal";

export interface DateSafety {
  mode: DateSafetyMode;
  dateISO: string;
  /** 오늘로부터 며칠 뒤인지 */
  dayOffset: number;
  /**
   * 대표 점수 — forecast: 그날 예보 점수 / seasonal: 통상일 점수.
   * 랭킹·대체지 비교는 이 값 기준.
   */
  breakdown: RiskBreakdown;
  /** seasonal 모드에서만 — 통상일/궂은날 범위 (주의 요인 안내는 bad 기준) */
  seasonal?: SeasonalRange;
}

/**
 * 특정 미래 날짜의 안전 점수. 계절 데이터까지 없으면 null (호출부는 오늘 모드 유지).
 */
export async function getDateSafety(
  place: Place,
  profile: Profile,
  dateISO: string,
): Promise<DateSafety | null> {
  const dayOffset = dayOffsetSeoul(dateISO);
  if (dayOffset >= 1 && dayOffset <= 3) {
    const input = await getForecastRiskInput(place, toKmaDate(dateISO));
    if (input) {
      return {
        mode: "forecast",
        dateISO,
        dayOffset,
        breakdown: computeSafetyScore(input, place, profile),
      };
    }
  }
  const r = seasonalRange(place, monthOfISO(dateISO), profile);
  if (!r) return null;
  return { mode: "seasonal", dateISO, dayOffset, breakdown: r.typical, seasonal: r };
}

/** 날짜별 후보 목록 캐시 — 날짜가 다양할 수 있어 개수를 제한한다 */
const DATE_CACHE_MAX_KEYS = 12;
const datePlacesCacheStore = new Map<
  string,
  { data: PlaceWithSafety[]; expiresAt: number }
>();

/**
 * 특정 날짜 기준 관광지 + 안전점수 목록 — 대체지·코스 추천이 대상 관광지와
 * 같은 날짜 기준으로 비교되도록 한다. 날짜 점수를 못 만든 곳은 오늘 점수 유지.
 */
export const getPlacesWithSafetyOnDate = cache(
  async (profile: Profile, dateISO: string): Promise<PlaceWithSafety[]> => {
    const key = `${profile}:${dateISO}`;
    const hit = datePlacesCacheStore.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const base = await getAllWithSafety(profile);
    const data = await Promise.all(
      base.map(async (p) => {
        const ds = await getDateSafety(p, profile, dateISO);
        return ds ? { ...p, safety: ds.breakdown } : p;
      }),
    );

    if (datePlacesCacheStore.size >= DATE_CACHE_MAX_KEYS) {
      datePlacesCacheStore.clear();
    }
    datePlacesCacheStore.set(key, {
      data,
      expiresAt: Date.now() + PLACES_CACHE_TTL_MS,
    });
    return data;
  },
);
