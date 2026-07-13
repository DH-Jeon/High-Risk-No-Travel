import { describe, expect, it } from "vitest";
import { extractFestivals } from "@/lib/tour/festival";

function wrap(items: unknown) {
  return {
    response: {
      header: { resultCode: "0000" },
      body: { items: { item: items } },
    },
  };
}

const base = {
  contentid: "674023",
  title: "테스트 축제",
  addr1: "강원 강릉시",
  mapx: "128.9",
  mapy: "37.8",
  sigungucode: "1",
};

describe("extractFestivals", () => {
  it("대상 날짜 기준 진행 중/예정을 분류하고 종료된 축제는 제외", () => {
    const json = wrap([
      { ...base, contentid: "1", eventstartdate: "20260710", eventenddate: "20260720" }, // 진행 중
      { ...base, contentid: "2", eventstartdate: "20260801", eventenddate: "20260805" }, // 예정
      { ...base, contentid: "3", eventstartdate: "20260701", eventenddate: "20260705" }, // 종료
    ]);
    const r = extractFestivals(json, "20260713");
    expect(r.map((f) => f.contentId)).toEqual([1, 2]);
    expect(r[0].ongoing).toBe(true);
    expect(r[1].ongoing).toBe(false);
  });

  it("진행 중이 먼저, 같은 그룹에서는 시작일 순", () => {
    const json = wrap([
      { ...base, contentid: "1", eventstartdate: "20260901", eventenddate: "20260905" },
      { ...base, contentid: "2", eventstartdate: "20260712", eventenddate: "20260720" },
      { ...base, contentid: "3", eventstartdate: "20260801", eventenddate: "20260810" },
    ]);
    expect(extractFestivals(json, "20260713").map((f) => f.contentId)).toEqual([2, 3, 1]);
  });

  it("좌표 0·비수치는 undefined로 (배지 생략 신호)", () => {
    const json = wrap([
      { ...base, mapx: "0", mapy: "0", eventstartdate: "20260712", eventenddate: "20260720" },
    ]);
    const [f] = extractFestivals(json, "20260713");
    expect(f.lat).toBeUndefined();
    expect(f.lng).toBeUndefined();
  });

  it("빈 items·오류 응답은 빈 배열", () => {
    expect(extractFestivals(wrap(undefined), "20260713")).toEqual([]);
    expect(
      extractFestivals(
        { response: { header: { resultCode: "0000" }, body: { items: "" } } },
        "20260713",
      ),
    ).toEqual([]);
    expect(extractFestivals(null, "20260713")).toEqual([]);
  });
});
