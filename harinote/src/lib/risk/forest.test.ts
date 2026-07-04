import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SIGUNGU_ADM_CODES,
  forestIndexToLevel,
  pickForestIndexForSigungu,
  type ForestPointRow,
} from "@/lib/risk/forest";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";

const ALL_SIGUNGU_CODES = Array.from({ length: 18 }, (_, i) => i + 1);

describe("forestIndexToLevel — 국가산불위험예보시스템 등급 경계", () => {
  it("낮음(<51) → 1", () => {
    expect(forestIndexToLevel(1)).toBe(1);
    expect(forestIndexToLevel(50)).toBe(1);
    expect(forestIndexToLevel(50.9)).toBe(1);
  });

  it("다소높음(51~65) → 2", () => {
    expect(forestIndexToLevel(51)).toBe(2);
    expect(forestIndexToLevel(65)).toBe(2);
    expect(forestIndexToLevel(65.9)).toBe(2);
  });

  it("높음(66~85) → 3", () => {
    expect(forestIndexToLevel(66)).toBe(3);
    expect(forestIndexToLevel(85)).toBe(3);
    expect(forestIndexToLevel(85.9)).toBe(3);
  });

  it("매우높음(≥86) → 4", () => {
    expect(forestIndexToLevel(86)).toBe(4);
    expect(forestIndexToLevel(100)).toBe(4);
  });
});

describe("시군 → 행정코드 매핑 테이블", () => {
  it("강원 18개 시군 전부 행정코드가 존재하고 51 prefix 5자리다", () => {
    for (const code of ALL_SIGUNGU_CODES) {
      const region = SIGUNGU_ADM_CODES[code];
      expect(region, `sigunguCode=${code}`).toBeDefined();
      expect(String(region.admCode), `sigunguCode=${code}`).toMatch(/^51\d{3}$/);
    }
  });

  it("행정코드가 중복되지 않는다", () => {
    const codes = Object.values(SIGUNGU_ADM_CODES).map((r) => r.admCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("대표점 테이블(SIGUNGU_SEATS)과 시군 명칭이 일치한다", () => {
    for (const code of ALL_SIGUNGU_CODES) {
      expect(SIGUNGU_ADM_CODES[code].name).toBe(SIGUNGU_SEATS[code].name);
    }
  });
});

describe("pickForestIndexForSigungu", () => {
  it("신코드(51xxx)로 매칭한다 (춘천 51110)", () => {
    const rows: ForestPointRow[] = [
      { sigucode: "51110", sigun: "춘천시", meanavg: 42 },
      { sigucode: "51150", sigun: "강릉시", meanavg: 70 },
    ];
    expect(pickForestIndexForSigungu(rows, 13)).toBe(42);
  });

  it("데이터가 구코드(42xxx)여도 매칭한다", () => {
    const rows: ForestPointRow[] = [{ sigucode: "42110", sigun: "춘천시", meanavg: 55 }];
    expect(pickForestIndexForSigungu(rows, 13)).toBe(55);
  });

  it("코드가 안 맞으면 시군 명칭으로 매칭한다", () => {
    const rows: ForestPointRow[] = [{ sigucode: "99999", sigun: "춘천시", meanavg: 61 }];
    expect(pickForestIndexForSigungu(rows, 13)).toBe(61);
  });

  it("해당 시군 행이 없으면 강원 전체 평균으로 폴백한다", () => {
    const rows: ForestPointRow[] = [
      { sigucode: "51150", sigun: "강릉시", meanavg: 40 },
      { sigucode: "51170", sigun: "동해시", meanavg: 60 },
    ];
    expect(pickForestIndexForSigungu(rows, 13)).toBe(50);
  });

  it("행이 하나도 없으면 undefined", () => {
    expect(pickForestIndexForSigungu([], 13)).toBeUndefined();
  });
});

/** data.go.kr 표준 래핑의 성공 응답 생성 */
function forestApiResponse(items: unknown): string {
  return JSON.stringify({
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE" },
      body: { items: { item: items }, numOfRows: 300, pageNo: 1, totalCount: 2 },
    },
  });
}

describe("fetchForestFireLevel — fetch 모킹", () => {
  beforeEach(() => {
    // 모듈 레벨 캐시를 테스트 간 격리
    vi.resetModules();
    vi.stubEnv("FOREST_API_KEY", "test-forest-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("강원 행의 meanavg를 4단계로 변환해 반환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          forestApiResponse([
            { doname: "강원특별자치도", sigucode: "51110", sigun: "춘천시", meanavg: "68.4" },
            { doname: "경상남도", sigucode: "48820", sigun: "고성군", meanavg: "95" },
          ]),
          { status: 200 },
        ),
      ),
    );
    const { fetchForestFireLevel } = await import("@/lib/risk/forest");
    await expect(fetchForestFireLevel(13)).resolves.toBe(3); // 68.4 → 높음
  });

  it("타 시도 행만 있으면 throw한다 (강원 유효값 없음)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          forestApiResponse([
            { doname: "경상남도", sigucode: "48820", sigun: "고성군", meanavg: "95" },
          ]),
          { status: 200 },
        ),
      ),
    );
    const { fetchForestFireLevel } = await import("@/lib/risk/forest");
    await expect(fetchForestFireLevel(2)).rejects.toThrow(/유효값이 없습니다/);
  });

  it("item이 단일 객체(비배열)여도 파싱한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          forestApiResponse({
            doname: "강원특별자치도",
            sigucode: "51110",
            sigun: "춘천시",
            meanavg: "30",
          }),
          { status: 200 },
        ),
      ),
    );
    const { fetchForestFireLevel } = await import("@/lib/risk/forest");
    await expect(fetchForestFireLevel(13)).resolves.toBe(1);
  });

  it("HTTP 403이면 활용신청 안내와 함께 throw한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })),
    );
    const { fetchForestFireLevel } = await import("@/lib/risk/forest");
    await expect(fetchForestFireLevel(13)).rejects.toThrow(/활용신청/);
  });

  it("키가 없으면 throw한다", async () => {
    vi.stubEnv("FOREST_API_KEY", "");
    vi.stubEnv("TOUR_API_KEY", "");
    const { fetchForestFireLevel } = await import("@/lib/risk/forest");
    await expect(fetchForestFireLevel(13)).rejects.toThrow(/FOREST_API_KEY/);
  });

  it("같은 캐시 창 안에서는 시군이 달라도 fetch를 1회만 호출한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        forestApiResponse([
          { doname: "강원특별자치도", sigucode: "51110", sigun: "춘천시", meanavg: "40" },
          { doname: "강원특별자치도", sigucode: "51150", sigun: "강릉시", meanavg: "90" },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchForestFireLevel } = await import("@/lib/risk/forest");
    await expect(fetchForestFireLevel(13)).resolves.toBe(1);
    await expect(fetchForestFireLevel(1)).resolves.toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
