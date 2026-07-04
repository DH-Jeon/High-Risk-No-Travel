/**
 * 응급의료 접근성 — 최근접 응급의료기관 거리 실계산.
 *
 * 데이터: src/data/hospitals.gangwon.json — 강원 응급의료기관 22곳(권역·지역응급의료센터/기관)
 * 좌표 내장. scripts/build-hospitals.ts가 국립중앙의료원 헬스맵 데이터셋에서 생성·검증한다.
 * 병원 위치는 정적 지리 데이터이므로 실시간 API 대신 내장 JSON + Haversine 최근접
 * 계산을 쓴다 (ADR-004 무장애 원칙 — 네트워크·키 불필요, 실패 모드 없음).
 *
 * 계산량: 관광지 1곳당 병원 22곳 순회(순수 산술)라 부담이 없지만,
 * 좌표가 불변이므로 contentId 기반으로 메모이즈한다.
 */
import hospitalsJson from "@/data/hospitals.gangwon.json";
import { haversineKm } from "@/lib/reco/distance";

interface Hospital {
  name: string;
  lat: number;
  lng: number;
  sigunguCode?: number;
  source: string;
}

/** 로드 시 1회 정합성 필터 — 파일 손상 시 빈 배열이 되고 호출부는 mock을 유지한다 */
const HOSPITALS: Hospital[] = (Array.isArray(hospitalsJson) ? (hospitalsJson as Hospital[]) : []).filter(
  (h) => Number.isFinite(h?.lat) && Number.isFinite(h?.lng),
);

/** contentId → 최근접 거리(km) 메모 — 관광지 좌표는 불변이므로 무기한 유효 */
const memo = new Map<number, number>();

/**
 * 최근접 응급의료기관까지 거리(km).
 * contentId를 주면 메모이즈된다. 병원 데이터가 비어 있으면 Infinity를
 * 반환하므로 호출부는 Number.isFinite로 폴백 여부를 판단한다.
 */
export function nearestHospitalKm(lat: number, lng: number, contentId?: number): number {
  if (contentId !== undefined) {
    const cached = memo.get(contentId);
    if (cached !== undefined) return cached;
  }
  let min = Infinity;
  for (const h of HOSPITALS) {
    const d = haversineKm(lat, lng, h.lat, h.lng);
    if (d < min) min = d;
  }
  if (contentId !== undefined && Number.isFinite(min)) {
    memo.set(contentId, min);
  }
  return min;
}

/** 출처 표기 — UI 각주용 */
export function medicalDataSource(): string {
  return "국립중앙의료원 헬스맵 공공보건의료 통계 데이터셋(2023-12-31 기준, 공공데이터포털)";
}
