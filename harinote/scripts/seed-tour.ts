/**
 * 관광지 시드 스크립트 — 실행: pnpm seed [--from-fixture]
 * - --from-fixture : src/fixtures/tour/gangwon.ts 요약 출력 (환경변수 불필요)
 * - 기본(live)     : TourAPI fetchGangwonPlaces() 호출 후 요약 출력 (TOUR_API_KEY 필요)
 * Supabase upsert는 인프라 연결 후 활성화 예정 (아래 골격 참고, 현재 호출하지 않음).
 */
import type { Place } from "../src/lib/tour/types";
import {
  CONTENT_TYPE_LABEL,
  ENV_TYPE_LABEL,
  type ContentTypeId,
  type PlaceEnvType,
} from "../src/lib/tour/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local 없이도 --from-fixture는 동작해야 한다
}

const fromFixture = process.argv.slice(2).includes("--from-fixture");

function printSummary(places: Place[], mode: string): void {
  console.log(`\n===== 하리노트 시드 요약 (mode=${mode}) =====`);
  console.log(`총 ${places.length}건`);

  const byType = new Map<ContentTypeId, number>();
  const byEnv = new Map<PlaceEnvType, number>();
  const bySigungu = new Map<number | undefined, number>();
  for (const p of places) {
    byType.set(p.contentTypeId, (byType.get(p.contentTypeId) ?? 0) + 1);
    byEnv.set(p.envType, (byEnv.get(p.envType) ?? 0) + 1);
    bySigungu.set(p.sigunguCode, (bySigungu.get(p.sigunguCode) ?? 0) + 1);
  }

  console.log("\n[콘텐츠 유형별]");
  for (const [type, count] of [...byType].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${CONTENT_TYPE_LABEL[type]}(${type}): ${count}건`);
  }

  console.log("\n[환경 유형별]");
  for (const [env, count] of [...byEnv].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ENV_TYPE_LABEL[env]}(${env}): ${count}건`);
  }

  console.log(`\n[시군구 분포] ${bySigungu.size}개 시군구`);
  console.log("=".repeat(40));
}

/**
 * Supabase upsert 골격 — 인프라 연결 후 활성화 (현재 어디서도 호출하지 않음).
 * supabase-js 미설치 상태이므로 PostgREST REST API + service role 키로 upsert한다.
 */
export async function upsertPlacesToSupabase(places: Place[]): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local).",
    );
  }
  console.log(`(스텁) ${places.length}건 upsert 대기 — 인프라 연결 후 활성화`);
  // TODO(인프라 연결 후 활성화):
  // const rows = places.map((p) => ({
  //   content_id: p.contentId,
  //   content_type_id: p.contentTypeId,
  //   title: p.title,
  //   addr1: p.addr,
  //   area_code: 32,
  //   sigungu_code: p.sigunguCode ?? null,
  //   cat1: p.cat1 ?? null,
  //   cat2: p.cat2 ?? null,
  //   cat3: p.cat3 ?? null,
  //   lng: p.lng,
  //   lat: p.lat,
  //   first_image: p.imageUrl ?? null,
  //   tel: p.tel ?? null,
  //   env_type: p.envType,
  //   raw: p,
  // }));
  // const res = await fetch(`${url}/rest/v1/places?on_conflict=content_id`, {
  //   method: "POST",
  //   headers: {
  //     apikey: serviceKey,
  //     Authorization: `Bearer ${serviceKey}`,
  //     "Content-Type": "application/json",
  //     Prefer: "resolution=merge-duplicates",
  //   },
  //   body: JSON.stringify(rows),
  // });
  // if (!res.ok) throw new Error(`Supabase upsert 실패: HTTP ${res.status}`);
  throw new Error("Supabase 연동은 인프라 연결 후 활성화됩니다.");
}

async function main(): Promise<void> {
  let places: Place[];
  if (fromFixture) {
    const { gangwonPlaces } = await import("../src/fixtures/tour/gangwon");
    places = gangwonPlaces;
  } else {
    console.log("live 모드: TourAPI에서 강원 관광지를 수집합니다...");
    const { fetchGangwonPlaces } = await import("../src/lib/tour/client");
    places = await fetchGangwonPlaces();
  }

  printSummary(places, fromFixture ? "fixture" : "live");
  console.log(
    "[i] DB upsert는 Supabase 인프라 연결 후 활성화됩니다 (upsertPlacesToSupabase 골격 참고).",
  );
}

main().catch((err) => {
  console.error("[x] 시드 실패:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
