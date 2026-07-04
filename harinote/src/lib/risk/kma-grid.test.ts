import { describe, expect, it } from "vitest";
import { latLngToGrid } from "@/lib/risk/kma-grid";

describe("latLngToGrid", () => {
  it("서울시청(37.5665, 126.9780) → (60, 127)", () => {
    expect(latLngToGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
  });

  it("춘천시청(37.8813, 127.7298) → (73, 134)", () => {
    expect(latLngToGrid(37.8813, 127.7298)).toEqual({ nx: 73, ny: 134 });
  });

  it("강릉시청(37.7519, 128.8761) → (92, 132) — 공식 격자표(92,131)와 5km 격자 반올림 경계 1칸 이내", () => {
    const { nx, ny } = latLngToGrid(37.7519, 128.8761);
    expect(nx).toBe(92);
    expect(Math.abs(ny - 131)).toBeLessThanOrEqual(1);
  });

  it("기준점 위경도(38.0, 126.0)는 기준 격자(43, 136)로 떨어진다", () => {
    expect(latLngToGrid(38.0, 126.0)).toEqual({ nx: 43, ny: 136 });
  });

  it("순수 함수 — 같은 입력에 항상 같은 출력", () => {
    expect(latLngToGrid(37.4499, 129.1651)).toEqual(latLngToGrid(37.4499, 129.1651));
  });
});
