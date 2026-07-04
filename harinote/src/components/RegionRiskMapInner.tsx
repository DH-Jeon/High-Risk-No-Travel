"use client";

import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import type { RiskLevel } from "@/lib/safety/types";
import { GRADE_LABEL } from "@/lib/safety/types";
import type { RegionRiskMapProps } from "./RegionRiskMap";

/** SafetyScoreBadge의 emerald/amber/red-500 색 체계와 동일한 hex (divIcon은 인라인 스타일만 가능) */
const GRADE_HEX: Record<RiskLevel, string> = {
  low: "#10b981", // emerald-500
  moderate: "#f59e0b", // amber-500
  high: "#ef4444", // red-500
};
const NO_DATA_HEX = "#94a3b8"; // slate-400

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

export default function RegionRiskMapInner({ regions }: RegionRiskMapProps) {
  const router = useRouter();
  const bounds = latLngBounds(
    regions.map((r) => [r.lat, r.lng] as [number, number]),
  ).pad(0.15);

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      className="z-0 h-80 w-full rounded-2xl ring-1 ring-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {regions.map((region) => (
        <Marker
          key={region.sigunguCode}
          position={[region.lat, region.lng]}
          icon={pillIcon(region.name, region.medianScore, region.grade)}
          title={
            region.grade
              ? `${region.name} — 안전점수 중앙값 ${region.medianScore}점 (${GRADE_LABEL[region.grade]}) · 관광지 보기`
              : `${region.name} — 데이터 없음 · 관광지 보기`
          }
          alt={`${region.name} 시군 마커`}
          eventHandlers={{
            click: () => router.push(`/places?sigungu=${region.sigunguCode}`),
          }}
        />
      ))}
    </MapContainer>
  );
}
