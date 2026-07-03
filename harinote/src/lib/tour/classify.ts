/**
 * 관광지 환경 유형(PlaceEnvType) 휴리스틱 분류.
 * 1순위: TourAPI 구분류 카테고리 코드(cat1~3), 2순위: 명칭(title) 키워드.
 * 안전 점수 엔진이 유형별 위험 가중(예: 수변형 → 호우 위험)에 사용한다.
 */
import type { PlaceEnvType } from "./types";

export interface ClassifiableItem {
  cat1?: string;
  cat2?: string;
  cat3?: string;
  title: string;
}

/* --- TourAPI 구분류 코드 (cat1 A01 = 자연, A02 = 인문, A05 = 음식) --- */

/** 자연 수변: 폭포·계곡·호수·강 */
const WATER_CAT3 = new Set([
  "A01010800", // 폭포
  "A01010900", // 계곡
  "A01011700", // 호수
  "A01011800", // 강
]);

/** 해안: 해안절경·해수욕장·항구/포구·등대 */
const COAST_CAT3 = new Set([
  "A01011100", // 해안절경
  "A01011200", // 해수욕장
  "A01011400", // 항구/포구
  "A01011600", // 등대
]);

/** 산악: 국/도/군립공원·산·자연휴양림 */
const MOUNTAIN_CAT3 = new Set([
  "A01010100", // 국립공원
  "A01010200", // 도립공원
  "A01010300", // 군립공원
  "A01010400", // 산
  "A01010600", // 자연휴양림
]);

/** 동굴은 기상 영향이 적어 실내로 취급 */
const INDOOR_CAT3 = new Set([
  "A01011900", // 동굴
]);

/* --- 명칭 키워드 (코드가 없거나 불확실할 때 보조 판정) --- */

const INDOOR_KEYWORDS = [
  "박물관",
  "미술관",
  "기념관",
  "전시",
  "과학관",
  "체험관",
  "아쿠아리움",
  "뮤지엄",
  "도서관",
  "극장",
  "공연",
  "동굴",
];

/**
 * 수변 키워드. "섬"은 강원 특성상 하천 섬(남이섬 등)이 대부분이라 수변으로 본다.
 * 참고: "-강"·"-호"로 끝나는 명칭(소양강, 경포호 등)도 수변 판정.
 */
const WATER_KEYWORDS = ["계곡", "폭포", "호수", "저수지", "댐", "섬"];

const COAST_KEYWORDS = [
  "해수욕장",
  "해변",
  "해안",
  "등대",
  "방파제",
  "바다",
  "항",
];

const MOUNTAIN_KEYWORDS = ["산", "봉", "령", "고개", "등산", "휴양림", "숲"];

function includesAny(title: string, keywords: string[]): boolean {
  return keywords.some((kw) => title.includes(kw));
}

/**
 * 카테고리 코드 → 명칭 키워드 순으로 환경 유형을 판정한다.
 * 키워드 우선순위: 실내 > 수변 > 해안 > 산악 (예: "삼악산 호수케이블카" → 수변).
 */
export function classifyEnvType(item: ClassifiableItem): PlaceEnvType {
  const { cat1, cat2, cat3, title } = item;

  // 1) 카테고리 코드 기반
  if (cat1 === "A05") return "indoor"; // 음식점은 실내 시설로 취급
  if (cat2 === "A0206") return "indoor"; // 인문 > 문화시설 (박물관·미술관·전시 계열)
  if (cat3) {
    if (INDOOR_CAT3.has(cat3)) return "indoor";
    if (WATER_CAT3.has(cat3)) return "outdoor_water";
    if (COAST_CAT3.has(cat3)) return "outdoor_coast";
    if (MOUNTAIN_CAT3.has(cat3)) return "outdoor_mountain";
  }

  // 2) 명칭 키워드 보조 판정
  if (includesAny(title, INDOOR_KEYWORDS)) return "indoor";
  if (
    includesAny(title, WATER_KEYWORDS) ||
    title.endsWith("강") ||
    title.endsWith("호")
  ) {
    return "outdoor_water";
  }
  if (includesAny(title, COAST_KEYWORDS)) return "outdoor_coast";
  if (includesAny(title, MOUNTAIN_KEYWORDS)) return "outdoor_mountain";

  return "outdoor_general";
}
