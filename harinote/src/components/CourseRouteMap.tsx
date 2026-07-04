"use client";

/**
 * 코스 루트 지도 (Leaflet) — 순번 마커 + 스톱 연결선.
 * Leaflet은 window에 의존하므로 SSR을 끄고 클라이언트에서만 렌더한다 (PlaceMap 패턴).
 */
import dynamic from "next/dynamic";

export interface RouteStop {
  title: string;
  lat: number;
  lng: number;
}

export interface CourseRouteMapProps {
  /** 코스 순서대로의 스톱 좌표 (대안 교체 시 갱신됨) */
  stops: RouteStop[];
}

const CourseRouteMapInner = dynamic(() => import("./CourseRouteMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 ring-1 ring-slate-200">
      지도를 불러오는 중…
    </div>
  ),
});

export default function CourseRouteMap(props: CourseRouteMapProps) {
  return <CourseRouteMapInner {...props} />;
}
