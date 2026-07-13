/**
 * 반려동물 동반 정보 배치 수집 — detailPetTour2 → src/data/pet-friendly.json
 * (목록 필터·카드 배지용. 상세 페이지는 실시간 조회를 쓴다.)
 *
 * 실행: npx tsx --env-file=.env.local scripts/seed-pet.ts
 * - 동반 정보가 있는 관광지만 저장 (없는 곳이 대부분)
 * - 재실행 시 이미 수집된 contentId는 건너뜀 (이어받기 가능)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fetchPlacePetInfo, type PetTourInfo } from "../src/lib/tour/pet";

const PLACES_PATH = "src/data/gangwon.json";
const OUT_PATH = "src/data/pet-friendly.json";
const DONE_PATH = "src/data/.pet-scan-done.json"; // 정보 없음도 기록 — 이어받기용 (git 제외 아님, 커밋 불필요 시 삭제)

async function main() {
  const places: { contentId: number; title: string }[] = JSON.parse(
    readFileSync(PLACES_PATH, "utf8"),
  );
  const out: Record<string, PetTourInfo> = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
    : {};
  const scanned = new Set<string>(
    existsSync(DONE_PATH) ? JSON.parse(readFileSync(DONE_PATH, "utf8")) : [],
  );

  let done = 0;
  for (const p of places) {
    done++;
    const key = String(p.contentId);
    if (scanned.has(key) || out[key]) continue;

    const info = await fetchPlacePetInfo(p.contentId);
    if (info) {
      out[key] = info;
      console.log(`🐶 ${p.title}: ${info.allowed ?? info.type ?? info.needs}`);
    }
    scanned.add(key);

    if (done % 200 === 0) {
      writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
      writeFileSync(DONE_PATH, JSON.stringify([...scanned], null, 0));
      console.log(`진행 ${done}/${places.length} — 동반 가능 ${Object.keys(out).length}곳`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
  writeFileSync(DONE_PATH, JSON.stringify([...scanned], null, 0));
  console.log(
    `완료: 동반 가능 ${Object.keys(out).length}/${places.length}곳 → ${OUT_PATH}`,
  );
}

main();
