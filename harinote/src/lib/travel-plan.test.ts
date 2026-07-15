import { describe, expect, it } from "vitest";
import {
  addItem,
  EMPTY_PLAN,
  isValidPlan,
  removeItem,
  reorder,
  setRange,
  totalDistanceKm,
  type PlanItem,
} from "@/lib/travel-plan";

const A: PlanItem = { contentId: 1, title: "A", lat: 37.75, lng: 128.87 }; // 강릉
const B: PlanItem = { contentId: 2, title: "B", lat: 37.88, lng: 127.73 }; // 춘천
const C: PlanItem = { contentId: 3, title: "C", lat: 38.21, lng: 128.59 }; // 속초

describe("addItem", () => {
  it("뒤에 추가하고 원본을 변경하지 않는다", () => {
    const p = addItem(EMPTY_PLAN, A);
    expect(p.items.map((i) => i.contentId)).toEqual([1]);
    expect(EMPTY_PLAN.items).toEqual([]);
  });
  it("중복 contentId는 무시 (같은 참조 반환)", () => {
    const p = addItem(addItem(EMPTY_PLAN, A), A);
    expect(p.items).toHaveLength(1);
  });
});

describe("removeItem", () => {
  it("해당 항목만 제거", () => {
    const p = addItem(addItem(EMPTY_PLAN, A), B);
    expect(removeItem(p, 1).items.map((i) => i.contentId)).toEqual([2]);
  });
});

describe("reorder", () => {
  const p3 = addItem(addItem(addItem(EMPTY_PLAN, A), B), C);
  it("앞→뒤 이동", () => {
    expect(reorder(p3, 0, 2).items.map((i) => i.contentId)).toEqual([2, 3, 1]);
  });
  it("뒤→앞 이동", () => {
    expect(reorder(p3, 2, 0).items.map((i) => i.contentId)).toEqual([3, 1, 2]);
  });
  it("범위 밖·동일 위치는 원본 유지", () => {
    expect(reorder(p3, 0, 0)).toBe(p3);
    expect(reorder(p3, 5, 0)).toBe(p3);
  });
});

describe("setRange / totalDistanceKm", () => {
  it("기간 저장", () => {
    const p = setRange(EMPTY_PLAN, "2026-08-01", "2026-08-03");
    expect([p.from, p.to]).toEqual(["2026-08-01", "2026-08-03"]);
  });
  it("0~1개 항목이면 거리 0", () => {
    expect(totalDistanceKm(EMPTY_PLAN)).toBe(0);
    expect(totalDistanceKm(addItem(EMPTY_PLAN, A))).toBe(0);
  });
  it("순서대로 이어붙인 거리 (양수, 순서 바뀌면 달라짐)", () => {
    const p = addItem(addItem(addItem(EMPTY_PLAN, A), B), C);
    const d1 = totalDistanceKm(p);
    const d2 = totalDistanceKm(reorder(p, 0, 2));
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(0);
    expect(d1).not.toBe(d2);
  });
});

describe("isValidPlan", () => {
  it("정상 구조 통과, 손상 값 거부", () => {
    expect(isValidPlan({ items: [A] })).toBe(true);
    expect(isValidPlan({ items: [{ contentId: "x" }] })).toBe(false);
    expect(isValidPlan(null)).toBe(false);
    expect(isValidPlan({ items: "nope" })).toBe(false);
  });
});
