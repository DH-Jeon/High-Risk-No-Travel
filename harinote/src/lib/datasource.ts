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
import { mockRiskInputFor } from "@/fixtures/safety/risk-inputs";
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
  const data = await import("@/data/gangwon.json");
  return data.default as Place[];
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

/** 관광지의 위험 계산 입력값. 1주차: 결정적 mock, 2주차: 기상청·AirKorea 실연동으로 교체 */
export async function getRiskInput(place: Place): Promise<RiskInput> {
  return mockRiskInputFor(place);
}

export async function getPlacesWithSafety(
  query?: PlaceQuery,
  profile: Profile = "default",
): Promise<PlaceWithSafety[]> {
  const places = await getPlaces(query);
  return Promise.all(
    places.map(async (place) => ({
      ...place,
      safety: computeSafetyScore(await getRiskInput(place), place, profile),
    })),
  );
}

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
