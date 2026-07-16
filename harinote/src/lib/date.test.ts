import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  dayOffsetSeoul,
  eachDayISO,
  isValidISODate,
  monthOfISO,
  nightsBetween,
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

describe("addDaysISO", () => {
  it("월말·연말 경계를 넘는다", () => {
    expect(addDaysISO("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("윤년 2월을 처리한다 (2028년은 윤년)", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDaysISO("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("음수·0도 동작한다", () => {
    expect(addDaysISO("2026-08-01", -1)).toBe("2026-07-31");
    expect(addDaysISO("2026-07-20", 0)).toBe("2026-07-20");
  });
});

describe("eachDayISO", () => {
  it("양끝을 포함한다", () => {
    expect(eachDayISO("2026-07-20", "2026-07-23")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
    ]);
  });

  it("같은 날이면 1개", () => {
    expect(eachDayISO("2026-07-20", "2026-07-20")).toEqual(["2026-07-20"]);
  });

  it("역순이면 [start]로 방어", () => {
    expect(eachDayISO("2026-07-23", "2026-07-20")).toEqual(["2026-07-23"]);
  });

  it("월 경계를 넘는다", () => {
    expect(eachDayISO("2026-07-30", "2026-08-02")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });
});

describe("nightsBetween", () => {
  it("7/20~7/23 = 3박, 같은 날 = 0박", () => {
    expect(nightsBetween("2026-07-20", "2026-07-23")).toBe(3);
    expect(nightsBetween("2026-07-20", "2026-07-20")).toBe(0);
  });

  it("역순은 0으로 방어", () => {
    expect(nightsBetween("2026-07-23", "2026-07-20")).toBe(0);
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
