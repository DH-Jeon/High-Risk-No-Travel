import { describe, expect, it } from "vitest";
import { GANGWON_GEO } from "./gangwon";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";

describe("gangwon-geo 정적 데이터", () => {
  it("강원 18개 시군이 모두 있고 SIGUNGU_SEATS와 코드·이름이 일치한다", () => {
    expect(GANGWON_GEO.regions).toHaveLength(18);
    for (const region of GANGWON_GEO.regions) {
      expect(SIGUNGU_SEATS[region.sigunguCode]?.name).toBe(region.name);
    }
  });

  it("모든 링은 좌표 3개 이상이고 [lat, lng]가 강원 범위 안이다", () => {
    const allRings = [
      ...GANGWON_GEO.maskHoles,
      ...GANGWON_GEO.regions.flatMap((r) => r.rings),
    ];
    expect(allRings.length).toBeGreaterThan(0);
    for (const ring of allRings) {
      expect(ring.length).toBeGreaterThanOrEqual(3);
      for (const [lat, lng] of ring) {
        expect(lat).toBeGreaterThan(36.5); // 강원 위도 대략 37.0~38.7
        expect(lat).toBeLessThan(39.0);
        expect(lng).toBeGreaterThan(126.5); // 경도 대략 127.0~129.5
        expect(lng).toBeLessThan(130.0);
      }
    }
  });
});
