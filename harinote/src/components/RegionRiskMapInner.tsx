"use client";

import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RiskLevel } from "@/lib/safety/types";
import { GRADE_LABEL } from "@/lib/safety/types";
import { GANGWON_GEO, type LatLngTuple } from "@/lib/geo/gangwon";
import type { RegionRiskMapProps } from "./RegionRiskMap";

/**
 * 등급별 색상(hue·채도)은 SafetyScoreBadge의 emerald/amber/red 체계와 맞추고,
 * 같은 등급 안에서 안전점수로 명암(lightness)을 연속 조절한다 (sequential choropleth).
 * 점수가 높을수록(=더 안전) 진하게 — 오늘 다 같은 등급이어도 강약이 보인다.
 */
const GRADE_HSL: Record<RiskLevel, { h: number; s: number }> = {
  low: { h: 158, s: 64 }, // emerald 계열
  moderate: { h: 38, s: 90 }, // amber 계열
  high: { h: 2, s: 78 }, // red 계열
};
const NO_DATA_HEX = "#94a3b8"; // slate-400

/** 안전점수 → 등급 hue 안에서의 색. 관광 안전점수 실질 범위(70~100)를 명암으로 편다. */
function scoreColor(score: number, grade: RiskLevel): string {
  const { h, s } = GRADE_HSL[grade];
  const t = Math.max(0, Math.min(1, (score - 70) / 30));
  const l = 45 - t * 17; // 45%(낮은 점수, 연함) → 28%(높은 점수, 진함)
  return `hsl(${h} ${s}% ${l}%)`;
}
const SELECTED_STROKE = "#0f766e"; // teal-700

/** 마스크 외곽 링 — 강원도 구멍(evenodd)을 뚫어 도 밖을 덮는다 */
const WORLD_RING: LatLngTuple[] = [
  [85, -180],
  [85, 180],
  [-85, 180],
  [-85, -180],
];

/** 강원 전체 경계 — 초기 화면·이동 제한 기준 */
const GANGWON_BOUNDS = latLngBounds(GANGWON_GEO.maskHoles.flat());

/**
 * 라벨 위치 오프셋 [Δlat, Δlng] — 시군청 소재지가 가로로 좁게 붙은 곳은
 * 알약 라벨끼리 겹친다. 겹치는 시군만 라벨을 살짝 이동한다 (폴리곤·클릭 위치는 불변).
 * 6 양구군: 화천·인제 사이 → 위로 / 11 정선군: 평창과 겹침 → 오른쪽 아래
 */
const LABEL_OFFSET: Record<number, [number, number]> = {
  6: [0.13, 0],
  11: [-0.05, 0.12],
};

/** 시군명 + 중앙값 점수 알약 라벨 (기본 아이콘 이미지 의존 없이 — PlaceMapInner 패턴) */
function pillIcon(name: string, medianScore: number | null, grade: RiskLevel | null) {
  const bg =
    medianScore !== null && grade ? scoreColor(medianScore, grade) : NO_DATA_HEX;
  const scoreText = medianScore === null ? "–" : String(medianScore);
  return divIcon({
    className: "",
    html: `<span style="position:absolute;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:4px;white-space:nowrap;padding:3px 9px;border-radius:9999px;background:${bg};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${name} <b style="font-variant-numeric:tabular-nums">${scoreText}</b></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function RegionRiskMapInner({
  regions,
  selectedCode = null,
  onSelectRegion,
}: RegionRiskMapProps) {
  const summaryByCode = new Map(regions.map((r) => [r.sigunguCode, r]));

  return (
    <MapContainer
      bounds={GANGWON_BOUNDS.pad(0.05)}
      maxBounds={GANGWON_BOUNDS.pad(0.4)}
      minZoom={7}
      scrollWheelZoom={false}
      className="z-0 h-[420px] w-full rounded-2xl ring-1 ring-slate-200 sm:h-[500px]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 강원 밖 마스크 — 도 경계 구멍(evenodd)만 남기고 반투명하게 덮는다 */}
      <Polygon
        positions={[WORLD_RING, ...GANGWON_GEO.maskHoles]}
        interactive={false}
        pathOptions={{
          stroke: false,
          fillColor: "#f8fafc", // slate-50
          fillOpacity: 0.85,
          fillRule: "evenodd",
        }}
      />

      {/* 시군 choropleth — 안전점수 연속 색조 채움, 클릭 시 선택 */}
      {GANGWON_GEO.regions.map((geo) => {
        const summary = summaryByCode.get(geo.sigunguCode);
        const grade = summary?.grade ?? null;
        const isSelected = selectedCode === geo.sigunguCode;
        const fill =
          summary?.medianScore != null && grade
            ? scoreColor(summary.medianScore, grade)
            : NO_DATA_HEX;
        return (
          <Polygon
            key={geo.sigunguCode}
            positions={geo.rings}
            pathOptions={{
              color: isSelected ? SELECTED_STROKE : "#ffffff",
              weight: isSelected ? 3 : 1.5,
              fillColor: fill,
              fillOpacity: isSelected ? 0.7 : 0.5,
            }}
            eventHandlers={{
              click: () => onSelectRegion?.(geo.sigunguCode),
            }}
          />
        );
      })}

      {/* 시군명+점수 알약 마커 (폴리곤 위) — 겹치는 라벨은 오프셋 적용 */}
      {regions.map((region) => {
        const off = LABEL_OFFSET[region.sigunguCode];
        return (
        <Marker
          key={region.sigunguCode}
          position={[region.lat + (off?.[0] ?? 0), region.lng + (off?.[1] ?? 0)]}
          icon={pillIcon(region.name, region.medianScore, region.grade)}
          title={
            region.grade
              ? `${region.name} — 안전점수 중앙값 ${region.medianScore}점 (${GRADE_LABEL[region.grade]})`
              : `${region.name} — 데이터 없음`
          }
          alt={`${region.name} 시군 마커`}
          eventHandlers={{
            click: () => onSelectRegion?.(region.sigunguCode),
          }}
        />
        );
      })}
    </MapContainer>
  );
}
