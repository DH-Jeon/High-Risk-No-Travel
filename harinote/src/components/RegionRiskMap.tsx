"use client";

/**
 * 시군 위험 지도 (Leaflet + OpenStreetMap — PlaceMap과 같은 패턴).
 * Leaflet은 window에 의존하므로 SSR을 끄고 클라이언트에서만 렌더한다.
 */
import dynamic from "next/dynamic";
import type { RegionSummary } from "@/lib/risk/region-summary";

export interface RegionRiskMapProps {
  regions: RegionSummary[];
}

const RegionRiskMapInner = dynamic(() => import("./RegionRiskMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 ring-1 ring-slate-200">
      지도를 불러오는 중…
    </div>
  ),
});

export default function RegionRiskMap(props: RegionRiskMapProps) {
  return <RegionRiskMapInner {...props} />;
}
