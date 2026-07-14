import Link from "next/link";
import type { Profile } from "@/lib/safety/types";
import { PROFILE_LABEL } from "@/lib/safety/types";
import { buildQuery } from "@/components/search-params";
import LinkLabel from "@/components/LinkLabel";

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
  /** 숨길 프로필 (예: 홈 온보딩은 데이터 미연동인 자차 제외) */
  exclude?: Profile[];
}

/** 링크 기반 동행 프로필 전환 칩 — 프로필별로 점수가 달라짐을 보여준다 */
export default function ProfileChips({
  basePath,
  current,
  extraParams = {},
  exclude = [],
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(PROFILE_LABEL) as Profile[])
        .filter((p) => !exclude.includes(p))
        .map((p) => {
        const active = p === current;
        // 항상 명시적 profile 파라미터 — "기본" 선택이 쿠키 기억값에 덮이지 않도록
        const href = `${basePath}${buildQuery({ ...extraParams, profile: p })}`;
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
            <LinkLabel>
              <span aria-hidden="true">{PROFILE_ICON[p]}</span>
              {PROFILE_LABEL[p]}
            </LinkLabel>
          </Link>
        );
      })}
    </div>
  );
}
