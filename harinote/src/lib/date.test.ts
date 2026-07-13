import { describe, expect, it } from "vitest";
import {
  dayOffsetSeoul,
  isValidISODate,
  monthOfISO,
  toKmaDate,
  todayISOSeoul,
} from "@/lib/date";
import { parseDate } from "@/components/search-params";

/** KST 시각 문자열로 Date 생성 — 테스트 머신 타임존에 무관 */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

describe("todayISOSeoul", () => {
  it("KST 기준 날짜 (UTC로는 전날인 새벽 시각 포함)", () => {
    expect(todayISOSeoul(kst("2026-07-13T15:00:00"))).toBe("2026-07-13");
    expect(todayISOSeoul(kst("2026-07-13T00:30:00"))).toBe("2026-07-13");
  });
});

describe("dayOffsetSeoul", () => {
  it("오늘=0, 내일=1, 어제=-1 (KST 자정 직전에도 정확)", () => {
    const now = kst("2026-07-13T23:59:00");
    expect(dayOffsetSeoul("2026-07-13", now)).toBe(0);
    expect(dayOffsetSeoul("2026-07-14", now)).toBe(1);
    expect(dayOffsetSeoul("2026-07-12", now)).toBe(-1);
  });

  it("월 경계", () => {
    expect(dayOffsetSeoul("2026-08-01", kst("2026-07-31T12:00:00"))).toBe(1);
  });
});

describe("isValidISODate", () => {
  it("실존 날짜만 허용", () => {
    expect(isValidISODate("2026-07-14")).toBe(true);
    expect(isValidISODate("2026-02-31")).toBe(false);
    expect(isValidISODate("2026-7-4")).toBe(false);
    expect(isValidISODate("내일")).toBe(false);
  });
});

describe("변환 유틸", () => {
  it("toKmaDate·monthOfISO", () => {
    expect(toKmaDate("2026-07-14")).toBe("20260714");
    expect(monthOfISO("2026-01-05")).toBe(1);
    expect(monthOfISO("2026-12-05")).toBe(12);
  });
});

describe("parseDate (URL 파라미터)", () => {
  /** 실제 오늘 기준 offset일 뒤 ISO 날짜 */
  function isoAfter(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }

  it("내일~1년 이내만 허용", () => {
    const tomorrow = isoAfter(2); // 타임존 여유를 두고 +2일로 확실한 미래
    expect(parseDate(tomorrow)).toBe(tomorrow);
  });

  it("오늘·과거·형식 오류는 undefined (오늘 모드)", () => {
    expect(parseDate(todayISOSeoul())).toBeUndefined();
    expect(parseDate(isoAfter(-3))).toBeUndefined();
    expect(parseDate(isoAfter(400))).toBeUndefined();
    expect(parseDate("2026-02-31")).toBeUndefined();
    expect(parseDate(undefined)).toBeUndefined();
  });
});
