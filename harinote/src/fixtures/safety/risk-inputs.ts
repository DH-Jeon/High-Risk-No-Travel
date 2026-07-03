/**
 * 위험 입력 mock — [스텁] 점수 엔진 에이전트가 시나리오 3종과 함께 완전 구현 예정.
 * 계약: mockRiskInputFor(place, scenario?) — 같은 place에는 항상 같은 값(결정적)이어야 한다.
 */
import type { Place } from "@/lib/tour/types";
import type { RiskInput, ScenarioKey } from "@/lib/safety/types";

export function mockRiskInputFor(
  place: Pick<Place, "contentId" | "envType">,
  scenario?: ScenarioKey,
): RiskInput {
  void place;
  void scenario;
  // TODO(점수엔진): contentId 기반 결정적 변주 + 시나리오(clear/heatwave/rainy/bad_air) 구현
  return {
    tempC: 28,
    rainProbPct: 20,
    windMs: 3,
    pm25: 15,
    forestFireLevel: 1,
    emergencyRoomKm: 8,
  };
}
