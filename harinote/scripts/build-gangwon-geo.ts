/**
 * 강원 시군 경계 GeoJSON → src/data/gangwon-geo.json 변환.
 *
 * 원본: southkorea-maps kostat 2013 simplified (공개 저장소).
 * - 시군 필터: "춘천시"(전국 유일 이름)의 code 앞 2자리를 접두사로 사용
 *   ("고성군"이 경남에도 있어 이름만으로는 충돌하기 때문).
 * - 시군 매칭: properties.name ↔ SIGUNGU_SEATS.name (18개 전부 일치해야 성공).
 * - 좌표는 [lng,lat] → Leaflet [lat,lng]으로 뒤집고 4자리 반올림.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SIGUNGU_SEATS } from "../src/lib/risk/regions";

const MUNI_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json";
const PROV_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json";

type LatLngTuple = [number, number];

interface Feature {
  properties: { code: string; name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const toLatLngRing = (ring: number[][]): LatLngTuple[] =>
  ring.map(([lng, lat]) => [round4(lat), round4(lng)]);

/** Polygon/MultiPolygon → 폴리곤별 링 배열 목록 */
function polygonsOf(geometry: Feature["geometry"]): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]];
  return geometry.coordinates as number[][][][];
}

async function fetchJson(url: string): Promise<{ features: Feature[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [muni, prov] = await Promise.all([fetchJson(MUNI_URL), fetchJson(PROV_URL)]);

  const chuncheon = muni.features.find((f) => f.properties.name === "춘천시");
  if (!chuncheon) throw new Error("춘천시 feature를 찾지 못함 — 원본 스키마 변경?");
  const prefix = chuncheon.properties.code.slice(0, 2);
  const gangwonFeatures = muni.features.filter((f) =>
    f.properties.code.startsWith(prefix),
  );

  const codeByName = new Map(
    Object.entries(SIGUNGU_SEATS).map(([code, seat]) => [seat.name, Number(code)]),
  );

  const regions = gangwonFeatures
    .map((f) => {
      const sigunguCode = codeByName.get(f.properties.name);
      if (sigunguCode === undefined)
        throw new Error(`SIGUNGU_SEATS에 없는 시군: ${f.properties.name}`);
      // kostat 시군 geometry는 전부 Polygon이지만 MultiPolygon도 방어적으로 처리
      const rings = polygonsOf(f.geometry).flat().map(toLatLngRing);
      return { sigunguCode, name: f.properties.name, rings };
    })
    .sort((a, b) => a.sigunguCode - b.sigunguCode);

  if (regions.length !== 18)
    throw new Error(`강원 시군이 18개가 아님: ${regions.length}개`);

  const gangwonProv = prov.features.find((f) => f.properties.name === "강원도");
  if (!gangwonProv) throw new Error("provinces에서 강원도를 찾지 못함");
  const maskHoles = polygonsOf(gangwonProv.geometry).map((poly) =>
    toLatLngRing(poly[0]),
  );

  const out = join(__dirname, "../src/data/gangwon-geo.json");
  writeFileSync(out, JSON.stringify({ maskHoles, regions }));
  console.log(`✔ ${out} — 시군 ${regions.length}개, 마스크 구멍 ${maskHoles.length}개`);
}

main();
