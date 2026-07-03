/**
 * TourAPI 키 스모크 테스트 — 실행: pnpm check:tourapi
 * .env.local의 TOUR_API_KEY로 areaBasedList2 1페이지를 호출해
 * resultCode·zod 파싱·필드 diff(알려지지 않은/누락 필드)를 확인한다.
 * 외부 의존성 없음 (Node 내장 process.loadEnvFile 사용, dotenv 금지).
 */
import {
  extractItems,
  extractTotalCount,
  KNOWN_ITEM_FIELDS,
  tourApiListResponseSchema,
} from "../src/lib/tour/schema";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("[i] .env.local이 없습니다 — 셸 환경변수만 사용합니다.");
}

const BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

async function main(): Promise<void> {
  const key = process.env.TOUR_API_KEY;
  if (!key) {
    console.error(
      "[x] TOUR_API_KEY가 없습니다. .env.local에 data.go.kr '일반 인증키(Decoding)' 값을 넣어주세요 (.env.example 참고).",
    );
    process.exitCode = 1;
    return;
  }

  const params = new URLSearchParams({
    serviceKey: key,
    MobileOS: "ETC",
    MobileApp: "harinote",
    _type: "json",
    areaCode: "32", // 강원
    contentTypeId: "12", // 관광지
    numOfRows: "5",
    pageNo: "1",
  });
  const url = `${BASE_URL}/areaBasedList2?${params.toString()}`;
  console.log("[1] areaBasedList2 호출 중... (areaCode=32, contentTypeId=12)");

  const res = await fetch(url);
  console.log(`    HTTP ${res.status}`);
  const text = await res.text();

  // 게이트웨이 텍스트 오류: 키 미인식(Unauthorized) / 권한 미반영(Forbidden)
  if (!res.ok && !text.trimStart().startsWith("<")) {
    console.error(`[x] 게이트웨이 오류 응답: ${text.trim().slice(0, 100)}`);
    if (/forbidden/i.test(text)) {
      console.error(
        "    → 키는 인식되지만 이 서비스 사용 권한이 아직 없습니다.\n" +
          "      발급 직후라면 반영까지 1~2시간 대기 후 재시도하세요.\n" +
          "      계속 실패하면 발급처에서 '국문 관광정보'(KorService2) 활용 신청이 승인됐는지 확인하세요.",
      );
    } else if (/unauthorized/i.test(text)) {
      console.error(
        "    → 키를 인식하지 못합니다. 복사 누락/공백 여부와 디코딩 키인지 확인하세요.",
      );
    }
    process.exitCode = 1;
    return;
  }

  if (text.trimStart().startsWith("<")) {
    const authMsg = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(text)?.[1];
    const reasonCode = /<returnReasonCode>([^<]*)<\/returnReasonCode>/.exec(
      text,
    )?.[1];
    console.error(
      `[x] XML 오류 응답(OpenAPI_ServiceResponse): ${authMsg ?? "원인 불명"} (returnReasonCode=${reasonCode ?? "?"})`,
    );
    console.error(
      "    → 키 등록 직후라면 반영까지 최대 1시간 소요. 디코딩 키인지도 확인하세요.",
    );
    process.exitCode = 1;
    return;
  }

  const parsed = tourApiListResponseSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    console.error("[x] zod 파싱 실패:");
    for (const issue of parsed.error.issues.slice(0, 10)) {
      console.error(`    - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const { resultCode, resultMsg } = parsed.data.response.header;
  console.log(`[2] resultCode=${resultCode} (${resultMsg ?? "-"})`);
  if (resultCode !== "0000") {
    console.error("[x] 정상 코드(0000)가 아닙니다.");
    process.exitCode = 1;
    return;
  }

  const items = extractItems(parsed.data);
  const totalCount = extractTotalCount(parsed.data);
  console.log(`[3] zod 파싱 OK — totalCount=${totalCount}, 수신 ${items.length}건`);
  for (const item of items) {
    console.log(`    - ${item.contentid} ${item.title}`);
  }

  if (items.length === 0) {
    console.log("[i] 항목이 없어 필드 diff를 건너뜁니다.");
    return;
  }

  // 필드 diff: 스키마가 아는 필드 vs 실제 응답 필드
  const actualFields = new Set<string>();
  for (const item of items) {
    for (const field of Object.keys(item)) actualFields.add(field);
  }
  const known = new Set(KNOWN_ITEM_FIELDS);
  const unknownFields = [...actualFields].filter((f) => !known.has(f));
  const missingFields = KNOWN_ITEM_FIELDS.filter((f) => !actualFields.has(f));

  console.log("[4] 필드 diff (스키마 기준)");
  console.log(
    `    스키마에 없는 응답 필드: ${unknownFields.length ? unknownFields.join(", ") : "없음"}`,
  );
  console.log(
    `    응답에 없는 스키마 필드: ${missingFields.length ? missingFields.join(", ") : "없음"}`,
  );
  console.log("[v] 스모크 테스트 통과 — 키가 정상 동작합니다.");
}

main().catch((err) => {
  console.error("[x] 스모크 테스트 실패:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
