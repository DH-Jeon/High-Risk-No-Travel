/**
 * envType 데이터 기반 보정 — 분석(analysis/)이 찾은 규칙 사각지대를 로드 시점에 덮어쓴다.
 *
 * 근거: 위험 유형 클러스터링(analysis/SUMMARY.md)에서 "고지·오지형"으로 분류된
 * 관광지 중 표고 400m 이상 93곳 — 명칭·카테고리 휴리스틱(classify.ts)은
 * outdoor_general로 판정하지만 실질은 산악 환경(산불·강풍 가중 누락).
 * 목록 재생성: analysis/10_apply_typology.py 기준과 동일 (analysis/data/envtype_fix_impact.csv 참고).
 *
 * gangwon.json(수집 원본)은 수정하지 않는다 — 재시드에도 보정이 유지되도록 로드 시 적용.
 */
import type { Place, PlaceEnvType } from "@/lib/tour/types";
import overrides from "@/data/envtype-overrides.json";

const ENV_OVERRIDES = overrides as Record<string, PlaceEnvType>;

export function applyEnvTypeOverrides(places: Place[]): Place[] {
  return places.map((p) => {
    const fixed = ENV_OVERRIDES[String(p.contentId)];
    return fixed && fixed !== p.envType ? { ...p, envType: fixed } : p;
  });
}

/** 보정 대상 수 — 테스트·검증용 */
export const ENV_OVERRIDE_COUNT = Object.keys(ENV_OVERRIDES).length;
