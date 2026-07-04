/**
 * 강원 응급의료기관 좌표 빌드 스크립트 — 실행: npx tsx scripts/build-hospitals.ts [--verify-only]
 *
 * 원본: 국립중앙의료원_헬스맵(HealthMap) 공공보건의료 통계 데이터셋_20231231
 *   - 데이터셋 페이지: https://www.data.go.kr/data/15154171/fileData.do (키 없이 다운로드 가능)
 *   - zip 안의 "기관정보.csv"에 전국 의료기관 77,056곳 + 응급의료기관 지정 여부 + EPSG:5179 좌표
 * 변환: 강원 + 응급의료기관 지정(중앙/권역/지역응급의료센터·지역응급의료기관) 필터
 *   → EPSG:5179(Korea 2000 / Unified CS) → WGS84 역변환 → src/data/hospitals.gangwon.json
 * 검증: (1) 앵커 병원 3곳 좌표를 외부 출처(Wikidata·위키백과·OSM)와 교차 확인
 *   (2) 강원 18개 시군청 소재지가 모두 최근접 병원 30km 이내
 *   (3) gangwon.json 관광지 전체의 30km 초과 비율 리포트
 *
 * --verify-only: 다운로드 없이 기존 src/data/hospitals.gangwon.json에 대해 검증(2)(3)만 수행
 */
import { readFile, writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import path from "node:path";
import { haversineKm } from "../src/lib/reco/distance";
import { SIGUNGU_SEATS } from "../src/lib/risk/regions";
import type { Place } from "../src/lib/tour/types";

const DATASET_PAGE = "https://www.data.go.kr/data/15154171/fileData.do";
const DOWNLOAD_URL =
  "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003555210&fileDetailSn=1";
const CSV_NAME = "기관정보.csv";
const OUT_PATH = path.join(process.cwd(), "src/data/hospitals.gangwon.json");
const GANGWON_JSON = path.join(process.cwd(), "src/data/gangwon.json");

/** JSON 각 레코드에 새기는 출처 표기 (파일 주석이 불가능하므로 필드로 기록) */
const SOURCE =
  "국립중앙의료원 헬스맵 공공보건의료 통계 데이터셋(2023-12-31 기준) — 공공데이터포털 " +
  DATASET_PAGE;

interface Hospital {
  name: string;
  lat: number;
  lng: number;
  sigunguCode?: number;
  source: string;
}

// ---------------------------------------------------------------------------
// EPSG:5179 (Korea 2000 / Unified CS) → WGS84 역변환 — Snyder 횡메르카토르 역산식
// GRS80 타원체, 원점 lat 38° / lon 127.5°, k0=0.9996, FE=1,000,000, FN=2,000,000
// ---------------------------------------------------------------------------
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LON0 = (127.5 * Math.PI) / 180;
const FE = 1_000_000;
const FN = 2_000_000;

function meridianArc(phi: number): number {
  return (
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

const M0 = meridianArc((38 * Math.PI) / 180);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

function epsg5179ToWgs84(x: number, y: number): { lat: number; lng: number } {
  const m = M0 + (y - FN) / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * E1) / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * E1 ** 2) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * E1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * E1 ** 4) / 512) * Math.sin(8 * mu);
  const sp = Math.sin(phi1);
  const cp = Math.cos(phi1);
  const tp = Math.tan(phi1);
  const c1 = EP2 * cp * cp;
  const t1 = tp * tp;
  const n1 = A / Math.sqrt(1 - E2 * sp * sp);
  const r1 = (A * (1 - E2)) / (1 - E2 * sp * sp) ** 1.5;
  const d = (x - FE) / (n1 * K0);
  const lat =
    phi1 -
    ((n1 * tp) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6) / 720);
  const lng =
    LON0 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5) / 120) /
      cp;
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

