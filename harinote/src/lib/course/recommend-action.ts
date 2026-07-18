"use server";

/**
 * AI 코스 추천 서버 액션 — 팝업(클라이언트)에서 시군·프로필을 받아
 * 테마 3종 코스를 DTO로 반환한다. 테마 전환은 클라이언트 로컬 필터라
 * (sigungu, profile) 조합당 1회만 호출된다.
 */
import { getPlacesWithSafety } from "@/lib/datasource";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import { PROFILE_LABEL, type Profile } from "@/lib/safety/types";
import {
  buildThemedCourses,
  toThemedCourseDto,
  type CourseTheme,
  type ThemedCourseDto,
} from "@/lib/course/themed";

export async function recommendCourses(
  sigunguCode: number,
  profile: Profile,
): Promise<Record<CourseTheme, ThemedCourseDto | null>> {
  // 서버 액션은 공개 엔드포인트 — 클라이언트 타입을 믿지 않고 검증
  if (!(sigunguCode in SIGUNGU_SEATS) || !(profile in PROFILE_LABEL)) {
    throw new Error("잘못된 요청입니다.");
  }

  const courses = buildThemedCourses(
    sigunguCode,
    await getPlacesWithSafety(undefined, profile),
  );
  return {
    nature: courses.nature && toThemedCourseDto(courses.nature),
    water: courses.water && toThemedCourseDto(courses.water),
    culture: courses.culture && toThemedCourseDto(courses.culture),
  };
}
