/**
 * 산림청 국립산림과학원 산불위험예보정보(forestPointV2) 클라이언트.
 *
 * 데이터셋: "산림청 국립산림과학원_산불위험예보정보"
 * 활용신청: https://www.data.go.kr/data/15084817/openapi.do
 * 원출처: 국가산불위험예보시스템 https://forestfire.nifos.go.kr (3시간 간격 갱신)
 *
 * 계약: fetchForestFireLevel(sigunguCode) — TourAPI 시군 코드의 산불위험 4단계.
 * 시군구 목록을 1회 호출해 강원 행만 걸러 2시간 캐시하고, 시군에 매핑한다.
 * 응답의 meanavg(산불위험지수 1~100 평균)를 국가산불위험예보시스템 공식 등급
 * 경계(낮음 <51 / 다소높음 51~65 / 높음 66~85 / 매우높음 ≥86)로 1~4단계 변환.
 * 서비스 키 미설정·미승인(Forbidden)이면 throw — 호출부(live.ts)가 mock으로 폴백.
 * 서버 전용 — FOREST_API_KEY는 클라이언트 번들에 노출 금지.
 */
import { z } from "zod";
import { createTtlCache } from "./cache";

const BASE_URL =
  "https://apis.data.go.kr/1400377/forestPointV2/forestPointListSigunguSearchV2";

/**
 * TourAPI 강원(areaCode=32) sigunguCode → 행정표준코드 시군구 5자리.
 * 코드 출처: 행정안전부 행정표준코드(법정동코드 앞 5자리) — 2023-06 강원특별자치도
 * 출범으로 시도 코드가 42 → 51로 개편됐다. API 데이터가 아직 구코드(42xxx)일
 * 가능성에 대비해 조회 시 신·구 코드를 모두 시도한다 (구코드 = 신코드 - 9000).
 */
export const SIGUNGU_ADM_CODES: Record<number, { name: string; admCode: number }> = {
  1: { name: "강릉시", admCode: 51150 },
  2: { name: "고성군", admCode: 51820 },
  3: { name: "동해시", admCode: 51170 },
  4: { name: "삼척시", admCode: 51230 },
  5: { name: "속초시", admCode: 51210 },
  6: { name: "양구군", admCode: 51800 },
  7: { name: "양양군", admCode: 51830 },
  8: { name: "영월군", admCode: 51750 },
  9: { name: "원주시", admCode: 51130 },
  10: { name: "인제군", admCode: 51810 },
  11: { name: "정선군", admCode: 51770 },
  12: { name: "철원군", admCode: 51780 },
  13: { name: "춘천시", admCode: 51110 },
  14: { name: "태백시", admCode: 51190 },
  15: { name: "평창군", admCode: 51760 },
  16: { name: "홍천군", admCode: 51720 },
  17: { name: "화천군", admCode: 51790 },
  18: { name: "횡성군", admCode: 51730 },
};

/**
 * 산불위험지수(1~100) → 산림청 4단계.
 * 경계 출처: 국가산불위험예보시스템(forestfire.nifos.go.kr) 공식 등급 —
 * 낮음(<51) / 다소높음(51~65) / 높음(66~85) / 매우높음(≥86).
 */
export function forestIndexToLevel(index: number): 1 | 2 | 3 | 4 {
  if (index < 51) return 1;
  if (index < 66) return 2;
  if (index < 86) return 3;
  return 4;
}

/** 시군구 행 1건 — sigucode는 행정표준코드 5자리, meanavg는 위험지수 평균 */
export interface ForestPointRow {
  sigucode: string;
  sigun: string;
  meanavg: number;
}

// item이 1건이면 배열이 아닌 단일 객체로 오는 data.go.kr 관례에 대비
const forestItemSchema = z.object({
  doname: z.string().nullable().optional(),
  sigucode: z.coerce.string().nullable().optional(),
  sigun: z.string().nullable().optional(),
  meanavg: z.coerce.string().nullable().optional(),
});
type ForestItem = z.infer<typeof forestItemSchema>;

const forestResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string().optional(),
    }),
    body: z
      .object({
        items: z
          .object({
            item: z.union([z.array(forestItemSchema), forestItemSchema]),
          })
          .optional(),
      })
      .optional(),
  }),
});

function requireApiKey(): string {
  // 같은 data.go.kr 계정 키 — 전용 키가 없으면 공용 키(TOUR_API_KEY)를 재사용
  const key = process.env.FOREST_API_KEY ?? process.env.TOUR_API_KEY;
  if (!key) {
    throw new Error(
      "FOREST_API_KEY(또는 TOUR_API_KEY)가 설정되지 않았습니다. .env.local에 data.go.kr '일반 인증키(Decoding)' 값을 넣어주세요.",
    );
  }
  return key;
}

