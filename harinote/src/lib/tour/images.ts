/**
 * TourAPI(KorService2) detailImage2 — 관광지 추가 사진 조회. 서버 전용.
 *
 * 안정성 계약 (risk/live.ts와 동일 원칙):
 * - TOUR_API_KEY가 없으면 네트워크 호출 없이 빈 배열 ("키 없으면 네트워크 0")
 * - 호출 실패·오류 응답도 throw 없이 빈 배열 — 상세 화면은 대표사진(imageUrl)으로 폴백
 * - contentId당 1시간 프로미스 캐시, 실패는 5분 뒤 재시도
 */
import { z } from "zod";
import { createTtlCache } from "@/lib/risk/cache";

const BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

/** 갤러리 최대 표시 장수 — 과다 스크롤 방지 */
export const MAX_GALLERY_IMAGES = 8;

const apiString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v));

const imageItemSchema = z.looseObject({
  originimgurl: apiString.optional(),
  smallimageurl: apiString.optional(),
});

/** 결과가 없으면 items가 빈 문자열 ""로 온다 (목록 API와 동일한 특성) */
const imageResponseSchema = z.looseObject({
  response: z.looseObject({
    header: z.looseObject({ resultCode: apiString }),
    body: z
      .looseObject({
        items: z
          .union([
            z.literal(""),
            z.looseObject({
              item: z
                .union([imageItemSchema, z.array(imageItemSchema)])
                .optional(),
            }),
          ])
          .optional(),
      })
      .optional(),
  }),
});

/** detailImage2 응답 JSON → 이미지 URL 목록 (중복·비http 제외, 원본 우선) */
export function extractImageUrls(json: unknown): string[] {
  const parsed = imageResponseSchema.safeParse(json);
  if (!parsed.success) return [];
  if (parsed.data.response.header.resultCode !== "0000") return [];

  const items = parsed.data.response.body?.items;
  if (!items || typeof items === "string") return [];
  const raw = items.item === undefined ? [] : [items.item].flat();

  const urls: string[] = [];
  for (const item of raw) {
    const url = item.originimgurl || item.smallimageurl || "";
    if (!/^https?:\/\//.test(url)) continue;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

const cache = createTtlCache<string[]>(60 * 60 * 1000, 5 * 60 * 1000);

export async function fetchPlaceImages(contentId: number): Promise<string[]> {
  const key = process.env.TOUR_API_KEY;
  if (!key) return [];

  try {
    return await cache.get(String(contentId), async () => {
      const params = new URLSearchParams({
        serviceKey: key,
        MobileOS: "ETC",
        MobileApp: "harinote",
        _type: "json",
        contentId: String(contentId),
        imageYN: "Y",
        numOfRows: String(MAX_GALLERY_IMAGES),
        pageNo: "1",
      });
      const res = await fetch(`${BASE_URL}/detailImage2?${params.toString()}`);
      if (!res.ok) throw new Error(`detailImage2 HTTP ${res.status}`);
      const text = await res.text();
      // 키 오류 등은 XML(OpenAPI_ServiceResponse)로 온다 → 파싱 실패로 취급
      return extractImageUrls(JSON.parse(text)).slice(0, MAX_GALLERY_IMAGES);
    });
  } catch {
    return [];
  }
}
