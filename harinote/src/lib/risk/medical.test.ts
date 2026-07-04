import { describe, expect, it } from "vitest";
import { medicalDataSource, nearestHospitalKm } from "@/lib/risk/medical";

describe("nearestHospitalKm — 알려진 좌표 합리성", () => {
  it("춘천 시내(시청 인근)는 수 km 이내 — 한림대춘천성심·강원대병원", () => {
    const km = nearestHospitalKm(37.8813, 127.7298);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(5);
  });

  it("가리왕산 정상 일대는 10km 이상 (최근접: 정선병원 ~12km)", () => {
    const km = nearestHospitalKm(37.4635, 128.5605);
    expect(km).toBeGreaterThan(10);
    expect(km).toBeLessThan(30);
  });

  it("점봉산 곰배령(인제 심산)은 15km 이상", () => {
    const km = nearestHospitalKm(38.0489, 128.4253);
    expect(km).toBeGreaterThan(15);
  });

  it("강릉아산병원 앞마당은 0km에 수렴", () => {
    expect(nearestHospitalKm(37.818426, 128.857705)).toBeLessThan(0.1);
  });
});

describe("nearestHospitalKm — contentId 메모이즈", () => {
  it("같은 contentId는 좌표가 달라도 캐시값을 돌려준다 (좌표 불변 전제)", () => {
    const contentId = 999_000_001; // 실데이터와 겹치지 않는 테스트 전용 id
    const first = nearestHospitalKm(37.8813, 127.7298, contentId);
    const second = nearestHospitalKm(37.1641, 128.9856, contentId); // 태백 좌표를 줘도
    expect(second).toBe(first);
  });

  it("contentId 없이 부르면 매번 실계산한다", () => {
    const chuncheon = nearestHospitalKm(37.8813, 127.7298);
    const taebaek = nearestHospitalKm(37.1641, 128.9856);
    expect(taebaek).not.toBe(chuncheon);
  });
});

describe("medicalDataSource", () => {
  it("UI 각주용 출처 문자열을 반환한다", () => {
    expect(medicalDataSource()).toContain("국립중앙의료원");
  });
});
