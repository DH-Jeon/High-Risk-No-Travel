import { describe, expect, it } from "vitest";
import gangwon from "@/data/gangwon.json";
import overrides from "@/data/envtype-overrides.json";
import type { Place } from "@/lib/tour/types";
import { applyEnvTypeOverrides, ENV_OVERRIDE_COUNT } from "./env-overrides";

const places = gangwon as Place[];

describe("envType 보정 (고지·오지 93곳 → outdoor_mountain)", () => {
  it("보정 목록의 contentId는 전부 수집 데이터에 존재한다 (재시드 드리프트 감지)", () => {
    const ids = new Set(places.map((p) => String(p.contentId)));
    const missing = Object.keys(overrides).filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it("보정 대상은 mountain으로 바뀌고, 나머지는 그대로다", () => {
    const fixed = applyEnvTypeOverrides(places);
    const ids = new Set(Object.keys(overrides));
    let changed = 0;
    for (let i = 0; i < places.length; i++) {
      if (ids.has(String(places[i].contentId))) {
        expect(fixed[i].envType).toBe("outdoor_mountain");
        if (places[i].envType !== "outdoor_mountain") changed++;
      } else {
        expect(fixed[i].envType).toBe(places[i].envType);
      }
    }
    expect(changed).toBe(ENV_OVERRIDE_COUNT);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const before = places.map((p) => p.envType);
    applyEnvTypeOverrides(places);
    expect(places.map((p) => p.envType)).toEqual(before);
  });
});
