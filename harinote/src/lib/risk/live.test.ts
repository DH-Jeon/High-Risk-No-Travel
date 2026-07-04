import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLiveRiskInput, hasLiveRiskKeys } from "@/lib/risk/live";
import { mockRiskInputFor } from "@/fixtures/safety/risk-inputs";

const place = {
  contentId: 126508,
  envType: "outdoor_general" as const,
  sigunguCode: 13, // 춘천
  lat: 37.8813,
  lng: 127.7298,
};

describe("hasLiveRiskKeys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("두 키가 모두 있으면 true", () => {
    vi.stubEnv("KMA_API_KEY", "test-kma-key");
    vi.stubEnv("AIRKOREA_API_KEY", "test-airkorea-key");
    expect(hasLiveRiskKeys()).toBe(true);
  });

  it("하나라도 없으면 false", () => {
    vi.stubEnv("KMA_API_KEY", "test-kma-key");
    vi.stubEnv("AIRKOREA_API_KEY", "");
    expect(hasLiveRiskKeys()).toBe(false);
  });
});

describe("getLiveRiskInput — 전체 실패 폴백", () => {
  beforeEach(() => {
    vi.stubEnv("KMA_API_KEY", "test-kma-key");
    vi.stubEnv("AIRKOREA_API_KEY", "test-airkorea-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("두 소스가 모두 실패하면 throw 없이 mock 전체를 반환하고, 경고는 1회만 남긴다", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = await getLiveRiskInput(place);
    expect(first).toEqual(mockRiskInputFor(place));

    // 두 번째 호출(다른 관광지, 같은 시군)에도 경고가 중복되지 않는다
    const second = await getLiveRiskInput({ ...place, contentId: 226001 });
    expect(second).toEqual(mockRiskInputFor({ ...place, contentId: 226001 }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
