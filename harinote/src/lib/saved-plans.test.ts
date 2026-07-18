import { describe, expect, it } from "vitest";
import {
  isValidSavedPlanList,
  MAX_SAVED_PLANS,
  removeSavedPlan,
  upsertSavedPlan,
  type SavedPlan,
} from "@/lib/saved-plans";

function entry(id: string, name = id): SavedPlan {
  return {
    id,
    name,
    savedAt: "2026-07-18T00:00:00.000Z",
    plan: { items: [{ contentId: 1, title: "A", lat: 37.75, lng: 128.87 }] },
  };
}

describe("upsertSavedPlan", () => {
  it("신규는 맨 앞에 추가하고 원본을 변경하지 않는다", () => {
    const list = [entry("a")];
    const next = upsertSavedPlan(list, entry("b"));
    expect(next.map((p) => p.id)).toEqual(["b", "a"]);
    expect(list).toHaveLength(1);
  });

  it("같은 id는 교체하고 맨 앞으로 이동", () => {
    const list = [entry("a"), entry("b")];
    const next = upsertSavedPlan(list, entry("b", "새 이름"));
    expect(next.map((p) => p.id)).toEqual(["b", "a"]);
    expect(next[0].name).toBe("새 이름");
  });

  it("MAX 초과 시 오래된 쪽(뒤)이 밀려난다", () => {
    let list: SavedPlan[] = [];
    for (let i = 0; i < MAX_SAVED_PLANS + 3; i++) {
      list = upsertSavedPlan(list, entry(`p${i}`));
    }
    expect(list).toHaveLength(MAX_SAVED_PLANS);
    expect(list[0].id).toBe(`p${MAX_SAVED_PLANS + 2}`);
    expect(list.some((p) => p.id === "p0")).toBe(false);
  });
});

describe("removeSavedPlan", () => {
  it("해당 항목만 제거", () => {
    const next = removeSavedPlan([entry("a"), entry("b")], "a");
    expect(next.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("isValidSavedPlanList", () => {
  it("정상 구조 통과", () => {
    expect(isValidSavedPlanList([entry("a")])).toBe(true);
    expect(isValidSavedPlanList([])).toBe(true);
  });
  it("손상 값 거부 (배열 아님·필드 누락·plan 손상)", () => {
    expect(isValidSavedPlanList(null)).toBe(false);
    expect(isValidSavedPlanList({})).toBe(false);
    expect(isValidSavedPlanList([{ id: "a" }])).toBe(false);
    expect(
      isValidSavedPlanList([{ ...entry("a"), plan: { items: "nope" } }]),
    ).toBe(false);
  });
});
