import Link from "next/link";
import type { Profile } from "@/lib/safety/types";
import { PROFILE_LABEL } from "@/lib/safety/types";
import { buildQuery, profileParam } from "@/components/search-params";

const PROFILE_ICON: Record<Profile, string> = {
  default: "👤",
  with_kids: "🧒",
  with_seniors: "👵",
  own_car: "🚗",
};

interface Props {
  /** 프로필 쿼리를 바꿔 이동할 기준 경로 (예: /places/126273) */
  basePath: string;
  current: Profile;
  /** profile 외에 유지할 쿼리 파라미터 */
  extraParams?: Record<string, string | number | undefined>;
}

/** 링크 기반 동행 프로필 전환 칩 — 프로필별로 점수가 달라짐을 보여준다 */
export default function ProfileChips({
  basePath,
  current,
  extraParams = {},
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PROFILE_LABEL) as Profile[]).map((p) => {
        const active = p === current;
        const href = `${basePath}${buildQuery({ ...extraParams, profile: profileParam(p) })}`;
        return (
          <Link
            key={p}
            href={href}
            aria-current={active ? "true" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            <span aria-hidden="true">{PROFILE_ICON[p]}</span>
            {PROFILE_LABEL[p]}
          </Link>
        );
      })}
    </div>
  );
}
