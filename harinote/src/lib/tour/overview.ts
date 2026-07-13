/**
 * TourAPI(KorService2) detailCommon2 — 관광지 소개문(overview) 조회. 서버 전용.
 *
 * 안정성 계약 (images.ts와 동일 원칙):
 * - TOUR_API_KEY가 없으면 네트워크 호출 없이 undefined ("키 없으면 네트워크 0")
 * - 호출 실패·오류 응답도 throw 없이 undefined — 상세 화면은 소개 섹션을 숨김
 * - contentId당 24시간 캐시(소개문은 거의 안 변함), 실패는 5분 뒤 재시도
 */
import { z } from "zod";
import { createTtlCache } from "@/lib/risk/cache";

const BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

const apiString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v));

const commonItemSchema = z.looseObject({
  overview: apiString.optional(),
});

const commonResponseSchema = z.looseObject({
  response: z.looseObject({
    header: z.looseObject({ resultCode: apiString }),
    body: z
      .looseObject({
        items: z
          .union([
            z.literal(""),
            z.looseObject({
              item: z
                .union([commonItemSchema, z.array(commonItemSchema)])
                .optional(),
            }),
          ])
          .optional(),
      })
      .optional(),
  }),
});

/** detailCommon2 응답 JSON → 소개문 (HTML 태그·과잉 공백 제거) */
export function extractOverview(json: unknown): string | undefined {
  const parsed = commonResponseSchema.safeParse(json);
  if (!parsed.success) return undefined;
  if (parsed.data.response.header.resultCode !== "0000") return undefined;

  const items = parsed.data.response.body?.items;
  if (!items || typeof items === "string") return undefined;
  const item = [items.item].flat()[0];
  const raw = item?.overview?.trim();
  if (!raw) return undefined;

  const text = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

const cache = createTtlCache<string | undefined>(
  24 * 60 * 60 * 1000,
  5 * 60 * 1000,
);

export async function fetchPlaceOverview(
  contentId: number,
): Promise<string | undefined> {
  const key = process.env.TOUR_API_KEY;
  if (!key) return undefined;

  try {
    return await cache.get(String(contentId), async () => {
      const params = new URLSearchParams({
        serviceKey: key,
        MobileOS: "ETC",
        MobileApp: "harinote",
        _type: "json",
        contentId: String(contentId),
      });
      const res = await fetch(`${BASE_URL}/detailCommon2?${params.toString()}`);
      if (!res.ok) throw new Error(`detailCommon2 HTTP ${res.status}`);
      // 키 오류 등은 XML로 온다 → JSON.parse 실패로 취급
      return extractOverview(JSON.parse(await res.text()));
    });
  } catch {
    return undefined;
  }
}
