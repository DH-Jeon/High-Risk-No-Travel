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
