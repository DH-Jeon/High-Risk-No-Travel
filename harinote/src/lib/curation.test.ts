import { describe, expect, it } from "vitest";
import { CURATED_PLACES } from "@/lib/curation";
import { getPlace } from "@/lib/datasource";

describe("CURATED_PLACES", () => {
  it("정확히 10곳이다", () => {
    expect(CURATED_PLACES).toHaveLength(10);
  });

  it("contentId 중복이 없다", () => {
    const ids = CURATED_PLACES.map((e) => e.contentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("blurb가 비어있지 않다", () => {
    for (const entry of CURATED_PLACES) {
      expect(entry.blurb.trim().length).toBeGreaterThan(0);
    }
  });

  it("모든 큐레이션이 데이터소스에 실존한다 (없는 관광지 하드코딩 방지)", async () => {
    for (const entry of CURATED_PLACES) {
      const place = await getPlace(entry.contentId);
      expect(place, `contentId ${entry.contentId} not found`).not.toBeNull();
    }
  });
});
