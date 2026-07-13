/**
 * TourAPI(KorService2) searchFestival2 — 강원 축제·행사 실시간 조회. 서버 전용.
 *
 * eventStartDate 파라미터는 "그 날짜에 진행 중(종료일 이후 포함) + 이후 시작"을
 * 돌려준다 (탐침으로 확인). 진행 중/다가옴 분류는 우리가 한다.
 *
 * ⚠️ 데이터 특성: 축제는 개최가 임박해야 등록되는 패턴 (2025 하반기 30건 vs
 * 2026 연초 시점 2건). 0건이면 화면은 섹션을 숨긴다 — 등록되면 자동 표시.
 *
 * 안정성 계약: 키 없으면 네트워크 0 + 빈 배열, 실패도 빈 배열. 날짜별 1시간 캐시.
 */
import { z } from "zod";
import { createTtlCache } from "@/lib/risk/cache";
import { toKmaDate } from "@/lib/date";

const BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

const apiString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v));

const festivalItemSchema = z.looseObject({
  contentid: apiString,
  title: apiString,
  addr1: apiString.optional(),
  eventstartdate: apiString,
  eventenddate: apiString,
  firstimage: apiString.optional(),
  mapx: apiString.optional(),
  mapy: apiString.optional(),
  sigungucode: apiString.optional(),
});

const festivalResponseSchema = z.looseObject({
  response: z.looseObject({
    header: z.looseObject({ resultCode: apiString }),
    body: z
      .looseObject({
        items: z
          .union([
            z.literal(""),
            z.looseObject({
              item: z
                .union([festivalItemSchema, z.array(festivalItemSchema)])
                .optional(),
            }),
          ])
          .optional(),
      })
      .optional(),
  }),
});

export interface Festival {
  contentId: number;
  title: string;
  addr: string;
  /** YYYYMMDD */
  start: string;
  /** YYYYMMDD */
  end: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  sigunguCode?: number;
  /** 대상 날짜에 진행 중인가 (false = 이후 시작 예정) */
  ongoing: boolean;
}

/** 응답 JSON + 대상 날짜(YYYYMMDD) → 진행 중 우선 정렬된 축제 목록 */
export function extractFestivals(json: unknown, targetYmd: string): Festival[] {
  const parsed = festivalResponseSchema.safeParse(json);
  if (!parsed.success) return [];
  if (parsed.data.response.header.resultCode !== "0000") return [];

  const items = parsed.data.response.body?.items;
  if (!items || typeof items === "string") return [];
  const raw = items.item === undefined ? [] : [items.item].flat();

  const festivals: Festival[] = [];
  for (const it of raw) {
    if (!it.eventstartdate || !it.eventenddate) continue;
    if (it.eventenddate < targetYmd) continue; // 이미 종료
    const lat = Number(it.mapy);
    const lng = Number(it.mapx);
    festivals.push({
      contentId: Number(it.contentid),
      title: it.title,
      addr: it.addr1 ?? "",
      start: it.eventstartdate,
      end: it.eventenddate,
      imageUrl: it.firstimage || undefined,
      lat: Number.isFinite(lat) && lat !== 0 ? lat : undefined,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : undefined,
      sigunguCode: it.sigungucode ? Number(it.sigungucode) : undefined,
      ongoing: it.eventstartdate <= targetYmd,
    });
  }

  // 진행 중 먼저, 그 안에서는 시작일 순
  return festivals.sort((a, b) => {
    if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
    return a.start.localeCompare(b.start);
  });
}

const cache = createTtlCache<Festival[]>(60 * 60 * 1000, 5 * 60 * 1000);

/** 대상 날짜(YYYY-MM-DD 기본 오늘)에 진행 중·다가오는 강원 축제 — 1시간 캐시 */
export async function fetchGangwonFestivals(dateISO?: string): Promise<Festival[]> {
  const key = process.env.TOUR_API_KEY;
  if (!key) return [];

  const targetYmd = dateISO
    ? toKmaDate(dateISO)
    : toKmaDate(new Date().toISOString().slice(0, 10));

  try {
    return await cache.get(targetYmd, async () => {
      const params = new URLSearchParams({
        serviceKey: key,
        MobileOS: "ETC",
        MobileApp: "harinote",
        _type: "json",
        areaCode: "32",
        eventStartDate: targetYmd,
        numOfRows: "100",
        pageNo: "1",
      });
      const res = await fetch(`${BASE_URL}/searchFestival2?${params.toString()}`);
      if (!res.ok) throw new Error(`searchFestival2 HTTP ${res.status}`);
      return extractFestivals(JSON.parse(await res.text()), targetYmd);
    });
  } catch {
    return [];
  }
}
