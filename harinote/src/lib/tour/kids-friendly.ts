/**
 * 유아 동반 가능 문화시설 — 한국문화정보원 "전국 가족 유아 동반 가능 문화시설
 * 위치 데이터"(2022-10-31 기준)를 관광지와 매칭한 내장 데이터.
 * 재생성: analysis/18_kids_match.py (이름 정규화 일치 + 좌표 ≤500m)
 * ⚠️ 2022년 조사 기준 — 화면에 기준 시점을 표기한다.
 */
import kidsJson from "@/data/kids-friendly.json";

export interface KidsInfo {
  nursing: boolean;
  familyToilet: boolean;
  stroller: boolean;
  kidsZone: boolean;
  age?: string;
}

const KIDS_FRIENDLY = kidsJson as Record<string, KidsInfo>;

export function isKidsFriendly(contentId: number): boolean {
  return String(contentId) in KIDS_FRIENDLY;
}

export function kidsInfoOf(contentId: number): KidsInfo | undefined {
  return KIDS_FRIENDLY[String(contentId)];
}

/** 보유 편의시설 라벨 목록 (있는 것만) */
export function kidsAmenityLabels(info: KidsInfo): string[] {
  const labels: string[] = [];
  if (info.kidsZone) labels.push("키즈존");
  if (info.nursing) labels.push("수유실");
  if (info.familyToilet) labels.push("가족 화장실");
  if (info.stroller) labels.push("유모차 대여");
  return labels;
}
