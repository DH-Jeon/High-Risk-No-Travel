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
import { gradeForScore, MEDICAL } from "@/lib/safety/weights";
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
  /**
   * 시군 대표 안전점수 = 대표 야외 관광지(중앙값 최근접)의 점수.
   * factors도 같은 장소에서 와서 점수와 분해가 항상 일치한다. 0곳이면 null.
   */
  medianScore: number | null;
  /** 대표 점수의 등급(gradeForScore) — 관광지 0곳이면 null */
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

      // 시군 대표 = 실내 제외 야외장소 중 점수가 중앙값에 가장 가까운 곳.
      // 표시 점수·요인 분해를 모두 이 한 장소에서 가져와 항상 일치시킨다 —
      // 실내 대표로 강수가 축소되던 왜곡을 막고, 서로 다른 집계를 합쳐 점수가
      // 틀어지던 문제도 없앤다. 응급의료 커버리지는 점수 아닌 설명에만 덧붙인다.
      let medianScore: number | null = null;
      let grade: RiskLevel | null = null;
      let factors: RiskFactor[] = [];
      let sampleName: string | null = null;
      if (scores.length > 0) {
        const anchor = median(scores);
        const general = group.filter((p) => p.envType === "outdoor_general");
        const outdoor = group.filter((p) => p.envType !== "indoor");
        const pool = general.length ? general : outdoor.length ? outdoor : group;
        const rep = pool.reduce((best, p) =>
          Math.abs(p.safety.score - anchor) < Math.abs(best.safety.score - anchor)
            ? p
            : best,
        );
        medianScore = rep.safety.score;
        grade = gradeForScore(medianScore);
        sampleName = rep.title ?? null;

        // 시군 응급의료 커버리지(골든타임 이내 관광지 비율) — 감점은 대표 장소값 그대로,
        // 설명에만 "곳곳에 잘 퍼졌나" 시군 맥락을 덧붙인다.
        const kms = group
          .map((p) => p.safety.factors?.find((f) => f.key === "medical")?.value)
          .filter((v): v is number => v !== undefined);
        const within =
          kms.length > 0
            ? Math.round(
                (kms.filter((k) => k <= MEDICAL.NEAR_KM).length / kms.length) * 100,
              )
            : null;
        factors = (rep.safety.factors ?? []).map((f) =>
          f.key === "medical" && within !== null
            ? {
                ...f,
                description: `${f.description} · 시군 관광지 ${within}%가 골든타임(${MEDICAL.NEAR_KM}km) 이내`,
              }
            : f,
        );
      }
      return {
        sigunguCode: code,
        name: seat.name,
        lat: seat.lat,
        lng: seat.lng,
        medianScore,
        grade,
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
