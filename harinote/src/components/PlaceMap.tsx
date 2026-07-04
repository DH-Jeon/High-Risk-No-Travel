"use client";

/**
 * 위치 지도 (Leaflet + OpenStreetMap — API 키 불필요, ADR-004의 카카오 대체).
 * Leaflet은 window에 의존하므로 SSR을 끄고 클라이언트에서만 렌더한다.
 */
import dynamic from "next/dynamic";

export interface MapPoint {
  contentId: number;
  title: string;
  lat: number;
  lng: number;
  score: number;
  distanceKm?: number;
}

export interface PlaceMapProps {
  target: MapPoint;
  alternatives: MapPoint[];
  /** 대체지 상세 링크에 붙일 쿼리 ("?profile=..." 또는 "") */
  profileQuery: string;
}

const PlaceMapInner = dynamic(() => import("./PlaceMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 ring-1 ring-slate-200">
      지도를 불러오는 중…
    </div>
  ),
});

export default function PlaceMap(props: PlaceMapProps) {
  return <PlaceMapInner {...props} />;
}
