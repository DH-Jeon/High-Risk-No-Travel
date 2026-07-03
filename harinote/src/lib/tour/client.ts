/**
 * TourAPI(KorService2) 클라이언트 — [스텁] 데이터 에이전트가 완전 구현 예정.
 * 계약: fetchGangwonPlaces() — 강원(areaCode=32) 관광지를 Place[]로 반환.
 * 서버 전용 — TOUR_API_KEY는 클라이언트 번들에 노출 금지.
 */
import type { Place } from "@/lib/tour/types";

export async function fetchGangwonPlaces(): Promise<Place[]> {
  // TODO(데이터): areaBasedList2 페이지네이션 + zod 검증 + 정규화
  throw new Error(
    "TourAPI live 클라이언트가 아직 구현되지 않았습니다. DATA_SOURCE=mock을 사용하세요.",
  );
}
