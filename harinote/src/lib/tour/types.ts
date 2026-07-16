/**
 * [계약 파일] TourAPI(KorService2) 타입 정의
 * 변경 시 데이터/점수엔진/UI 전 영역에 영향 — 수정은 메인 세션 승인 후에만.
 */

/** TourAPI contentTypeId: 12 관광지, 14 문화시설, 15 행사, 28 레포츠, 32 숙박, 38 쇼핑, 39 음식점 */
export type ContentTypeId = 12 | 14 | 15 | 28 | 32 | 38 | 39;

export const CONTENT_TYPE_LABEL: Record<ContentTypeId, string> = {
  12: "관광지",
  14: "문화시설",
  15: "행사/축제",
  28: "레포츠",
  32: "숙박",
  38: "쇼핑",
  39: "음식점",
};

/** 앱이 수집(시딩)하고 필터 탭으로 노출하는 콘텐츠 유형 — 단일 정의 */
export const SUPPORTED_CONTENT_TYPE_IDS = [
  12, 14, 39,
] as const satisfies readonly ContentTypeId[];

/** TourAPI 소분류: 카페/전통찻집 — 음식점(39)의 서브셋 필터 (gangwon.json 295건) */
export const CAT3_CAFE = "A05020900";
export const CAT3_CAFE_LABEL = "카페";

/** 유형 배지 라벨 — 카페 소분류(cat3)는 "음식점" 대신 "카페"로 표기 */
export function placeTypeLabel(
  place: Pick<Place, "contentTypeId" | "cat3">,
): string {
  return place.cat3 === CAT3_CAFE
    ? CAT3_CAFE_LABEL
    : CONTENT_TYPE_LABEL[place.contentTypeId];
}

/**
 * KorService2 areaBasedList2 응답 item 원본 형태 (모든 값이 문자열).
 * mapx = 경도(lng), mapy = 위도(lat) — 순서 주의!
 */
export interface TourApiPlaceItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  areacode?: string;
  sigungucode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  /** KorService2 신분류체계 */
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  mapx?: string;
  mapy?: string;
  mlevel?: string;
  firstimage?: string;
  firstimage2?: string;
  tel?: string;
  createdtime?: string;
  modifiedtime?: string;
  zipcode?: string;
  /** 저작권 유형 */
  cpyrhtDivCd?: string;
  /** 법정동 시도/시군구 코드 (KorService2) */
  lDongRegnCd?: string;
  lDongSignguCd?: string;
}

/**
 * 관광지 환경 유형 — TourAPI 카테고리(cat1~3)·명칭에서 자체 분류.
 * 안전 점수 계산 시 위험 요인 가중에 사용된다 (예: 수변형은 호우 위험 가중).
 */
export type PlaceEnvType =
  | "indoor" // 실내 (박물관·미술관·전시관 등)
  | "outdoor_water" // 계곡·하천·호수 수변형
  | "outdoor_mountain" // 산악·등산형
  | "outdoor_coast" // 해안·해변형
  | "outdoor_general"; // 일반 야외

export const ENV_TYPE_LABEL: Record<PlaceEnvType, string> = {
  indoor: "실내",
  outdoor_water: "계곡·수변",
  outdoor_mountain: "산악",
  outdoor_coast: "해안",
  outdoor_general: "야외",
};

/** 앱 전역에서 사용하는 정규화된 관광지 도메인 타입 */
export interface Place {
  contentId: number;
  contentTypeId: ContentTypeId;
  title: string;
  addr: string;
  sigunguCode?: number;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  lng: number;
  lat: number;
  imageUrl?: string;
  tel?: string;
  envType: PlaceEnvType;
  /** 짧은 소개 (fixture 수기 작성 or detailCommon2 overview) */
  overview?: string;
}
