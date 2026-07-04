/**
 * 기상청·AirKorea 키 스모크 테스트 — 실행: npx tsx scripts/check-risk-apis.ts
 * 춘천 대표점(시군청)으로 단기예보 1회 + 강원 실시간 미세먼지 1회를 실호출해
 * 파싱된 값(기온·강수확률·풍속·PM2.5)을 확인한다.
 * 외부 의존성 없음 (Node 내장 process.loadEnvFile 사용, dotenv 금지).
 * 주의: 서비스 키 값은 절대 출력하지 않는다.
 */
import { latLngToGrid } from "../src/lib/risk/kma-grid";
import { fetchKmaDailyWeatherRaw, pickBaseDateTime } from "../src/lib/risk/kma";
import {
  fetchGangwonStationPm25Raw,
  pickPm25ForSigungu,
} from "../src/lib/risk/airkorea";
import { SIGUNGU_SEATS } from "../src/lib/risk/regions";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("[i] .env.local이 없습니다 — 셸 환경변수만 사용합니다.");
}

/** 게이트웨이 오류 메시지를 보고 활용신청 반영 대기 여부를 안내 */
function explainGatewayError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`    [x] ${msg}`);
  if (/forbidden/i.test(msg)) {
    console.error(
      "    → 키는 인식되지만 이 서비스 사용 권한이 아직 없습니다 (활용신청 반영 대기 중).\n" +
        "      발급 직후라면 게이트웨이 반영까지 1~2시간 대기 후 재시도하세요.",
    );
  } else if (/unauthorized/i.test(msg)) {
    console.error(
      "    → 키를 인식하지 못합니다. 복사 누락/공백 여부와 디코딩 키인지 확인하세요.",
    );
  } else if (/SERVICE_KEY|등록되지 않은|NOT_REGISTERED/i.test(msg)) {
    console.error(
      "    → 키 등록이 아직 반영되지 않았습니다 (활용신청 반영 대기 중, 최대 1~2시간).",
    );
  }
}

async function checkKma(): Promise<boolean> {
  const chuncheon = SIGUNGU_SEATS[13];
  const { nx, ny } = latLngToGrid(chuncheon.lat, chuncheon.lng);
  const { baseDate, baseTime } = pickBaseDateTime(new Date());
  console.log(
    `[1] 기상청 단기예보 호출 중... (춘천 대표점 → 격자 ${nx},${ny} / base ${baseDate} ${baseTime})`,
  );
  if (!process.env.KMA_API_KEY) {
    console.error("    [x] KMA_API_KEY가 없습니다. .env.local을 확인하세요.");
    return false;
  }
  try {
    const w = await fetchKmaDailyWeatherRaw(nx, ny);
    console.log(
      `    [v] 기온(최고) ${w.tempC ?? "?"}℃ / 강수확률(최대) ${w.rainProbPct ?? "?"}% / ` +
        `풍속(최대) ${w.windMs ?? "?"}m/s / 강수량(합계) ${w.rainMm ?? "없음"}${w.rainMm !== undefined ? "mm" : ""}`,
    );
    return true;
  } catch (err) {
    explainGatewayError(err);
    return false;
  }
}

async function checkAirKorea(): Promise<boolean> {
  console.log("[2] AirKorea 강원 실시간 미세먼지 호출 중... (sidoName=강원)");
  if (!process.env.AIRKOREA_API_KEY) {
    console.error("    [x] AIRKOREA_API_KEY가 없습니다. .env.local을 확인하세요.");
    return false;
  }
  try {
    const stations = await fetchGangwonStationPm25Raw();
    console.log(
      `    [v] 유효 측정소 ${stations.size}곳: ${[...stations.keys()].join(", ") || "없음"}`,
    );
    const chuncheonPm25 = pickPm25ForSigungu(stations, 13);
    console.log(`    [v] 춘천 PM2.5 = ${chuncheonPm25 ?? "?"}㎍/㎥`);
    return true;
  } catch (err) {
    explainGatewayError(err);
    return false;
  }
}

async function main(): Promise<void> {
  const kmaOk = await checkKma();
  const airOk = await checkAirKorea();

  if (kmaOk && airOk) {
    console.log("[v] 스모크 테스트 통과 — 두 키 모두 정상 동작합니다.");
    return;
  }
  console.error("[x] 일부 호출이 실패했습니다. 위 안내를 확인하세요.");
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("[x] 스모크 테스트 실패:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
