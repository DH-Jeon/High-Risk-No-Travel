import { describe, expect, it } from "vitest";
import { extractOverview } from "@/lib/tour/overview";

function wrap(item: unknown) {
  return {
    response: {
      header: { resultCode: "0000" },
      body: { items: { item } },
    },
  };
}

describe("extractOverview (detailCommon2 응답 파싱)", () => {
  it("HTML 태그·엔티티·과잉 공백을 정리한 평문을 돌려준다", () => {
    const json = wrap({
      overview:
        "설악산은  강원도의 <b>명산</b>이다.<br/>가을 단풍이&nbsp;유명하다.",
    });
    expect(extractOverview(json)).toBe(
      "설악산은 강원도의 명산이다. 가을 단풍이 유명하다.",
    );
  });

  it("item이 배열이어도 첫 항목을 쓴다", () => {
    const json = wrap([{ overview: "첫 소개" }, { overview: "둘째" }]);
    expect(extractOverview(json)).toBe("첫 소개");
  });

  it("overview가 없거나 빈 문자열이면 undefined", () => {
    expect(extractOverview(wrap({ overview: "" }))).toBeUndefined();
    expect(extractOverview(wrap({}))).toBeUndefined();
    expect(
      extractOverview({
        response: { header: { resultCode: "0000" }, body: { items: "" } },
      }),
    ).toBeUndefined();
  });

  it("오류 resultCode·이상 구조는 undefined (throw 없음)", () => {
    expect(
      extractOverview({
        response: { header: { resultCode: "9999" }, body: {} },
      }),
    ).toBeUndefined();
    expect(extractOverview("XML 문자열")).toBeUndefined();
    expect(extractOverview(null)).toBeUndefined();
  });
});
