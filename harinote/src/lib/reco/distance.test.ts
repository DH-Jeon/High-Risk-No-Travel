import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/reco/distance";

describe("haversineKm", () => {
  it("동일 지점은 0", () => {
    expect(haversineKm(37.8813, 127.7298, 37.8813, 127.7298)).toBe(0);
  });

  it("위도 1도 차이는 약 111.2km", () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 0);
  });

  it("춘천~강릉은 직선거리 약 100km대 초반", () => {
    // 춘천시청(37.8813, 127.7298) ~ 강릉시청(37.7519, 128.8761)
    const d = haversineKm(37.8813, 127.7298, 37.7519, 128.8761);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(110);
  });

  it("인자 순서를 바꿔도 거리는 같다 (대칭성)", () => {
    const ab = haversineKm(37.8813, 127.7298, 37.7519, 128.8761);
    const ba = haversineKm(37.7519, 128.8761, 37.8813, 127.7298);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
