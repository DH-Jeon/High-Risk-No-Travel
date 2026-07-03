/**
 * 강원 관광지 fixture — [스텁] 데이터 에이전트가 실존 30건+로 완전 구현 예정.
 * 계약: export const gangwonPlaces: Place[] (실좌표, KorService2 실제 contentId 사용)
 */
import type { Place } from "@/lib/tour/types";

export const gangwonPlaces: Place[] = [
  {
    contentId: 126273,
    contentTypeId: 12,
    title: "남이섬",
    addr: "강원특별자치도 춘천시 남산면 남이섬길 1",
    sigunguCode: 13,
    lng: 127.525,
    lat: 37.79,
    envType: "outdoor_water",
  },
];
