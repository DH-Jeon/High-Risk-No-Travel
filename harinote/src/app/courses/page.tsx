import type { Metadata } from "next";
import Link from "next/link";
import { getPlacesWithSafety } from "@/lib/datasource";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import {
  COURSE_THEMES,
  COURSE_THEME_META,
  buildThemedCourses,
  toThemedCourseDto,
  type CourseTheme,
} from "@/lib/course/themed";
import CourseCard from "@/components/CourseCard";
import ProfileChips from "@/components/ProfileChips";
import {
  buildQuery,
  parseCourseTheme,
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
  const theme = parseCourseTheme(sp.theme);

  const seat = sigungu !== undefined ? SIGUNGU_SEATS[sigungu] : undefined;
  const courses =
    sigungu !== undefined
      ? buildThemedCourses(sigungu, await getPlacesWithSafety(undefined, profile))
      : undefined;

  // 선택 상태를 유지한 채 한 파라미터만 바꾸는 쿼리
  const linkQuery = (patch: {
    sigungu?: number | string;
    theme?: CourseTheme;
  }) =>
    buildQuery({
      sigungu,
      theme,
      ...patch,
      profile: profileParam(profile),
    });

  const themesToShow: readonly CourseTheme[] = theme ? [theme] : COURSE_THEMES;

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        안전 코스 추천
      </h1>
      <p className="mt-2 text-sm text-slate-500 sm:text-base">
        테마와 시군을 고르면 오늘의 안전 점수를 기준으로 반나절 코스를 만들어
        드려요.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── 왼쪽: 입력 패널 ── */}
        <aside className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:sticky lg:top-6">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              여행 테마
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5 lg:flex-col">
              <Link
                href={`/courses${linkQuery({ theme: undefined })}`}
                aria-current={theme === undefined ? "true" : undefined}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  theme === undefined
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-700"
                }`}
              >
                ✨ 전체 3선
              </Link>
              {COURSE_THEMES.map((t) => {
                const meta = COURSE_THEME_META[t];
                const active = theme === t;
                return (
                  <Link
                    key={t}
                    href={`/courses${linkQuery({ theme: t })}`}
                    aria-current={active ? "true" : undefined}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-700"
                    }`}
                  >
                    {meta.emoji} {meta.label}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              지역 선택
            </h2>
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-2">
              {Object.entries(SIGUNGU_SEATS).map(([code, s]) => {
                const active = sigungu === Number(code);
                return (
                  <Link
                    key={code}
                    href={`/courses${linkQuery({ sigungu: code })}`}
                    aria-current={active ? "true" : undefined}
                    className={`rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-colors ${
                      active
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-700"
                    }`}
                  >
                    {s.name}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              동행 프로필
            </h2>
            <div className="mt-2">
              <ProfileChips
                basePath="/courses"
                current={profile}
                extraParams={{ sigungu, theme }}
              />
            </div>
          </section>
        </aside>

        {/* ── 오른쪽: 결과 ── */}
        <section aria-live="polite">
          {sigungu === undefined || courses === undefined ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
              <p className="text-4xl" aria-hidden="true">
                🗺️
              </p>
              <p className="mt-3 font-bold text-slate-700">
                왼쪽에서 시군을 선택해 주세요
              </p>
              <p className="mt-1 text-sm text-slate-500">
                오늘의 안전 점수가 높은 곳으로 오전 → 점심 → 오후 코스를 만들어
                드려요.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                {seat!.name}{" "}
                {theme ? `${COURSE_THEME_META[theme].label} 코스` : "안전 코스 3선"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                오늘의 안전 점수가 높은 곳으로 오전 → 점심 → 오후를 이었어요.
                대안 칩(⇄)을 누르면 스톱을 바꿀 수 있어요.
              </p>

              <div
                className={`mt-4 grid items-start gap-6 ${
                  theme ? "max-w-3xl" : "lg:grid-cols-2 2xl:grid-cols-3"
                }`}
              >
                {themesToShow.map((t) => {
                  const course = courses[t];
                  const meta = COURSE_THEME_META[t];
                  if (!course) {
                    return (
                      <article
                        key={t}
                        className="rounded-2xl bg-slate-50 px-6 py-8 text-center ring-1 ring-slate-200"
                      >
                        <p className="text-3xl" aria-hidden="true">
                          {meta.emoji}
                        </p>
                        <h3 className="mt-2 font-bold text-slate-700">
                          {meta.label}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          이 지역엔 해당 테마 코스를 만들 수 없어요 — 조건(테마
                          매칭 장소·안전점수 60점 이상·이동 반경)을 채우는
                          조합이 없어요.
                        </p>
                      </article>
                    );
                  }
                  return (
                    <CourseCard
                      key={t}
                      course={toThemedCourseDto(course)}
                      profile={profile}
                    />
                  );
                })}
              </div>

              <p className="mt-8 text-xs leading-relaxed text-slate-400">
                코스는 오늘의 안전 점수를 기준으로 자동 생성된 참고 정보이며
                안전을 보장하지 않습니다. 방문 전 기상특보와 현지 안내를
                확인하세요.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
