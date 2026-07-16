import { describe, expect, it } from "vitest";
import { nextRangeSelection, rangeNights } from "@/components/range-select";
import { MAX_RANGE_DAYS } from "@/components/search-params";
import { addDaysISO } from "@/lib/date";

const D = "2026-07-20";

describe("nextRangeSelection (에어비앤비식 상태 머신)", () => {
  it("빈 상태에서 클릭 → from 설정", () => {
    expect(nextRangeSelection({}, D)).toEqual({ from: D });
  });

  it("from만 있고 이전 날짜 클릭 → from 재설정", () => {
    expect(nextRangeSelection({ from: D }, "2026-07-15")).toEqual({
      from: "2026-07-15",
    });
  });

  it("from만 있고 같은 날짜 클릭 → from 재설정 (0박 범위 방지)", () => {
    expect(nextRangeSelection({ from: D }, D)).toEqual({ from: D });
  });

  it("from만 있고 이후 날짜 클릭 → to 확정", () => {
    expect(nextRangeSelection({ from: D }, "2026-07-23")).toEqual({
      from: D,
      to: "2026-07-23",
    });
  });

  it("MAX_RANGE_DAYS 초과 클릭 → 새 from으로 리셋", () => {
    const tooFar = addDaysISO(D, MAX_RANGE_DAYS); // 시작 포함 15일째
    expect(nextRangeSelection({ from: D }, tooFar)).toEqual({ from: tooFar });
    // 정확히 상한(시작 포함 14일)은 to로 확정
    const edge = addDaysISO(D, MAX_RANGE_DAYS - 1);
    expect(nextRangeSelection({ from: D }, edge)).toEqual({ from: D, to: edge });
  });

  it("from+to 완성 상태에서 클릭 → 새 from으로 리셋", () => {
    const sel = { from: D, to: "2026-07-23" };
    expect(nextRangeSelection(sel, "2026-07-21")).toEqual({
      from: "2026-07-21",
    });
    expect(nextRangeSelection(sel, "2026-08-01")).toEqual({
      from: "2026-08-01",
    });
  });
});

describe("rangeNights", () => {
  it("완성된 범위는 숙박 일수, 미완성은 0", () => {
    expect(rangeNights({ from: D, to: "2026-07-23" })).toBe(3);
    expect(rangeNights({ from: D })).toBe(0);
    expect(rangeNights({})).toBe(0);
  });
});
