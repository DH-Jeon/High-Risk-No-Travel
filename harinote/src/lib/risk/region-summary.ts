/**
 * 시군별 안전점수 집계 — /map 시군 위험 지도의 데이터 소스.
 *
 * 대표값은 평균이 아니라 **중앙값**을 쓴다: 시군 안에 극단 점수(고립 산악지 등)가
 * 섞여도 "이 시군의 오늘 분위기"가 덜 왜곡되도록.
 * 등급 판정은 새 임계값 없이 기존 gradeForScore(weights.ts)를 그대로 재사용한다.
 *
 * getRegionSummaries는 datasource(서버 전용)를 호출하므로 이 모듈도 서버 전용.
 * 순수 함수 summarizeRegions는 테스트에서 직접 호출한다.
 */
import type { Profile, RiskFactor, RiskLevel } from "@/lib/safety/types";
import { gradeForScore } from "@/lib/safety/weights";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import {
  getPlacesWithSafety,
  getPlacesWithSafetyOnDate,
  getPlacesWithSafetyOnRange,
  type PlaceWithSafety,
} from "@/lib/datasource";

export interface RegionSummary {
  sigunguCode: number;
  name: string;
  lat: number;
  lng: number;
  /** 시군 내 관광지 안전점수 중앙값 — 관광지 0곳이면 null ("데이터 없음") */
  medianScore: number | null;
  /** 중앙값의 등급(gradeForScore) — 관광지 0곳이면 null */
  grade: RiskLevel | null;
  placeCount: number;
  /**
   * 중앙값에 가장 가까운 대표 관광지의 요인 분해 — "이 점수가 왜 나왔나"를
   * 안전지수 산출식 지표(체감온도·강수·미먼·산불·산사태·응급의료)로 설명. 0곳이면 [].
   * 날씨 요인은 시군 대표점 공유이나 의료·산불은 이 대표 장소값이라 sampleName으로 명시.
   */
  factors: RiskFactor[];
  /** factors의 출처가 된 대표 관광지 이름 (없으면 null) */
  sampleName: string | null;
}

/** 정렬된 배열의 중앙값 — 짝수 개면 가운데 두 값 평균을 반올림 */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * 관광지 배열 → 강원 18개 시군 요약 (sigunguCode 오름차순).
 * sigunguCode가 없거나 SIGUNGU_SEATS에 없는 관광지는 제외.
 * 관광지 0곳인 시군도 SIGUNGU_SEATS 기준으로 포함한다 (medianScore/grade = null).
 */
export function summarizeRegions(places: PlaceWithSafety[]): RegionSummary[] {
  const placesByCode = new Map<number, PlaceWithSafety[]>();
  for (const place of places) {
    const code = place.sigunguCode;
    if (code === undefined || !(code in SIGUNGU_SEATS)) continue;
    const arr = placesByCode.get(code) ?? [];
    arr.push(place);
    placesByCode.set(code, arr);
  }

  return Object.keys(SIGUNGU_SEATS)
    .map(Number)
    .map((code) => {
      const seat = SIGUNGU_SEATS[code];
      const group = placesByCode.get(code) ?? [];
      const scores = group.map((p) => p.safety.score).sort((a, b) => a - b);
      const medianScore = scores.length > 0 ? median(scores) : null;
      // 대표 관광지 = 중앙값에 점수가 가장 가까운 곳 → 그 요인 분해로 시군 점수를 설명
      let factors: RiskFactor[] = [];
      let sampleName: string | null = null;
      if (medianScore !== null) {
        const rep = group.reduce((best, p) =>
          Math.abs(p.safety.score - medianScore) <
          Math.abs(best.safety.score - medianScore)
            ? p
            : best,
        );
        factors = rep.safety.factors;
        sampleName = rep.title ?? null;
      }
      return {
        sigunguCode: code,
        name: seat.name,
        lat: seat.lat,
        lng: seat.lng,
        medianScore,
        grade: medianScore === null ? null : gradeForScore(medianScore),
        placeCount: scores.length,
        factors,
        sampleName,
      };
    })
    // 안전점수 높은 시군부터 (데이터 없는 곳은 맨 뒤)
    .sort((a, b) => (b.medianScore ?? -1) - (a.medianScore ?? -1));
}

/**
 * 전체 관광지의 점수를 시군별로 요약 — 서버 전용.
 * profile·dateISO를 주면 그 조건의 점수로 지도가 반응한다 (홈 날짜 스테퍼).
 * endISO까지 주면 기간 모드 — 기간 중 최악일 대표점수 기준.
 */
export async function getRegionSummaries(
  profile: Profile = "default",
  dateISO?: string,
  endISO?: string,
): Promise<RegionSummary[]> {
  const places = dateISO
    ? endISO
      ? await getPlacesWithSafetyOnRange(profile, dateISO, endISO)
      : await getPlacesWithSafetyOnDate(profile, dateISO)
    : await getPlacesWithSafety(undefined, profile);
  return summarizeRegions(places);
}
