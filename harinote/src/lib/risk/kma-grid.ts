/**
 * 기상청 단기예보 격자 변환 — 위경도 → 격자(nx, ny).
 * 기상청 공식 LCC(Lambert Conformal Conic) DFS 공식의 정방향(toXY)만 구현.
 * 검증쌍: 서울시청(37.5665, 126.9780)→(60,127), 춘천시청→(73,134), 강릉시청→(92,131)
 */

const RE = 6371.00877; // 지구 반경 km
const GRID = 5.0; // 격자 간격 km
const SLAT1 = 30.0; // 표준위도 1
const SLAT2 = 60.0; // 표준위도 2
const OLON = 126.0; // 기준점 경도
const OLAT = 38.0; // 기준점 위도
const XO = 43; // 기준점 X좌표 (격자)
const YO = 136; // 기준점 Y좌표 (격자)

const DEGRAD = Math.PI / 180.0;

// 투영 상수는 입력과 무관 — 모듈 로드 시 1회 계산
const re = RE / GRID;
const slat1 = SLAT1 * DEGRAD;
const slat2 = SLAT2 * DEGRAD;
const olon = OLON * DEGRAD;
const olat = OLAT * DEGRAD;

const snRaw =
  Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(snRaw);
const sfRaw = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
const sf = (Math.pow(sfRaw, sn) * Math.cos(slat1)) / sn;
const roRaw = Math.tan(Math.PI * 0.25 + olat * 0.5);
const ro = (re * sf) / Math.pow(roRaw, sn);

/** 위경도 → 기상청 단기예보 격자 좌표 (순수 함수) */
export function latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}
