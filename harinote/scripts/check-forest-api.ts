/**
 * 산림청 산불위험예보 키 스모크 테스트 — 실행: npx tsx scripts/check-forest-api.ts
 * 시군구 산불위험지수를 1회 실호출해 춘천의 위험지수·4단계를 확인한다.
 * 키는 FOREST_API_KEY, 없으면 data.go.kr 공용 키(TOUR_API_KEY)를 재사용한다.
 * 외부 의존성 없음 (Node 내장 process.loadEnvFile 사용, dotenv 금지).
 * 주의: 서비스 키 값은 절대 출력하지 않는다.
 */
import {
  fetchGangwonForestPointsRaw,
  forestIndexToLevel,
  pickForestIndexForSigungu,
} from "../src/lib/risk/forest";
import { FOREST_FIRE } from "../src/lib/safety/weights";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("[i] .env.local이 없습니다 — 셸 환경변수만 사용합니다.");
}

const DATASET = "산림청 국립산림과학원_산불위험예보정보";
const APPLY_URL = "https://www.data.go.kr/data/15084817/openapi.do";

async function main(): Promise<void> {
  console.log("[1] 산불위험예보(시군구) 호출 중... (전국 1회 조회 후 강원 필터)");
  if (!process.env.FOREST_API_KEY && !process.env.TOUR_API_KEY) {
    console.error(
      "    [x] FOREST_API_KEY(또는 TOUR_API_KEY)가 없습니다. .env.local을 확인하세요.",
    );
    process.exitCode = 1;
    return;
  }
  if (!process.env.FOREST_API_KEY) {
    console.log("    [i] FOREST_API_KEY가 없어 TOUR_API_KEY(같은 계정 키)를 재사용합니다.");
  }

  try {
    const rows = await fetchGangwonForestPointsRaw();
    console.log(`    [v] 강원 시군구 ${rows.length}행 수신`);
    const index = pickForestIndexForSigungu(rows, 13); // 춘천
    if (index === undefined) {
      console.error("    [x] 강원 행에서 춘천 위험지수를 찾지 못했습니다.");
      process.exitCode = 1;
      return;
    }
    const level = forestIndexToLevel(index);
    console.log(
      `    [v] 춘천 산불위험지수 = ${index} → ${level}단계(${FOREST_FIRE.LEVEL_LABEL[level]})`,
    );
    console.log("[v] 스모크 테스트 통과 — 산불위험예보 키가 정상 동작합니다.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    [x] ${msg}`);
    if (/forbidden|활용신청/i.test(msg)) {
      console.error(
        `    → 활용신청 필요: "${DATASET}"\n` +
          `      ${APPLY_URL} 에서 로그인 후 [활용신청]을 하세요.\n` +
          "      승인(자동)·게이트웨이 반영까지 1~2시간 걸릴 수 있습니다.\n" +
          "      승인되면 이 스크립트를 다시 실행하세요 — 코드 변경 없이 바로 활성화됩니다.",
      );
    } else if (/unauthorized/i.test(msg)) {
      console.error(
        "    → 키를 인식하지 못합니다. 복사 누락/공백 여부와 디코딩 키인지 확인하세요.",
      );
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[x] 스모크 테스트 실패:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
