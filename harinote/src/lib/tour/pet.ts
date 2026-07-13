/**
 * TourAPI(KorService2) detailPetTour2 — 반려동물 동반여행 정보 조회. 서버 전용.
 *
 * 안정성 계약 (overview.ts와 동일 원칙):
 * - TOUR_API_KEY가 없으면 네트워크 호출 없이 undefined ("키 없으면 네트워크 0")
 * - 호출 실패·정보 없음도 throw 없이 undefined — 상세 화면은 섹션을 숨김
 * - contentId당 24시간 캐시, 실패는 5분 뒤 재시도
 */
import { z } from "zod";
import { createTtlCache } from "@/lib/risk/cache";

const BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

const apiString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v));

const petItemSchema = z.looseObject({
  /** 동반 가능 동물 (예: "10kg 미만 소형견") */
  acmpyPsblCpam: apiString.optional(),
  /** 동반 유형 (예: "실외 동반 가능") */
  acmpyTypeCd: apiString.optional(),
  /** 동반 시 필요사항 (목줄, 캐리어 등) */
  acmpyNeedMtr: apiString.optional(),
  /** 기타 동반 정보 */
  etcAcmpyInfo: apiString.optional(),
});

const petResponseSchema = z.looseObject({
  response: z.looseObject({
    header: z.looseObject({ resultCode: apiString }),
    body: z
      .looseObject({
        items: z
          .union([
            z.literal(""),
            z.looseObject({
              item: z
                .union([petItemSchema, z.array(petItemSchema)])
                .optional(),
            }),
          ])
          .optional(),
      })
      .optional(),
  }),
});

export interface PetTourInfo {
  /** 동반 가능 동물 */
  allowed?: string;
  /** 동반 유형 (실내/실외 등) */
  type?: string;
  /** 필요사항 (목줄·캐리어 등) */
  needs?: string;
}

function clean(v: string | undefined): string | undefined {
  const t = v?.replace(/\s+/g, " ").trim();
  return t || undefined;
}

/** detailPetTour2 응답 JSON → 동반 정보. 의미 있는 필드가 하나도 없으면 undefined */
export function extractPetInfo(json: unknown): PetTourInfo | undefined {
  const parsed = petResponseSchema.safeParse(json);
  if (!parsed.success) return undefined;
  if (parsed.data.response.header.resultCode !== "0000") return undefined;

  const items = parsed.data.response.body?.items;
  if (!items || typeof items === "string") return undefined;
  const item = [items.item].flat()[0];
  if (!item) return undefined;

  const info: PetTourInfo = {
    allowed: clean(item.acmpyPsblCpam),
    type: clean(item.acmpyTypeCd),
    needs: clean(item.acmpyNeedMtr) ?? clean(item.etcAcmpyInfo),
  };
  return info.allowed || info.type || info.needs ? info : undefined;
}

const cache = createTtlCache<PetTourInfo | undefined>(
  24 * 60 * 60 * 1000,
  5 * 60 * 1000,
);

export async function fetchPlacePetInfo(
  contentId: number,
): Promise<PetTourInfo | undefined> {
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
      const res = await fetch(`${BASE_URL}/detailPetTour2?${params.toString()}`);
      if (!res.ok) throw new Error(`detailPetTour2 HTTP ${res.status}`);
      return extractPetInfo(JSON.parse(await res.text()));
    });
  } catch {
    return undefined;
  }
}
