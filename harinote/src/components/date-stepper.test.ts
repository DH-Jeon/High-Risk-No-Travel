import { describe, expect, it } from "vitest";
import { stepperView } from "@/components/date-stepper";

const TODAY = "2026-07-20";
const MAX = "2026-07-23"; // D+3

describe("stepperView (안전지도 날짜 스테퍼)", () => {
  it("current 없음 → 오늘 선택, 이전 없음, 다음은 +1일", () => {
    expect(stepperView(undefined, TODAY, MAX)).toEqual({
      selected: TODAY,
      prev: undefined,
      next: "2026-07-21",
    });
  });

  it("중간 날짜 → 양쪽 이동 가능", () => {
    expect(stepperView("2026-07-22", TODAY, MAX)).toEqual({
      selected: "2026-07-22",
      prev: "2026-07-21",
      next: "2026-07-23",
    });
  });

  it("상한(D+3) → 다음 없음", () => {
    expect(stepperView(MAX, TODAY, MAX)).toEqual({
      selected: MAX,
      prev: "2026-07-22",
      next: undefined,
    });
  });

  it("상한 초과 → D+3으로 클램프", () => {
    expect(stepperView("2026-08-15", TODAY, MAX).selected).toBe(MAX);
  });

  it("과거 날짜(방어) → 오늘로 클램프", () => {
    expect(stepperView("2026-07-01", TODAY, MAX)).toEqual({
      selected: TODAY,
      prev: undefined,
      next: "2026-07-21",
    });
  });
});
