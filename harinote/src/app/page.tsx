import Link from "next/link";
import SearchBox from "@/components/SearchBox";

const POPULAR = ["남이섬", "설악산", "경포해변", "정동진", "춘천", "속초"];

const STEPS = [
  {
    icon: "🔍",
    title: "1. 점수 확인",
    desc: "가고 싶은 강원 관광지를 검색하면 오늘 기준 안전 점수를 한눈에 보여드려요.",
  },
  {
    icon: "📊",
    title: "2. 위험 요인 보기",
    desc: "폭염·강수·미세먼지·응급의료 접근성 등 점수가 깎인 이유를 요인별로 설명해요.",
  },
  {
    icon: "🧭",
    title: "3. 대체지 추천",
    desc: "주의 요인이 높은 날엔 조건에 맞는 더 안전한 주변 관광지를 함께 안내할 예정이에요.",
  },
];

export default function Home() {
  return (
    <div>
      {/* 히어로 */}
      <section className="bg-gradient-to-b from-teal-50 via-sky-50 to-slate-50">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-14 sm:pb-20 sm:pt-20">
          <p className="mb-3 inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
            HARI-NOTE · High Risk, No Travel
          </p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            오늘, 이 강원 관광지
            <br className="sm:hidden" /> 가도 될까?
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
            <strong className="text-teal-700">하리노트</strong>는 기상·재난·의료
            공공데이터로 관광지별 방문 주의 요인을 점수로 알려주는{" "}
            <strong>가족 여행 안전 확인 서비스</strong>입니다.
          </p>

          <div className="mt-8">
            <SearchBox withProfile />
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-slate-600">
              인기 검색
            </p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((name) => (
                <Link
                  key={name}
                  href={`/places?q=${encodeURIComponent(name)}`}
                  className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-300"
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 서비스 3단계 */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h2 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
          하리노트는 이렇게 도와드려요
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"
            >
              <span className="text-3xl" aria-hidden="true">
                {s.icon}
              </span>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">
          안전 점수는 한국관광공사·기상청·AirKorea 등 공공데이터 기반 참고
          정보입니다.
        </p>
      </section>
    </div>
  );
}
