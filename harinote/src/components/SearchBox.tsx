import type { Profile } from "@/lib/safety/types";
import { PROFILE_LABEL } from "@/lib/safety/types";

interface Props {
  defaultQuery?: string;
  /** true면 동행 프로필 라디오 칩을 폼 안에 포함 (홈 히어로용) */
  withProfile?: boolean;
  /** withProfile=false일 때 현재 프로필을 hidden으로 유지 */
  profile?: Profile;
  compact?: boolean;
}

/** GET 폼 검색창 — JS 없이 /places?q=&profile= 로 이동 */
export default function SearchBox({
  defaultQuery = "",
  withProfile = false,
  profile = "default",
  compact = false,
}: Props) {
  return (
    <form action="/places" method="get" className="w-full">
      <div
        className={`flex items-center gap-2 rounded-2xl bg-white ring-1 ring-slate-200 transition-shadow focus-within:ring-2 focus-within:ring-teal-500 ${
          compact ? "p-1.5 shadow-sm" : "p-2 shadow-lg shadow-teal-900/5"
        }`}
      >
        <span className="pl-3 text-slate-400" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            className={compact ? "h-4 w-4" : "h-5 w-5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="관광지 이름이나 지역을 검색하세요 (예: 남이섬)"
          aria-label="관광지 검색"
          className={`min-w-0 flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none ${
            compact ? "py-1.5 text-sm" : "py-2.5 text-base sm:text-lg"
          }`}
        />
        {!withProfile && profile !== "default" && (
          <input type="hidden" name="profile" value={profile} />
        )}
        <button
          type="submit"
          className={`shrink-0 rounded-xl bg-teal-600 font-bold text-white transition-colors hover:bg-teal-700 ${
            compact ? "px-4 py-1.5 text-sm" : "px-5 py-2.5 text-base"
          }`}
        >
          검색
        </button>
      </div>

      {withProfile && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-slate-600">
            누구와 함께 가시나요?
          </legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PROFILE_LABEL) as Profile[]).map((p) => (
              <label key={p} className="cursor-pointer">
                <input
                  type="radio"
                  name="profile"
                  value={p}
                  defaultChecked={p === "default"}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors peer-checked:bg-teal-600 peer-checked:text-white peer-checked:ring-teal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 hover:bg-teal-50">
                  {PROFILE_LABEL[p]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </form>
  );
}
