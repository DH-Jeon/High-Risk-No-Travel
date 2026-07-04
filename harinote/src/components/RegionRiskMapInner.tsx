"use client";

import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RiskLevel } from "@/lib/safety/types";
import { GRADE_LABEL } from "@/lib/safety/types";
import { GANGWON_GEO, type LatLngTuple } from "@/lib/geo/gangwon";
import type { RegionRiskMapProps } from "./RegionRiskMap";

/** SafetyScoreBadge의 emerald/amber/red-500 색 체계와 동일한 hex (divIcon은 인라인 스타일만 가능) */
const GRADE_HEX: Record<RiskLevel, string> = {
  low: "#10b981", // emerald-500
  moderate: "#f59e0b", // amber-500
  high: "#ef4444", // red-500
};
const NO_DATA_HEX = "#94a3b8"; // slate-400
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

/** 시군명 + 중앙값 점수 알약 라벨 (기본 아이콘 이미지 의존 없이 — PlaceMapInner 패턴) */
function pillIcon(name: string, medianScore: number | null, grade: RiskLevel | null) {
  const bg = grade ? GRADE_HEX[grade] : NO_DATA_HEX;
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

      {/* 시군 choropleth — 등급 색 채움, 클릭 시 선택 */}
      {GANGWON_GEO.regions.map((geo) => {
        const summary = summaryByCode.get(geo.sigunguCode);
        const grade = summary?.grade ?? null;
        const isSelected = selectedCode === geo.sigunguCode;
        return (
          <Polygon
            key={geo.sigunguCode}
            positions={geo.rings}
            pathOptions={{
              color: isSelected ? SELECTED_STROKE : "#ffffff",
              weight: isSelected ? 3 : 1.5,
              fillColor: grade ? GRADE_HEX[grade] : NO_DATA_HEX,
              fillOpacity: isSelected ? 0.6 : 0.4,
            }}
            eventHandlers={{
              click: () => onSelectRegion?.(geo.sigunguCode),
            }}
          />
        );
      })}

      {/* 시군명+점수 알약 마커 (폴리곤 위) */}
      {regions.map((region) => (
        <Marker
          key={region.sigunguCode}
          position={[region.lat, region.lng]}
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
      ))}
    </MapContainer>
  );
}
