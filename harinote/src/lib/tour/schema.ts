/**
 * TourAPI(KorService2) 응답 zod 스키마.
 * 원칙: 관대하게(looseObject, 필드 누락 허용) 받되 필수 필드(contentid, title)는 엄격히.
 * 파싱 결과는 계약 타입 TourApiPlaceItem에 그대로 대입 가능하다.
 */
import { z } from "zod";
import type { TourApiPlaceItem } from "./types";

/** TourAPI는 간혹 숫자·빈 문자열을 섞어 내려준다 → 문자열로 통일 */
const apiString = z.union([z.string(), z.number()]).transform((v) => String(v));
const optionalApiString = apiString.optional();

/** areaBasedList2 등 목록 응답의 item 1건 */
export const tourApiPlaceItemSchema = z.looseObject({
  contentid: apiString.refine((v) => v.length > 0, "contentid가 비어 있습니다"),
  contenttypeid: apiString.refine(
    (v) => v.length > 0,
    "contenttypeid가 비어 있습니다",
  ),
  title: apiString.refine((v) => v.length > 0, "title이 비어 있습니다"),
  addr1: optionalApiString,
  addr2: optionalApiString,
  areacode: optionalApiString,
  sigungucode: optionalApiString,
  cat1: optionalApiString,
  cat2: optionalApiString,
  cat3: optionalApiString,
  lclsSystm1: optionalApiString,
  lclsSystm2: optionalApiString,
  lclsSystm3: optionalApiString,
  mapx: optionalApiString,
  mapy: optionalApiString,
  mlevel: optionalApiString,
  firstimage: optionalApiString,
  firstimage2: optionalApiString,
  tel: optionalApiString,
  createdtime: optionalApiString,
  modifiedtime: optionalApiString,
  // 실응답 필드 diff로 확인된 추가 필드 (2026-07 check-tourapi)
  zipcode: optionalApiString,
  cpyrhtDivCd: optionalApiString, // 저작권 유형
  lDongRegnCd: optionalApiString, // 법정동 시도 코드
  lDongSignguCd: optionalApiString, // 법정동 시군구 코드
});

/** check-tourapi 스크립트의 필드 diff에 사용 */
export const KNOWN_ITEM_FIELDS = Object.keys(tourApiPlaceItemSchema.shape);

const headerSchema = z.looseObject({
  resultCode: apiString,
  resultMsg: optionalApiString,
});

/** 결과가 없으면 items가 빈 문자열 ""로 온다 (주의) */
const itemsSchema = z.union([
  z.literal(""),
  z.looseObject({
    item: z
      .union([tourApiPlaceItemSchema, z.array(tourApiPlaceItemSchema)])
      .optional(),
  }),
]);

const bodySchema = z.looseObject({
  items: itemsSchema.optional(),
  numOfRows: z.coerce.number().optional(),
  pageNo: z.coerce.number().optional(),
  totalCount: z.coerce.number().optional(),
});

/** KorService2 목록 오퍼레이션 공통 응답 */
export const tourApiListResponseSchema = z.looseObject({
  response: z.looseObject({
    header: headerSchema,
    body: bodySchema.optional(),
  }),
});

export type TourApiListResponse = z.infer<typeof tourApiListResponseSchema>;

/** 파싱된 응답에서 item 배열을 안전하게 꺼낸다 (없으면 빈 배열, 1건이면 배열로 감쌈) */
export function extractItems(parsed: TourApiListResponse): TourApiPlaceItem[] {
  const items = parsed.response.body?.items;
  if (items === undefined || items === "") return [];
  const item = items.item;
  if (item === undefined) return [];
  return Array.isArray(item) ? item : [item];
}

/** 응답 본문의 totalCount (없으면 0) */
export function extractTotalCount(parsed: TourApiListResponse): number {
  return parsed.response.body?.totalCount ?? 0;
}
