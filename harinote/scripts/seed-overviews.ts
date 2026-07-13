/**
 * 관광지 소개문 배치 수집 — detailCommon2 → src/data/overviews.json
 * (목록 카드의 1~2문장 설명용. 상세 페이지는 실시간 조회를 쓴다.)
 *
 * 실행: npx tsx --env-file=.env.local scripts/seed-overviews.ts
 * - TOUR_API_KEY 필요 (data.go.kr 국문 관광정보 서비스 활용신청)
 * - 재실행 시 이미 수집된 contentId는 건너뜀 (중단 후 이어받기 가능)
 * - 호출 간 80ms 간격 — 2,086곳 ≈ 4분, 쿼터·게이트웨이 배려
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fetchPlaceOverview } from "../src/lib/tour/overview";

const PLACES_PATH = "src/data/gangwon.json";
const OUT_PATH = "src/data/overviews.json";
/** 카드 요약 최대 길이 — 문장 경계에서 자른다 */
const MAX_LEN = 160;

function toCardSummary(overview: string): string {
  if (overview.length <= MAX_LEN) return overview;
  // 마침표/물음표 뒤 문장 경계 중 MAX_LEN 안의 마지막 지점
  const slice = overview.slice(0, MAX_LEN);
  const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("다. "));
  return cut > 40 ? overview.slice(0, cut + 1) : slice.trimEnd() + "…";
}

const places: { contentId: number; title: string }[] = JSON.parse(
  readFileSync(PLACES_PATH, "utf8"),
);
const out: Record<string, string> = existsSync(OUT_PATH)
  ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
  : {};

let done = 0;
let fetched = 0;
for (const p of places) {
  done++;
  const key = String(p.contentId);
  if (out[key]) continue;

  const overview = await fetchPlaceOverview(p.contentId);
  if (overview) {
    out[key] = toCardSummary(overview);
    fetched++;
  }
  if (fetched > 0 && fetched % 100 === 0) {
    writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
    console.log(`진행 ${done}/${places.length} — 수집 ${fetched}건 (중간 저장)`);
  }
  await new Promise((r) => setTimeout(r, 80));
}

writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
console.log(
  `완료: ${Object.keys(out).length}/${places.length}곳 소개문 저장 → ${OUT_PATH}`,
);
