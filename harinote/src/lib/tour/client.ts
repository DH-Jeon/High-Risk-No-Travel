/**
 * TourAPI(KorService2) 클라이언트.
 * 계약: fetchGangwonPlaces() — 강원(areaCode=32) 관광지를 Place[]로 반환.
 * 서버 전용 — TOUR_API_KEY는 클라이언트 번들에 노출 금지.
 * 외부 의존성 없음 (Node 내장 fetch 사용).
 */
import type { ContentTypeId, Place, TourApiPlaceItem } from "./types";
import { CONTENT_TYPE_LABEL, SUPPORTED_CONTENT_TYPE_IDS } from "./types";
import { classifyEnvType } from "./classify";
import {
  extractItems,
  extractTotalCount,
  tourApiListResponseSchema,
} from "./schema";

const BASE_URL = "https://apis.data.go.kr/B551011/KorService2";
const GANGWON_AREA_CODE = "32";
/** 시딩 대상: 12 관광지, 14 문화시설, 39 음식점 */
const TARGET_CONTENT_TYPES: readonly ContentTypeId[] = SUPPORTED_CONTENT_TYPE_IDS;
/** KorService2 최대 100건/페이지 */
const NUM_OF_ROWS = 100;

interface PageResult {
  items: TourApiPlaceItem[];
  totalCount: number;
}

function requireApiKey(): string {
  const key = process.env.TOUR_API_KEY;
  if (!key) {
    throw new Error(
      "TOUR_API_KEY가 설정되지 않았습니다. .env.local에 data.go.kr '일반 인증키(Decoding)' 값을 넣어주세요 (.env.example 참고).",
    );
  }
  return key;
}

/** areaBasedList2 1페이지 호출 + zod 검증. 오류 시 resultCode·메시지를 포함해 throw. */
export async function fetchAreaBasedPage(
  key: string,
  contentTypeId: number,
  pageNo: number,
  numOfRows: number = NUM_OF_ROWS,
): Promise<PageResult> {
  const params = new URLSearchParams({
    serviceKey: key,
    MobileOS: "ETC",
    MobileApp: "harinote",
    _type: "json",
    areaCode: GANGWON_AREA_CODE,
    contentTypeId: String(contentTypeId),
    numOfRows: String(numOfRows),
    pageNo: String(pageNo),
  });
  const url = `${BASE_URL}/areaBasedList2?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (cause) {
    throw new Error(
      `TourAPI 호출에 실패했습니다 (네트워크 오류, contentTypeId=${contentTypeId}, pageNo=${pageNo}).`,
      { cause },
    );
  }
  if (!res.ok) {
    throw new Error(
      `TourAPI 호출이 실패했습니다: HTTP ${res.status} (contentTypeId=${contentTypeId}, pageNo=${pageNo})`,
    );
  }

  const text = await res.text();

  // 키 오류 등은 _type=json을 무시하고 XML(OpenAPI_ServiceResponse)로 온다
  if (text.trimStart().startsWith("<")) {
    const authMsg = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(text)?.[1];
    const errMsg = /<errMsg>([^<]*)<\/errMsg>/.exec(text)?.[1];
    const reasonCode = /<returnReasonCode>([^<]*)<\/returnReasonCode>/.exec(
      text,
    )?.[1];
    throw new Error(
      `TourAPI가 XML 오류를 반환했습니다: ${errMsg ?? "OpenAPI_ServiceResponse"} / ${
        authMsg ?? "원인 불명"
      } (returnReasonCode=${reasonCode ?? "?"}). 서비스 키를 확인하세요.`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `TourAPI 응답을 JSON으로 파싱할 수 없습니다: ${text.slice(0, 200)}`,
    );
  }

  const parsed = tourApiListResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `TourAPI 응답이 예상 스키마와 다릅니다: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const { resultCode, resultMsg } = parsed.data.response.header;
  if (resultCode !== "0000") {
    throw new Error(
      `TourAPI 오류 응답: resultCode=${resultCode}, resultMsg=${resultMsg ?? "메시지 없음"}`,
    );
  }

  return {
    items: extractItems(parsed.data),
    totalCount: extractTotalCount(parsed.data),
  };
}

const VALID_CONTENT_TYPES = new Set<number>(
  Object.keys(CONTENT_TYPE_LABEL).map(Number),
);

/**
 * TourAPI 원본 item → Place 정규화.
 * 좌표가 없거나 숫자가 아니면 null (지도·안전점수 계산 불가 항목 제외).
 */
export function toPlace(item: TourApiPlaceItem): Place | null {
  const contentId = Number(item.contentid);
  const contentTypeId = Number(item.contenttypeid);
  const lng = Number(item.mapx);
  const lat = Number(item.mapy);

  if (!Number.isFinite(contentId) || contentId <= 0) return null;
  if (!VALID_CONTENT_TYPES.has(contentTypeId)) return null;
  if (!item.mapx || !item.mapy) return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng === 0 || lat === 0) return null;

  const sigunguCode = item.sigungucode ? Number(item.sigungucode) : NaN;
  const addr = [item.addr1, item.addr2]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" ");

  return {
    contentId,
    contentTypeId: contentTypeId as ContentTypeId,
    title: item.title,
    addr,
    ...(Number.isFinite(sigunguCode) ? { sigunguCode } : {}),
    ...(item.cat1 ? { cat1: item.cat1 } : {}),
    ...(item.cat2 ? { cat2: item.cat2 } : {}),
    ...(item.cat3 ? { cat3: item.cat3 } : {}),
    lng,
    lat,
    ...(item.firstimage ? { imageUrl: item.firstimage } : {}),
    ...(item.tel ? { tel: item.tel } : {}),
    envType: classifyEnvType(item),
  };
}

/**
 * 강원(areaCode=32) 관광지 전체 수집:
 * contentTypeId 12/14/39 각각 areaBasedList2를 totalCount 기반으로 전 페이지 순회.
 * 개발계정 쿼터(1,000건/일) 주의 — 페이지당 100건씩 최소 호출.
 */
export async function fetchGangwonPlaces(): Promise<Place[]> {
  const key = requireApiKey();
  const places: Place[] = [];

  for (const contentTypeId of TARGET_CONTENT_TYPES) {
    let pageNo = 1;
    for (;;) {
      const { items, totalCount } = await fetchAreaBasedPage(
        key,
        contentTypeId,
        pageNo,
      );
      for (const item of items) {
        const place = toPlace(item);
        if (place) places.push(place);
      }
      // 페이지가 가득 차지 않으면 마지막 페이지 — totalCount 누락(0) 응답에도 안전
      if (items.length < NUM_OF_ROWS) break;
      if (totalCount > 0 && pageNo * NUM_OF_ROWS >= totalCount) break;
      pageNo += 1;
    }
  }

  return places;
}
