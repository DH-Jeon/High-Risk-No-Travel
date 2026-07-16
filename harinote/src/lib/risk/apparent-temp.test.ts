import { describe, expect, it } from "vitest";
import { apparentTempSummerC, wetBulbC } from "@/lib/risk/apparent-temp";

describe("wetBulbC — Stull(2011) 습구온도 근사", () => {
  it("Ta=20℃, RH=50% → Tw≈13.7 (논문 예시값, ±0.3)", () => {
    expect(Math.abs(wetBulbC(20.0, 50) - 13.7)).toBeLessThanOrEqual(0.3);
  });
});

describe("apparentTempSummerC — 기상청 여름철 체감온도", () => {
  it("Ta=31℃, RH=80% → 체감 33℃ 이상 (폭염주의보 상황 재현)", () => {
    const at = apparentTempSummerC(31, 80);
    expect(at).toBeGreaterThanOrEqual(33);
    // 건구기온(31℃)보다 확실히 높다 — 습도 반영 확인
    expect(at).toBeGreaterThan(31);
  });

  it("RH 고정 시 Ta에 대해 단조증가", () => {
    const rh = 60;
    expect(apparentTempSummerC(29, rh)).toBeLessThan(apparentTempSummerC(31, rh));
    expect(apparentTempSummerC(31, rh)).toBeLessThan(apparentTempSummerC(33, rh));
    expect(apparentTempSummerC(33, rh)).toBeLessThan(apparentTempSummerC(35, rh));
  });

  it("Ta 고정 시 RH에 대해 단조증가", () => {
    const ta = 31;
    expect(apparentTempSummerC(ta, 40)).toBeLessThan(apparentTempSummerC(ta, 60));
    expect(apparentTempSummerC(ta, 60)).toBeLessThan(apparentTempSummerC(ta, 80));
    expect(apparentTempSummerC(ta, 80)).toBeLessThan(apparentTempSummerC(ta, 100));
  });

  it("RH 경계값(0·100)에서 유한한 값을 반환한다", () => {
    expect(Number.isFinite(apparentTempSummerC(31, 0))).toBe(true);
    expect(Number.isFinite(apparentTempSummerC(31, 100))).toBe(true);
  });

  it("RH 범위 밖 입력은 0~100으로 clamp — -5는 0, 120은 100과 동일", () => {
    expect(apparentTempSummerC(31, -5)).toBe(apparentTempSummerC(31, 0));
    expect(apparentTempSummerC(31, 120)).toBe(apparentTempSummerC(31, 100));
    expect(wetBulbC(31, -5)).toBe(wetBulbC(31, 0));
    expect(wetBulbC(31, 120)).toBe(wetBulbC(31, 100));
  });
});
