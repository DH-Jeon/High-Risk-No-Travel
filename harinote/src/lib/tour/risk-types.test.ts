import { describe, expect, it } from "vitest";
import gangwon from "@/data/gangwon.json";
import riskTypes from "@/data/risk-types.json";
import type { Place } from "@/lib/tour/types";
import { getRiskType, RISK_TYPE_META, RISK_TYPE_COUNT } from "./risk-types";

const places = gangwon as Place[];
const entries = riskTypes as Record<string, string>;

describe("위험 유형 (사계절 7유형) 데이터 계약", () => {
  it("유형 목록의 contentId는 전부 수집 데이터에 존재한다 (재시드 드리프트 감지)", () => {
    const ids = new Set(places.map((p) => String(p.contentId)));
    const missing = Object.keys(entries).filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it("모든 유형 값은 general 또는 배지 메타에 정의된 키다", () => {
    const known = new Set(["general", ...Object.keys(RISK_TYPE_META)]);
    const unknown = [...new Set(Object.values(entries))].filter((t) => !known.has(t));
    expect(unknown).toEqual([]);
  });

  it("관광지(contentTypeId=12) 전체가 유형을 가진다", () => {
    const attractions = places.filter((p) => p.contentTypeId === 12);
    const withType = attractions.filter((p) => getRiskType(p.contentId));
    expect(withType.length).toBe(attractions.length);
    expect(RISK_TYPE_COUNT).toBe(attractions.length);
  });

  it("배지 메타는 emoji·label·caution·pill을 모두 가진다", () => {
    for (const meta of Object.values(RISK_TYPE_META)) {
      expect(meta.emoji).toBeTruthy();
      expect(meta.label).toBeTruthy();
      expect(meta.caution).toBeTruthy();
      expect(meta.pill).toContain("ring-");
    }
  });
});
