/**
 * 반려동물 동반 가능 관광지 — scripts/seed-pet.ts가 배치 수집한 내장 데이터.
 * (상세 페이지는 detailPetTour2 실시간 조회를 쓴다 — lib/tour/pet.ts)
 */
import petJson from "@/data/pet-friendly.json";
import type { PetTourInfo } from "@/lib/tour/pet";

const PET_FRIENDLY = petJson as Record<string, PetTourInfo>;

export function isPetFriendly(contentId: number): boolean {
  return String(contentId) in PET_FRIENDLY;
}

export function petInfoOf(contentId: number): PetTourInfo | undefined {
  return PET_FRIENDLY[String(contentId)];
}

export function petFriendlyCount(): number {
  return Object.keys(PET_FRIENDLY).length;
}
