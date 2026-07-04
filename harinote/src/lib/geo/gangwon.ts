/**
 * 강원 18개 시군 경계 정적 데이터 (scripts/build-gangwon-geo.ts 산출물).
 * 좌표는 Leaflet 순서 [lat, lng], 소수 4자리(≈11m) — 시군 단위 시각화에 충분.
 * 원본: southkorea-maps kostat 2013 simplified GeoJSON.
 */
import raw from "@/data/gangwon-geo.json";

export type LatLngTuple = [number, number];

export interface GangwonRegionGeo {
  sigunguCode: number;
  name: string;
  /** 폴리곤 링 배열 — [0]이 외곽, 나머지는 구멍 */
  rings: LatLngTuple[][];
}

export interface GangwonGeo {
  /** 강원도 도 경계 외곽 링들 — 도 밖을 가리는 마스크의 구멍으로 사용 */
  maskHoles: LatLngTuple[][];
  regions: GangwonRegionGeo[];
}

export const GANGWON_GEO = raw as GangwonGeo;
