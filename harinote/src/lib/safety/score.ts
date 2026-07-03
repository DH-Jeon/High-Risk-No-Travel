/**
 * 안전 점수 엔진 — [스텁] 점수 엔진 에이전트가 weights.ts와 함께 완전 구현 예정.
 * 시그니처는 계약: computeSafetyScore(input, place, profile) => RiskBreakdown
 */
import type { Place } from "@/lib/tour/types";
import type { Profile, RiskBreakdown, RiskInput } from "@/lib/safety/types";

export function computeSafetyScore(
  input: RiskInput,
  place: Pick<Place, "envType">,
  profile: Profile = "default",
): RiskBreakdown {
  void input;
  void place;
  // TODO(점수엔진): 공식 임계값 기반 가중합 구현
  return {
    score: 75,
    grade: "low",
    profile,
    factors: [],
    weatherRisk: 10,
    disasterRisk: 5,
    medicalRisk: 5,
    mobilityRisk: 5,
  };
}
