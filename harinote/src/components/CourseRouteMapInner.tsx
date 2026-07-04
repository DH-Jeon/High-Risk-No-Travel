"use client";

import { useEffect } from "react";
import { divIcon, latLngBounds } from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CourseRouteMapProps, RouteStop } from "./CourseRouteMap";

/** 순번(1, 2, 3) 원형 마커 — 기본 아이콘 이미지 의존 없이 CSS로 그린다 */
function orderIcon(order: number): ReturnType<typeof divIcon> {
  const size = 24;
  return divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:#0f766e;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);color:#fff;font-size:12px;font-weight:700">${order}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * MapContainer는 bounds를 마운트 시에만 반영하므로,
 * 대안 교체로 stops가 바뀌면 여기서 다시 fit한다.
 */
function FitToStops({ stops }: { stops: RouteStop[] }) {
  const map = useMap();
  useEffect(() => {
    if (stops.length === 0) return;
    if (stops.length === 1) {
      map.setView([stops[0].lat, stops[0].lng], 12);
      return;
    }
    map.fitBounds(
      latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number])).pad(
        0.2,
      ),
    );
  }, [map, stops]);
  return null;
}

export default function CourseRouteMapInner({ stops }: CourseRouteMapProps) {
  // 점이 1개면 bounds가 크기 0으로 축퇴해 최대 줌이 되므로 center+zoom을 사용
  const view =
    stops.length > 1
      ? {
          bounds: latLngBounds(
            stops.map((s) => [s.lat, s.lng] as [number, number]),
          ).pad(0.2),
        }
      : {
          center: [stops[0]?.lat ?? 37.8, stops[0]?.lng ?? 128.2] as [
            number,
            number,
          ],
          zoom: 12,
        };

  return (
    <MapContainer
      {...view}
      scrollWheelZoom={false}
      className="z-0 h-56 w-full rounded-2xl ring-1 ring-slate-200"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToStops stops={stops} />
      <Polyline
        positions={stops.map((s) => [s.lat, s.lng] as [number, number])}
        pathOptions={{ color: "#0f766e", weight: 3, dashArray: "6 8" }}
      />
      {stops.map((stop, i) => (
        <Marker
          key={`${i}-${stop.lat}-${stop.lng}`}
          position={[stop.lat, stop.lng]}
          icon={orderIcon(i + 1)}
        >
          <Popup>
            <strong>
              {i + 1}. {stop.title}
            </strong>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