// ---------------------------------------------------------------------------
// zip 파싱 (의존성 없이) — 중앙 디렉터리를 훑어 대상 CSV 1개만 inflate
// ---------------------------------------------------------------------------
function extractZipEntry(zip: Buffer, entryName: string): Buffer {
  // EOCD(0x06054b50)를 뒤에서 탐색
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip EOCD를 찾지 못했습니다");
  const count = zip.readUInt16LE(eocd + 10);
  let off = zip.readUInt32LE(eocd + 16);
  const euckr = new TextDecoder("euc-kr");
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(off) !== 0x02014b50) throw new Error("zip 중앙 디렉터리 손상");
    const flags = zip.readUInt16LE(off + 8);
    const method = zip.readUInt16LE(off + 10);
    const compSize = zip.readUInt32LE(off + 20);
    const nameLen = zip.readUInt16LE(off + 28);
    const extraLen = zip.readUInt16LE(off + 30);
    const commentLen = zip.readUInt16LE(off + 32);
    const localOff = zip.readUInt32LE(off + 42);
    const nameBytes = zip.subarray(off + 46, off + 46 + nameLen);
    // bit 11 = UTF-8 파일명, 아니면 한국어 Windows zip은 CP949(EUC-KR)
    const name = flags & 0x800 ? nameBytes.toString("utf8") : euckr.decode(nameBytes);
    if (name === entryName) {
      const lNameLen = zip.readUInt16LE(localOff + 26);
      const lExtraLen = zip.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = zip.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`지원하지 않는 zip 압축 방식: ${method}`);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip에서 "${entryName}"를 찾지 못했습니다`);
}

/** 따옴표 필드(주소의 쉼표) 지원 CSV 파서 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 빌드
// ---------------------------------------------------------------------------
const EMERGENCY_COLS = [
  "중앙응급의료센터 지정",
  "권역응급의료센터 지정",
  "지역응급의료센터 지정",
  "지역응급의료기관 지정",
];

/** 주소의 "강원특별자치도 {시군}"에서 TourAPI sigunguCode 역매핑 */
function sigunguCodeFromAddr(addr: string): number | undefined {
  for (const [code, seat] of Object.entries(SIGUNGU_SEATS)) {
    if (addr.includes(` ${seat.name} `) || addr.includes(` ${seat.name}`)) {
      return Number(code);
    }
  }
  return undefined;
}

async function build(): Promise<Hospital[]> {
  console.log(`다운로드: ${DOWNLOAD_URL}`);
  const res = await fetch(DOWNLOAD_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (harinote build-hospitals)",
      Referer: DATASET_PAGE,
    },
  });
  if (!res.ok) throw new Error(`다운로드 실패: HTTP ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  console.log(`zip ${(zip.length / 1024 / 1024).toFixed(1)}MB 수신 — ${CSV_NAME} 추출`);

  const csv = extractZipEntry(zip, CSV_NAME).toString("utf8").replace(/^﻿/, "");
  const rows = parseCsv(csv);
  const header = rows[0];
  const col = (name: string) => {
    const idx = header.indexOf(name);
    if (idx < 0) throw new Error(`CSV에 "${name}" 컬럼이 없습니다 — 스키마 변경 여부 확인 필요`);
    return idx;
  };
  const iName = col("요양기관명");
  const iAddr = col("소재지");
  const iSido = col("시도명");
  const iX = col("X좌표");
  const iY = col("Y좌표");
  const iEmergency = EMERGENCY_COLS.map(col);

  const hospitals: Hospital[] = [];
  for (const r of rows.slice(1)) {
    if (!r[iSido]?.includes("강원")) continue;
    if (!iEmergency.some((i) => r[i]?.trim() === "Y")) continue;
    const x = Number(r[iX]);
    const y = Number(r[iY]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) {
      console.warn(`  좌표 없음 — 제외: ${r[iName]}`);
      continue;
    }
    const { lat, lng } = epsg5179ToWgs84(x, y);
    hospitals.push({
      name: r[iName].trim(),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      sigunguCode: sigunguCodeFromAddr(r[iAddr]),
      source: SOURCE,
    });
  }
  hospitals.sort((a, b) => (a.sigunguCode ?? 99) - (b.sigunguCode ?? 99) || a.name.localeCompare(b.name, "ko"));

  // 앵커 교차 검증 — 외부 공개 출처의 실좌표와 300m 이내인지 (좌표계 변환 회귀 방지)
  const anchors: Array<[string, number, number, string]> = [
    ["강릉아산병원", 37.818426, 128.857705, "Wikidata Q16092551"],
    ["강원대학교병원", 37.874956, 127.744198, "한국어 위키백과"],
    ["강원특별자치도속초의료원", 38.216689, 128.589332, "OpenStreetMap"],
  ];
  for (const [name, lat, lng, src] of anchors) {
    const h = hospitals.find((h) => h.name === name);
    if (!h) throw new Error(`앵커 병원 "${name}"이 결과에 없습니다`);
    const d = haversineKm(h.lat, h.lng, lat, lng);
    if (d > 0.3) throw new Error(`앵커 "${name}" 좌표가 ${src}와 ${d.toFixed(2)}km 어긋남`);
    console.log(`  앵커 확인: ${name} ↔ ${src} 오차 ${(d * 1000).toFixed(0)}m`);
  }

  await writeFile(OUT_PATH, JSON.stringify(hospitals, null, 1) + "\n", "utf8");
  console.log(`저장: ${OUT_PATH} (${hospitals.length}곳)`);
  return hospitals;
}

