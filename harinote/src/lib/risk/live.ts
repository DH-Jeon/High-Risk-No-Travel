/**
 * 실데이터 RiskInput 조립 — 기상청 단기예보 + AirKorea PM2.5 + 산림청 산불위험지수.
 *
 * 점진적 실데이터화: mockRiskInputFor를 베이스로
 * tempC·rainProbPct·rainMm·windMs·pm25·forestFireLevel은 실데이터로 덮어쓰고,
 * emergencyRoomKm는 내장 응급의료기관 좌표(src/data/hospitals.gangwon.json)로 실계산한다.
 * shelterKm·roadRisk는 아직 mock — 후속 작업.
 * (산불위험은 데이터포털 활용신청 승인 전이면 Forbidden으로 실패해 mock이 유지되고,
 * 키가 활성화되는 즉시 별도 코드 변경 없이 실데이터로 전환된다.)
 *
 * 안정성 계약: 개별 소스 실패 시 해당 필드만 mock 유지(부분 성공 허용),
 * 전체 실패 시에도 throw하지 않고 mock 전체를 반환한다 (화면이 죽으면 안 됨).
 * 서버 전용 모듈.
 */
import type { Place } from "@/lib/tour/types";
import type { RiskInput } from "@/lib/safety/types";
import { mockRiskInputFor } from "@/fixtures/safety/risk-inputs";
import { latLngToGrid } from "./kma-grid";
import { fetchKmaDailyWeather } from "./kma";
import { getGangwonPm25 } from "./airkorea";
import { fetchForestFireLevel } from "./forest";
import { nearestHospitalKm } from "./medical";
import { SIGUNGU_SEATS } from "./regions";

/** 실연동에 필요한 두 키가 모두 있는가 — 없으면 호출부는 mock 경로를 쓴다 */
export function hasLiveRiskKeys(): boolean {
  return Boolean(process.env.KMA_API_KEY && process.env.AIRKOREA_API_KEY);
}

/** 전체 실패 경고는 프로세스당 1회만 — 2,091곳 순회 시 로그 폭주 방지 */
let warnedAllSourcesFailed = false;

export async function getLiveRiskInput(
  place: Pick<Place, "contentId" | "envType" | "sigunguCode" | "lat" | "lng">,
): Promise<RiskInput> {
  const input = mockRiskInputFor(place);

  // 응급의료 거리 — 내장 병원 좌표 기반 실계산 (네트워크·키 불필요).
  // 병원 데이터가 비어 있으면(Infinity) 해당 필드만 mock 유지.
  const erKm = nearestHospitalKm(place.lat, place.lng, place.contentId);
  if (Number.isFinite(erKm)) {
    input.emergencyRoomKm = Math.round(erKm * 10) / 10;
  }

  // 시군 대표점(시군청 소재지) 격자로 호출 — 시군당 1회 + 1시간 캐시.
  // sigunguCode가 없으면 place 좌표로 격자 계산 (해당 격자만 별도 캐시 슬롯).
  const seat = place.sigunguCode !== undefined ? SIGUNGU_SEATS[place.sigunguCode] : undefined;
  const { nx, ny } = latLngToGrid(seat?.lat ?? place.lat, seat?.lng ?? place.lng);

  const [weather, pm25, forestFire] = await Promise.allSettled([
    fetchKmaDailyWeather(nx, ny),
    getGangwonPm25(place.sigunguCode),
    // 시군 코드가 없으면 산불 조회는 건너뛴다 (rejected로 정착 → mock 유지)
    place.sigunguCode !== undefined
      ? fetchForestFireLevel(place.sigunguCode)
      : Promise.reject(new Error("sigunguCode 없음 — 산불위험 조회 생략")),
  ]);

  if (weather.status === "fulfilled") {
    const w = weather.value;
    // 핵심값이 하나도 없는 빈 응답(발표 직후 등)은 실데이터로 취급하지 않고 mock 전체 유지
    // — 일부만 덮어쓰면 mock 기온 + 실측 강수 같은 혼종 상태가 된다
    const hasCore =
      w.tempC !== undefined ||
      w.rainProbPct !== undefined ||
      w.windMs !== undefined;
    if (hasCore) {
      if (w.tempC !== undefined) input.tempC = w.tempC;
      if (w.rainProbPct !== undefined) input.rainProbPct = w.rainProbPct;
      if (w.windMs !== undefined) input.windMs = w.windMs;
      // 실예보가 "강수없음"이면 mock의 rainMm도 제거 — 날씨 필드는 통째로 실데이터화
      if (w.rainMm !== undefined) input.rainMm = w.rainMm;
      else delete input.rainMm;
    }
  }

  if (pm25.status === "fulfilled") {
    input.pm25 = Math.round(pm25.value);
  }

  if (forestFire.status === "fulfilled") {
    input.forestFireLevel = forestFire.value;
  }

  if (weather.status === "rejected" && pm25.status === "rejected") {
    if (!warnedAllSourcesFailed) {
      warnedAllSourcesFailed = true;
      console.warn(
        "[risk/live] 기상청·AirKorea 조회가 모두 실패해 mock 위험 입력으로 대체합니다.",
        weather.reason instanceof Error ? weather.reason.message : weather.reason,
      );
    }
  }

  return input;
}
