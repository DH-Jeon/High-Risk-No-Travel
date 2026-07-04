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
import { getLiveRiskInput } from "@/lib/risk/live";
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
}

export interface PlaceWithSafety extends Place {
  safety: RiskBreakdown;
}

/** 요청 스코프 메모이즈(React cache) — generateMetadata와 페이지 본문의 중복 로드를 1회로 (live 쿼터 보호) */
const loadPlaces = cache(async (): Promise<Place[]> => {
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
});

function matches(place: Place, query?: PlaceQuery): boolean {
  if (!query) return true;
  if (query.contentTypeId && place.contentTypeId !== query.contentTypeId) {
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

export async function getPlace(contentId: number): Promise<Place | null> {
  const places = await loadPlaces();
  return places.find((p) => p.contentId === contentId) ?? null;
}

/**
 * 관광지의 위험 계산 입력값 — 항상 live 경로를 사용한다.
 * getLiveRiskInput은 소스별 폴백을 내장하므로 키가 없어도 안전하며,
 * 응급의료 거리(내장 병원 좌표 실계산)는 키·네트워크 없이도 실값이 나온다.
 * 남은 mock: 대피소(shelterKm), 산불위험(활용신청 승인 전까지).
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
 * 요청 스코프 메모이즈 — 상세·리포트 페이지가 추천 후보로 전체(query=undefined)를
 * 조회할 때 같은 요청 내 중복 전량 점수 계산을 1회로 줄인다.
 * (cache()는 인자 동일성 기반이므로 query=undefined + 같은 profile 문자열일 때 적중)
 */
export const getPlacesWithSafety = cache(
  async (
    query?: PlaceQuery,
    profile: Profile = "default",
  ): Promise<PlaceWithSafety[]> => {
    return attachSafety(await getPlaces(query), profile);
  },
);

export async function getPlaceWithSafety(
  contentId: number,
  profile: Profile = "default",
): Promise<PlaceWithSafety | null> {
  const place = await getPlace(contentId);
  if (!place) return null;
  return {
    ...place,
    safety: computeSafetyScore(await getRiskInput(place), place, profile),
  };
}
