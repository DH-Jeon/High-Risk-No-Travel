import { describe, expect, it } from "vitest";
import { classifyEnvType } from "./classify";
import { gangwonPlaces } from "@/fixtures/tour/gangwon";

describe("classifyEnvType", () => {
  it("남이섬(하천 섬) → outdoor_water", () => {
    expect(
      classifyEnvType({ title: "남이섬", cat1: "A02", cat2: "A0202" }),
    ).toBe("outdoor_water");
  });

  it("무릉계곡 → outdoor_water (계곡 키워드)", () => {
    expect(classifyEnvType({ title: "무릉계곡" })).toBe("outdoor_water");
  });

  it("cat3 A01011800(강) 코드는 title 키워드보다 우선한다 (청령포)", () => {
    // "청령포"는 "령"(산악 키워드)을 포함하지만 수변 코드가 우선
    expect(
      classifyEnvType({
        title: "청령포",
        cat1: "A01",
        cat2: "A0101",
        cat3: "A01011800",
      }),
    ).toBe("outdoor_water");
  });

  it("설악산 신흥사 → outdoor_mountain (산 키워드)", () => {
    expect(classifyEnvType({ title: "설악산 신흥사" })).toBe(
      "outdoor_mountain",
    );
  });

  it("cat3 A01010400(산) → outdoor_mountain", () => {
    expect(
      classifyEnvType({ title: "치악산", cat1: "A01", cat3: "A01010400" }),
    ).toBe("outdoor_mountain");
  });

  it("경포해변 → outdoor_coast (해변 키워드)", () => {
    expect(classifyEnvType({ title: "경포해변" })).toBe("outdoor_coast");
  });

  it("cat3 A01011200(해수욕장) → outdoor_coast", () => {
    expect(
      classifyEnvType({ title: "속초해수욕장", cat3: "A01011200" }),
    ).toBe("outdoor_coast");
  });

  it("DMZ박물관 → indoor (박물관 키워드)", () => {
    expect(classifyEnvType({ title: "DMZ박물관" })).toBe("indoor");
  });

  it("cat2 A0206(문화시설) → indoor", () => {
    expect(
      classifyEnvType({
        title: "춘천인형극장",
        cat1: "A02",
        cat2: "A0206",
      }),
    ).toBe("indoor");
  });

  it("화암동굴 → indoor (동굴은 기상 영향이 적어 실내 취급)", () => {
    expect(classifyEnvType({ title: "화암동굴" })).toBe("indoor");
  });

  it("음식점(cat1 A05) → indoor", () => {
    expect(
      classifyEnvType({
        title: "초당할머니순두부",
        cat1: "A05",
        cat2: "A0502",
        cat3: "A05020100",
      }),
    ).toBe("indoor");
  });

  it("삼악산 호수케이블카 → outdoor_water (수변이 산악보다 우선)", () => {
    expect(classifyEnvType({ title: "삼악산 호수케이블카" })).toBe(
      "outdoor_water",
    );
  });

  it("키워드·코드가 없으면 outdoor_general (강촌레일파크)", () => {
    expect(classifyEnvType({ title: "강촌레일파크" })).toBe("outdoor_general");
  });

  it("fixture의 envType은 모두 classifyEnvType 결과와 일치한다", () => {
    for (const place of gangwonPlaces) {
      expect(classifyEnvType(place), place.title).toBe(place.envType);
    }
  });
});
