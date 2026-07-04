import { describe, expect, it } from "vitest";
import {
  SIGUNGU_STATION_FALLBACK,
  SIGUNGU_STATIONS,
  pickPm25ForSigungu,
  type StationPm25Map,
} from "@/lib/risk/airkorea";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";

const ALL_SIGUNGU_CODES = Array.from({ length: 18 }, (_, i) => i + 1);

describe("시군 → 측정소 매핑 테이블", () => {
  it("강원 18개 시군 전부 측정소 매핑이 존재한다", () => {
    for (const code of ALL_SIGUNGU_CODES) {
      expect(SIGUNGU_STATIONS[code], `sigunguCode=${code}`).toBeDefined();
      expect(SIGUNGU_STATIONS[code].length, `sigunguCode=${code}`).toBeGreaterThan(0);
    }
  });

  it("18개 시군 전부 인접 폴백이 유효한 시군 코드를 가리킨다", () => {
    for (const code of ALL_SIGUNGU_CODES) {
      const fallback = SIGUNGU_STATION_FALLBACK[code];
      expect(fallback, `sigunguCode=${code}`).toBeDefined();
      expect(ALL_SIGUNGU_CODES).toContain(fallback);
      expect(fallback).not.toBe(code);
    }
  });

  it("대표점 테이블(SIGUNGU_SEATS)과 시군 코드가 일치한다", () => {
    expect(Object.keys(SIGUNGU_SEATS).map(Number).sort((a, b) => a - b)).toEqual(
      ALL_SIGUNGU_CODES,
    );
  });
});

describe("pickPm25ForSigungu", () => {
  it("자기 시군 측정소 값을 우선 사용한다 (춘천 → 중앙로)", () => {
    const stations: StationPm25Map = new Map([
      ["중앙로", 21],
      ["옥천동", 40],
    ]);
    expect(pickPm25ForSigungu(stations, 13)).toBe(21);
  });

  it("자기 측정소가 결측이면 인접 시군으로 폴백한다 (양구 → 춘천 중앙로)", () => {
    const stations: StationPm25Map = new Map([["중앙로", 18]]);
    expect(pickPm25ForSigungu(stations, 6)).toBe(18);
  });

  it("폴백 체인에도 값이 없으면 강원 전체 유효값 평균", () => {
    // 동해(3)→강릉(1)→동해(3) 순환 — visited로 종료 후 평균 폴백
    const stations: StationPm25Map = new Map([
      ["중앙로", 10],
      ["명륜동", 30],
    ]);
    expect(pickPm25ForSigungu(stations, 3)).toBe(20);
  });

  it("sigunguCode가 없으면 강원 전체 평균", () => {
    const stations: StationPm25Map = new Map([
      ["중앙로", 10],
      ["옥천동", 20],
    ]);
    expect(pickPm25ForSigungu(stations, undefined)).toBe(15);
  });

  it("유효값이 하나도 없으면 undefined", () => {
    expect(pickPm25ForSigungu(new Map(), 13)).toBeUndefined();
  });
});
