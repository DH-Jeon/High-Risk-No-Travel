"use client";

/**
 * 시군 위험 지도 (Leaflet + OpenStreetMap — PlaceMap과 같은 패턴).
 * Leaflet은 window에 의존하므로 SSR을 끄고 클라이언트에서만 렌더한다.
 */
import dynamic from "next/dynamic";
import type { RegionSummary } from "@/lib/risk/region-summary";

export interface RegionRiskMapProps {
  regions: RegionSummary[];
  /** 선택된 시군 코드 — 해당 폴리곤 강조 */
  selectedCode?: number | null;
  /** 시군 폴리곤/마커 클릭 콜백 */
  onSelectRegion?: (sigunguCode: number) => void;
}

const RegionRiskMapInner = dynamic(() => import("./RegionRiskMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 ring-1 ring-slate-200 sm:h-[500px]">
      지도를 불러오는 중…
    </div>
  ),
});

export default function RegionRiskMap(props: RegionRiskMapProps) {
  return <RegionRiskMapInner {...props} />;
}
