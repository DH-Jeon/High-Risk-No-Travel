import type { Metadata } from "next";
import Link from "next/link";
import { getPlacesWithSafety } from "@/lib/datasource";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import {
  COURSE_THEMES,
  COURSE_THEME_META,
  buildThemedCourses,
  toThemedCourseDto,
} from "@/lib/course/themed";
import CourseCard from "@/components/CourseCard";
import ProfileChips from "@/components/ProfileChips";
import {
  buildQuery,
  parseProfile,
  parseSigungu,
  profileParam,
  type SearchParamValue,
} from "@/components/search-params";

export const metadata: Metadata = {
  title: "안전 코스 추천",
};

interface Props {
  searchParams: Promise<Record<string, SearchParamValue>>;
}

export default async function CoursesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const profile = parseProfile(sp.profile);
  const sigungu = parseSigungu(sp.sigungu);

  // ── 시군 미선택: 18개 시군 선택 그리드 ──
  if (sigungu === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          안전 코스 추천
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          시군을 고르면 오늘의 안전 점수를 기준으로 테마별 반나절 코스 3선을
          만들어 드려요.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(SIGUNGU_SEATS).map(([code, seat]) => (
            <Link
              key={code}
              href={`/courses${buildQuery({ sigungu: code, profile: profileParam(profile) })}`}
              className="rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-300"
            >
              {seat.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // ── 시군 선택됨: 테마별 코스 3선 ──
  const all = await getPlacesWithSafety(undefined, profile);
  const courses = buildThemedCourses(sigungu, all);
  const seat = SIGUNGU_SEATS[sigungu];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/courses${buildQuery({ profile: profileParam(profile) })}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition-colors hover:text-teal-700"
      >
        <span aria-hidden="true">←</span> 다른 시군 선택
      </Link>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        {seat.name} 안전 코스 3선
      </h1>
      <p className="mt-2 text-sm text-slate-500 sm:text-base">
        오늘의 안전 점수가 높은 곳으로 오전 → 점심 → 오후를 이었어요. 대안
        칩(⇄)을 누르면 스톱을 바꿀 수 있어요.
      </p>

      <div className="mt-4">
        <ProfileChips
          basePath="/courses"
          current={profile}
          extraParams={{ sigungu }}
        />
      </div>

      <div className="mt-6 space-y-6">
        {COURSE_THEMES.map((theme) => {
          const course = courses[theme];
          const meta = COURSE_THEME_META[theme];
          if (!course) {
            return (
              <article
                key={theme}
                className="rounded-2xl bg-slate-50 px-6 py-8 text-center ring-1 ring-slate-200"
              >
                <p className="text-3xl" aria-hidden="true">
                  {meta.emoji}
                </p>
                <h3 className="mt-2 font-bold text-slate-700">{meta.label}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  이 지역엔 해당 테마 코스를 만들 수 없어요 — 조건(테마 매칭
                  장소·안전점수 60점 이상·이동 반경)을 채우는 조합이 없어요.
                </p>
              </article>
            );
          }
          return (
            <CourseCard
              key={theme}
              course={toThemedCourseDto(course)}
              profile={profile}
            />
          );
        })}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-slate-400">
        코스는 오늘의 안전 점수를 기준으로 자동 생성된 참고 정보이며 안전을
        보장하지 않습니다. 방문 전 기상특보와 현지 안내를 확인하세요.
      </p>
    </div>
  );
}
