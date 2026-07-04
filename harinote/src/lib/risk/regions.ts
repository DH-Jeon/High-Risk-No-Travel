/**
 * 강원 18개 시군 대표점 — 시군청 소재지 좌표 수기 테이블.
 *
 * 설계: 관광지 2,091곳을 격자별로 호출하면 쿼터·속도 폭탄이므로,
 * 시군당 대표점 1곳으로 기상청 단기예보를 조회하고 1시간 캐시로 전체를 커버한다
 * (시간당 최대 기상청 18회 + AirKorea 1회). 기상 해상도가 시군 단위인 것은
 * 점수 엔진의 환경유형 가중(ENV_WEIGHT)으로 보정하는 설계다.
 *
 * 키는 TourAPI 강원(areaCode=32) sigunguCode.
 */

export interface RegionSeat {
  name: string;
  lat: number;
  lng: number;
}

/** TourAPI sigunguCode → 시군청 소재지 위경도 */
export const SIGUNGU_SEATS: Record<number, RegionSeat> = {
  1: { name: "강릉시", lat: 37.7519, lng: 128.8761 },
  2: { name: "고성군", lat: 38.3806, lng: 128.4678 },
  3: { name: "동해시", lat: 37.5247, lng: 129.1143 },
  4: { name: "삼척시", lat: 37.4499, lng: 129.1651 },
  5: { name: "속초시", lat: 38.207, lng: 128.5918 },
  6: { name: "양구군", lat: 38.1057, lng: 127.9899 },
  7: { name: "양양군", lat: 38.0752, lng: 128.619 },
  8: { name: "영월군", lat: 37.1837, lng: 128.4614 },
  9: { name: "원주시", lat: 37.3387, lng: 127.9201 },
  10: { name: "인제군", lat: 38.0697, lng: 128.1707 },
  11: { name: "정선군", lat: 37.3806, lng: 128.6608 },
  12: { name: "철원군", lat: 38.1466, lng: 127.3132 },
  13: { name: "춘천시", lat: 37.8813, lng: 127.7298 },
  14: { name: "태백시", lat: 37.1641, lng: 128.9856 },
  15: { name: "평창군", lat: 37.3708, lng: 128.3901 },
  16: { name: "홍천군", lat: 37.6969, lng: 127.8887 },
  17: { name: "화천군", lat: 38.1062, lng: 127.7082 },
  18: { name: "횡성군", lat: 37.4917, lng: 127.985 },
};
