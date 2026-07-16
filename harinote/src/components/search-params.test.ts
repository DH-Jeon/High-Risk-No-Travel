import { describe, expect, it } from "vitest";
import {
  MAX_RANGE_DAYS,
  parseCourseTheme,
  parseDateRange,
  parsePlaceType,
  parseSigungu,
  placeTypeToQuery,
} from "@/components/search-params";
import { CAT3_CAFE } from "@/lib/tour/types";
import { addDaysISO, todayISOSeoul } from "@/lib/date";

describe("parseSigungu", () => {
  it("SIGUNGU_SEATS에 있는 코드(1~18)는 숫자로 반환", () => {
    expect(parseSigungu("1")).toBe(1);
    expect(parseSigungu("13")).toBe(13);
    expect(parseSigungu("18")).toBe(18);
  });

  it("범위 밖 코드는 undefined", () => {
    expect(parseSigungu("0")).toBeUndefined();
    expect(parseSigungu("19")).toBeUndefined();
    expect(parseSigungu("-1")).toBeUndefined();
  });

  it("숫자가 아니거나 비어 있으면 undefined", () => {
    expect(parseSigungu("abc")).toBeUndefined();
    expect(parseSigungu("")).toBeUndefined();
    expect(parseSigungu(undefined)).toBeUndefined();
  });

  it("배열이면 첫 값 기준", () => {
    expect(parseSigungu(["5", "13"])).toBe(5);
  });
});

describe("parsePlaceType", () => {
  it('"cafe" 슬러그는 그대로 반환', () => {
    expect(parsePlaceType("cafe")).toBe("cafe");
  });

  it("SUPPORTED 화이트리스트 숫자는 ContentTypeId로 반환", () => {
    expect(parsePlaceType("12")).toBe(12);
    expect(parsePlaceType("14")).toBe(14);
    expect(parsePlaceType("39")).toBe(39);
  });

  it("미지원 숫자·무효 문자열·빈 값은 undefined", () => {
    expect(parsePlaceType("38")).toBeUndefined();
    expect(parsePlaceType("espresso")).toBeUndefined();
    expect(parsePlaceType("")).toBeUndefined();
    expect(parsePlaceType(undefined)).toBeUndefined();
  });

  it("배열이면 첫 값 기준", () => {
    expect(parsePlaceType(["cafe", "12"])).toBe("cafe");
    expect(parsePlaceType(["12", "cafe"])).toBe(12);
  });
});

describe("placeTypeToQuery", () => {
  it('"cafe"는 음식점(39) + 카페 소분류(cat3) 조합', () => {
    expect(placeTypeToQuery("cafe")).toEqual({
      contentTypeId: 39,
      cat3: CAT3_CAFE,
    });
  });

  it("숫자 유형은 contentTypeId만", () => {
    expect(placeTypeToQuery(12)).toEqual({ contentTypeId: 12 });
  });

  it("undefined(전체)는 빈 쿼리", () => {
    expect(placeTypeToQuery(undefined)).toEqual({});
  });
});

describe("parseDateRange", () => {
  /** KST 오늘 기준 +days일의 ISO — parseDate와 같은 기준이라 버퍼 불필요 */
  const isoAfter = (days: number) => addDaysISO(todayISOSeoul(), days);

  it("정상 범위는 {start, end}", () => {
    expect(parseDateRange(isoAfter(7), isoAfter(10))).toEqual({
      start: isoAfter(7),
      end: isoAfter(10),
    });
  });

  it("end 없으면 단일 날짜 (기존 동작과 동일)", () => {
    expect(parseDateRange(isoAfter(7), undefined)).toEqual({
      start: isoAfter(7),
    });
  });

  it("end가 start 이전이거나 같으면 {start}만", () => {
    expect(parseDateRange(isoAfter(7), isoAfter(5))).toEqual({
      start: isoAfter(7),
    });
    expect(parseDateRange(isoAfter(7), isoAfter(7))).toEqual({
      start: isoAfter(7),
    });
  });

  it("MAX_RANGE_DAYS 초과면 end를 start+13일로 clamp", () => {
    expect(parseDateRange(isoAfter(7), isoAfter(7 + 30))).toEqual({
      start: isoAfter(7),
      end: isoAfter(7 + MAX_RANGE_DAYS - 1),
    });
    // 정확히 14일(13박)은 clamp하지 않는다
    expect(parseDateRange(isoAfter(7), isoAfter(7 + 13))).toEqual({
      start: isoAfter(7),
      end: isoAfter(7 + 13),
    });
  });

  it("end 형식 오류는 {start}만", () => {
    expect(parseDateRange(isoAfter(7), "2026-02-31")).toEqual({
      start: isoAfter(7),
    });
    expect(parseDateRange(isoAfter(7), "다음주")).toEqual({
      start: isoAfter(7),
    });
  });

  it("start 없이 end만 있으면 빈 결과 (end 무시)", () => {
    expect(parseDateRange(undefined, isoAfter(10))).toEqual({});
    expect(parseDateRange("2026-02-31", isoAfter(10))).toEqual({});
  });

  it("366일 경계: start는 허용, 그 밖의 end는 버려진다", () => {
    expect(parseDateRange(isoAfter(366), isoAfter(370))).toEqual({
      start: isoAfter(366),
    });
    expect(parseDateRange(isoAfter(367), isoAfter(370))).toEqual({});
  });
});

describe("parseCourseTheme", () => {
  it("COURSE_THEMES에 있는 값은 그대로 반환", () => {
    expect(parseCourseTheme("nature")).toBe("nature");
    expect(parseCourseTheme("water")).toBe("water");
    expect(parseCourseTheme("culture")).toBe("culture");
  });

  it("없는 값·빈 값은 undefined(전체)", () => {
    expect(parseCourseTheme("food")).toBeUndefined();
    expect(parseCourseTheme("")).toBeUndefined();
    expect(parseCourseTheme(undefined)).toBeUndefined();
  });

  it("배열이면 첫 값 기준", () => {
    expect(parseCourseTheme(["water", "nature"])).toBe("water");
  });
});