/** 원시 호출 — 전국 시군구 목록 1회 조회 후 강원 행만 반환. 스모크 스크립트에서도 사용 */
export async function fetchGangwonForestPointsRaw(): Promise<ForestPointRow[]> {
  const key = requireApiKey();
  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: "1",
    // 전국 시군구(~230행)를 1페이지로 수신 — upplocalcd(시도 2자리)는
    // 신·구 코드(51/42) 불확실성이 있어 쓰지 않고 로컬에서 강원만 거른다
    numOfRows: "300",
    _type: "json",
    excludeForecast: "1", // 72시간 예보 행 제외, 실황만
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  const text = await res.text();

  // 신형 게이트웨이는 인증 오류를 상태코드 + plain text로 준다 (401/403)
  if (res.status === 401) {
    throw new Error(
      "산불위험예보 API Unauthorized: 키를 인식하지 못합니다. 디코딩 키인지 확인하세요.",
    );
  }
  if (res.status === 403) {
    throw new Error(
      "산불위험예보 API Forbidden: 이 키에 '산림청 국립산림과학원_산불위험예보정보' 활용신청이 없습니다. https://www.data.go.kr/data/15084817/openapi.do 에서 신청하세요.",
    );
  }
  // 구형 게이트웨이 XML 오류(OpenAPI_ServiceResponse)도 방어
  if (text.trimStart().startsWith("<")) {
    const authMsg = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(text)?.[1];
    const reasonCode = /<returnReasonCode>([^<]*)<\/returnReasonCode>/.exec(text)?.[1];
    throw new Error(
      `산불위험예보 API가 XML 오류를 반환했습니다: ${authMsg ?? "원인 불명"} (returnReasonCode=${reasonCode ?? "?"})`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `산불위험예보 API 호출 실패: HTTP ${res.status} ${text.trim().slice(0, 100)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`산불위험예보 API 응답이 JSON이 아닙니다: ${text.trim().slice(0, 100)}`);
  }

  const parsed = forestResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `산불위험예보 API 응답이 예상 스키마와 다릅니다: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const { resultCode, resultMsg } = parsed.data.response.header;
  if (resultCode !== "00") {
    throw new Error(
      `산불위험예보 API 오류 응답: resultCode=${resultCode}, resultMsg=${resultMsg ?? "메시지 없음"}`,
    );
  }

  const raw = parsed.data.response.body?.items?.item ?? [];
  const items: ForestItem[] = Array.isArray(raw) ? raw : [raw];

  const rows: ForestPointRow[] = [];
  for (const item of items) {
    // 강원 행만 — doname 예: "강원특별자치도"·"강원도"
    if (!item.doname?.includes("강원")) continue;
    const meanavg = Number(item.meanavg);
    if (item.meanavg == null || item.meanavg === "" || !Number.isFinite(meanavg)) {
      continue;
    }
    rows.push({
      sigucode: item.sigucode ?? "",
      sigun: item.sigun ?? "",
      meanavg,
    });
  }
  return rows;
}

/** 전국 1회 호출 2시간 캐시 — 원본이 3시간 간격 갱신이다 (실패는 5분 후 재시도) */
const cache = createTtlCache<ForestPointRow[]>(2 * 60 * 60 * 1000, 5 * 60 * 1000);

function fetchGangwonForestPoints(): Promise<ForestPointRow[]> {
  return cache.get("gangwon", fetchGangwonForestPointsRaw);
}

/** 강원 행 목록에서 시군의 위험지수 선택 (순수 함수 — 테스트용 분리) */
export function pickForestIndexForSigungu(
  rows: ForestPointRow[],
  sigunguCode: number,
): number | undefined {
  const region = SIGUNGU_ADM_CODES[sigunguCode];
  if (region) {
    // 1순위: 행정코드 매칭 (신코드 51xxx → 구코드 42xxx 순)
    for (const code of [region.admCode, region.admCode - 9000]) {
      const hit = rows.find((r) => r.sigucode === String(code));
      if (hit) return hit.meanavg;
    }
    // 2순위: 시군 명칭 매칭 — 강원 행만 있으므로 타 시도 동명(경남 고성군 등) 충돌 없음
    const base = region.name.replace(/[시군]$/, "");
    const byName = rows.find((r) => r.sigun === region.name || r.sigun.startsWith(base));
    if (byName) return byName.meanavg;
  }
  // 최종 폴백: 강원 전체 평균 (해당 시군 행 결측 시)
  if (rows.length === 0) return undefined;
  const sum = rows.reduce((acc, r) => acc + r.meanavg, 0);
  return sum / rows.length;
}

/**
 * 시군의 산불위험 4단계 (1 낮음 ~ 4 매우높음).
 * 유효한 행이 하나도 없으면 throw — 호출부(live.ts)가 mock으로 폴백한다.
 */
export async function fetchForestFireLevel(sigunguCode: number): Promise<1 | 2 | 3 | 4> {
  const rows = await fetchGangwonForestPoints();
  const index = pickForestIndexForSigungu(rows, sigunguCode);
  if (index === undefined) {
    throw new Error("산불위험예보 응답에 강원 시군구 유효값이 없습니다.");
  }
  return forestIndexToLevel(index);
}
