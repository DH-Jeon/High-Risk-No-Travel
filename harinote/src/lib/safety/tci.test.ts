import { describe, expect, it } from "vitest";
import {
  computeTci,
  pmScore,
  rainScore,
  sunScore,
  thermalScore,
  windScore,
} from "@/lib/safety/tci";

describe("windScore — Mieczkowski normal system (km/h)", () => {
  it("무풍(<2.88km/h)은 만점 5", () => {
    expect(windScore(0.5)).toBe(5.0); // 1.8km/h
  });
  it("강풍주의보(14m/s=50km/h)는 0점", () => {
    expect(windScore(14)).toBe(0);
  });
  it("풍속 커질수록 점수 단조 감소", () => {
    expect(windScore(1)).toBeGreaterThan(windScore(3));
    expect(windScore(3)).toBeGreaterThan(windScore(6));
  });
});

describe("rainScore — 박창용(2014) 일값 규칙", () => {
  it("5mm 이상은 0점", () => {
    expect(rainScore(5)).toBe(0);
    expect(rainScore(20)).toBe(0);
  });
  it("0.5mm 미만(사실상 무강수)은 만점 5", () => {
    expect(rainScore(0)).toBe(5);
    expect(rainScore(0.3)).toBe(5);
  });
  it("1mm면 4점(5-1)", () => {
    expect(rainScore(1)).toBe(4);
  });
  it("미제공(undefined)은 무강수로 5점", () => {
    expect(rainScore(undefined)).toBe(5);
  });

  it("강수량 없어도 강수확률 높으면 감점 (비 예보 반영)", () => {
    // "강수확률 80% + 강수없음"이 예보에 흔함 → 확률로 감점
    expect(rainScore(undefined, 80)).toBe(2);
    expect(rainScore(undefined, 60)).toBe(3);
    expect(rainScore(undefined, 30)).toBe(4);
    expect(rainScore(undefined, 10)).toBe(5); // 낮으면 감점 없음
  });

  it("강수량·강수확률 중 나쁜 쪽 반영", () => {
    // 많은 비(5mm↑)면 확률 무관 최저점, 적은 비+높은 확률이면 확률이 지배
    expect(rainScore(20, 30)).toBe(0);
    expect(rainScore(1, 80)).toBe(2); // 강수량 4점 vs 확률 2점 → 2
  });
});

describe("sunScore — 일조시간", () => {
  it("1시간 이하는 0점", () => {
    expect(sunScore(1)).toBe(0);
    expect(sunScore(0.5)).toBe(0);
  });
  it("10시간 초과는 5점", () => {
    expect(sunScore(11)).toBe(5);
  });
  it("5시간이면 2점((5-1)*0.5)", () => {
    expect(sunScore(5)).toBe(2);
  });
});

describe("pmScore — 환경부 PM2.5 등급", () => {
  it("좋음(≤15)=5, 매우나쁨(>75)=0", () => {
    expect(pmScore(10)).toBe(5);
    expect(pmScore(100)).toBe(0);
  });
  it("등급 낮아질수록 점수 감소", () => {
    expect(pmScore(10)).toBeGreaterThan(pmScore(30));
    expect(pmScore(30)).toBeGreaterThan(pmScore(50));
  });
});

describe("thermalScore — 체감온도 브리지", () => {
  it("18~25℃ 이상적 구간은 만점 5", () => {
    expect(thermalScore(21)).toBe(5);
  });
  it("한여름 무더위(체감 35℃+)는 음수로 급감", () => {
    expect(thermalScore(36)).toBeLessThan(0);
  });
  it("체감 높을수록 점수 감소(25→31→35)", () => {
    expect(thermalScore(25)).toBeGreaterThan(thermalScore(31));
    expect(thermalScore(31)).toBeGreaterThan(thermalScore(35));
  });
});

describe("computeTci — 관광기후지수 0~100", () => {
  it("이상적 봄날(체감21·무강수·맑음·미풍·청정)은 상위 등급(≥80)", () => {
    const tci = computeTci({ feelsC: 21, rainMmDaily: 0, windMs: 1, pm25: 8, sunHours: 8 });
    expect(tci).toBeGreaterThanOrEqual(80);
  });

  it("한여름 무더위+비+미먼나쁨은 낮은 등급(<50)", () => {
    const tci = computeTci({ feelsC: 35, rainMmDaily: 10, windMs: 1, pm25: 45, sunHours: 4 });
    expect(tci).toBeLessThan(50);
  });

  it("무더위가 쾌청한 봄날보다 점수 낮다", () => {
    const spring = computeTci({ feelsC: 21, rainMmDaily: 0, windMs: 1, pm25: 8 });
    const summer = computeTci({ feelsC: 34, rainMmDaily: 3, windMs: 1, pm25: 40 });
    expect(summer).toBeLessThan(spring);
  });

  it("일조 미제공이어도 계산되고 0~100 범위", () => {
    const tci = computeTci({ feelsC: 21, rainMmDaily: 0, windMs: 2, pm25: 10 });
    expect(tci).toBeGreaterThanOrEqual(0);
    expect(tci).toBeLessThanOrEqual(100);
  });

  it("비 오면 같은 조건보다 점수 하락(강수 27% 비중)", () => {
    const dry = computeTci({ feelsC: 22, rainMmDaily: 0, windMs: 1, pm25: 10 });
    const wet = computeTci({ feelsC: 22, rainMmDaily: 5, windMs: 1, pm25: 10 });
    expect(wet).toBeLessThan(dry);
  });
});
