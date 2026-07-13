import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLiveRiskInput, gridPointFor, hasLiveRiskKeys } from "@/lib/risk/live";
import { nearestHospitalKm } from "@/lib/risk/medical";
import { mockRiskInputFor } from "@/fixtures/safety/risk-inputs";
import { latLngToGrid } from "@/lib/risk/kma-grid";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";

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

describe("gridPointFor — 격자 선택", () => {
  // 발왕산 자락 좌표 (평창군청에서 ~30km, 표고 1,400m대) — 시군청 격자와 달라야 한다
  const mountainPlace = {
    envType: "outdoor_mountain" as const,
    sigunguCode: 15, // 평창
    lat: 37.6358,
    lng: 128.3957,
  };

  it("일반 야외는 시군 대표점 격자를 쓴다", () => {
    const seat = SIGUNGU_SEATS[13]; // 춘천
    expect(gridPointFor(place)).toEqual(latLngToGrid(seat.lat, seat.lng));
  });

  it("산악형은 시군 대표점 대신 자기 좌표 격자를 쓴다", () => {
    const own = latLngToGrid(mountainPlace.lat, mountainPlace.lng);
    expect(gridPointFor(mountainPlace)).toEqual(own);

    const seat = SIGUNGU_SEATS[15];
    expect(own).not.toEqual(latLngToGrid(seat.lat, seat.lng));
  });

  it("시군코드가 없으면 자기 좌표 격자로 폴백한다", () => {
    const noSigungu = { ...place, sigunguCode: undefined };
    expect(gridPointFor(noSigungu)).toEqual(latLngToGrid(place.lat, place.lng));
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

  it("두 소스가 모두 실패하면 throw 없이 mock을 반환하고, 경고는 1회만 남긴다", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // emergencyRoomKm만은 네트워크 없이 내장 병원 좌표로 실계산된다
    const expected = (p: typeof place) => ({
      ...mockRiskInputFor(p),
      emergencyRoomKm: Math.round(nearestHospitalKm(p.lat, p.lng) * 10) / 10,
    });

    const first = await getLiveRiskInput(place);
    expect(first).toEqual(expected(place));

    // 두 번째 호출(다른 관광지, 같은 시군)에도 경고가 중복되지 않는다
    const second = await getLiveRiskInput({ ...place, contentId: 226001 });
    expect(second).toEqual(expected({ ...place, contentId: 226001 }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
