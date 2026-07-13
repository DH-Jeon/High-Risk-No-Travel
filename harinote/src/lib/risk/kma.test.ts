import { describe, expect, it } from "vitest";
import { parsePcp, pickBaseDateTime, summarizeDaily } from "@/lib/risk/kma";

/** KST 시각 문자열로 Date 생성 — 테스트 머신 타임존에 무관 */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

describe("pickBaseDateTime (Asia/Seoul 기준)", () => {
  it("KST 03:00 → 당일 02시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-03T03:00:00"))).toEqual({
      baseDate: "20260703",
      baseTime: "0200",
    });
  });

  it("KST 05:05 → 05시 발표 반영 전이므로 02시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-03T05:05:00"))).toEqual({
      baseDate: "20260703",
      baseTime: "0200",
    });
  });

  it("KST 05:15 → 05시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-03T05:15:00"))).toEqual({
      baseDate: "20260703",
      baseTime: "0500",
    });
  });

  it("KST 00:30 → 전날 23시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-03T00:30:00"))).toEqual({
      baseDate: "20260702",
      baseTime: "2300",
    });
  });

  it("KST 02:09 → 아직 02시 미반영, 전날 23시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-03T02:09:00"))).toEqual({
      baseDate: "20260702",
      baseTime: "2300",
    });
  });

  it("KST 02:10 → 당일 02시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-03T02:10:00"))).toEqual({
      baseDate: "20260703",
      baseTime: "0200",
    });
  });

  it("KST 23:59 → 20시 발표 유지 (23시 발표는 내일 예보라 '오늘' 요약에 부적합)", () => {
    expect(pickBaseDateTime(kst("2026-07-03T23:59:00"))).toEqual({
      baseDate: "20260703",
      baseTime: "2000",
    });
  });

  it("월 경계: KST 7/1 00:30 → 6/30 23시 발표", () => {
    expect(pickBaseDateTime(kst("2026-07-01T00:30:00"))).toEqual({
      baseDate: "20260630",
      baseTime: "2300",
    });
  });
});

describe("parsePcp (강수량 문자열 파싱)", () => {
  it('"강수없음" → undefined', () => {
    expect(parsePcp("강수없음")).toBeUndefined();
  });

  it('"1mm 미만" → 0.5', () => {
    expect(parsePcp("1mm 미만")).toBe(0.5);
    expect(parsePcp("1.0mm 미만")).toBe(0.5);
  });

  it('"1.0mm" → 1', () => {
    expect(parsePcp("1.0mm")).toBe(1);
  });

  it('"30.0~50.0mm" → 중간값 40', () => {
    expect(parsePcp("30.0~50.0mm")).toBe(40);
  });

  it('"50.0mm 이상" → 50', () => {
    expect(parsePcp("50.0mm 이상")).toBe(50);
  });

  it('"-"·null·빈 문자열 → undefined', () => {
    expect(parsePcp("-")).toBeUndefined();
    expect(parsePcp(null)).toBeUndefined();
    expect(parsePcp("")).toBeUndefined();
  });
});

describe("summarizeDaily", () => {
  const item = (category: string, fcstValue: string, fcstDate = "20260703", fcstTime = "1200") => ({
    category,
    fcstDate,
    fcstTime,
    fcstValue,
  });

  it("TMX 우선, POP·WSD 최댓값, PCP 합계", () => {
    const items = [
      item("TMP", "28"),
      item("TMP", "31", "20260703", "1500"),
      item("TMX", "33.0", "20260703", "1500"),
      item("POP", "30"),
      item("POP", "80", "20260703", "1800"),
      item("WSD", "3.5"),
      item("WSD", "7.2", "20260703", "1800"),
      item("PCP", "강수없음"),
      item("PCP", "5.0mm", "20260703", "1500"),
      item("PCP", "30.0~50.0mm", "20260703", "1800"),
    ];
    expect(summarizeDaily(items, "20260703")).toEqual({
      tempC: 33,
      rainProbPct: 80,
      windMs: 7.2,
      rainMm: 45, // 5.0mm + 범위 중간값 40
    });
  });

  it("TMX가 없으면 남은 시간대 TMP 최댓값", () => {
    const items = [item("TMP", "24"), item("TMP", "27", "20260703", "1600")];
    expect(summarizeDaily(items, "20260703").tempC).toBe(27);
  });

  it("전부 강수없음이면 rainMm은 undefined", () => {
    const items = [item("PCP", "강수없음"), item("POP", "10")];
    expect(summarizeDaily(items, "20260703").rainMm).toBeUndefined();
  });

  it("오늘 예보가 없으면(자정 직전 23시 발표) 가장 이른 예보일로 대체", () => {
    const items = [
      item("TMP", "22", "20260704", "0000"),
      item("TMX", "30.0", "20260704", "1500"),
      item("TMP", "25", "20260705", "1200"),
    ];
    expect(summarizeDaily(items, "20260703").tempC).toBe(30);
  });
});