// ---------------------------------------------------------------------------
// 검증 — 시군 커버리지 + 관광지 30km 초과 통계
// ---------------------------------------------------------------------------
async function verify(hospitals: Hospital[]): Promise<void> {
  const nearest = (lat: number, lng: number) =>
    Math.min(...hospitals.map((h) => haversineKm(lat, lng, h.lat, h.lng)));

  console.log("\n== 시군청 소재지 커버리지 (기준 30km) ==");
  let uncovered = 0;
  for (const seat of Object.values(SIGUNGU_SEATS)) {
    const d = nearest(seat.lat, seat.lng);
    const over = d > 30;
    if (over) uncovered++;
    console.log(`  ${seat.name.padEnd(4)} ${d.toFixed(1).padStart(5)} km${over ? "  << 30km 초과" : ""}`);
  }

  const places = JSON.parse(await readFile(GANGWON_JSON, "utf8")) as Place[];
  // TourAPI 좌표 이상치(강원 밖) 제외 — gangwon.json에 4곳 존재 (contentId 125683 등)
  const valid = places.filter((p) => p.lat > 36.9 && p.lat < 38.7 && p.lng > 127 && p.lng < 129.6);
  const dists = valid.map((p) => nearest(p.lat, p.lng));
  const over30 = dists.filter((d) => d > 30).length;
  console.log(`\n== 관광지 커버리지 ==`);
  console.log(`  전체 ${places.length}곳 (좌표 정상 ${valid.length}곳 기준)`);
  console.log(
    `  최근접 병원 30km 초과: ${over30}곳 (${((100 * over30) / valid.length).toFixed(1)}%) — 산간 지역 자연 초과분`,
  );
  console.log(
    `  거리 분포: 중앙값 ${dists.slice().sort((a, b) => a - b)[Math.floor(dists.length / 2)].toFixed(1)}km / 최대 ${Math.max(...dists).toFixed(1)}km`,
  );

  if (uncovered > 0) {
    throw new Error(`시군청 소재지 ${uncovered}곳이 30km 커버리지를 벗어났습니다`);
  }
  console.log("\n검증 통과: 18개 시군 모두 30km 이내에 응급의료기관 확보");
}

async function main(): Promise<void> {
  const verifyOnly = process.argv.slice(2).includes("--verify-only");
  const hospitals = verifyOnly
    ? (JSON.parse(await readFile(OUT_PATH, "utf8")) as Hospital[])
    : await build();
  await verify(hospitals);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
