import Link from "next/link";
import { buildQuery } from "@/components/search-params";
import { formatKoreanDate, todayISOSeoul } from "@/lib/date";
import LinkLabel from "@/components/LinkLabel";

interface Props {
  /** 날짜 쿼리를 바꿔 이동할 기준 경로 (예: /places/126273) */
  basePath: string;
  /** 현재 선택 날짜 (YYYY-MM-DD, 없으면 오늘) */
  current?: string;
  /** date 외에 유지할 쿼리 파라미터 (profile 등) */
  extraParams?: Record<string, string | number | undefined>;
}

/** 오늘(KST) 기준 +days일의 YYYY-MM-DD */
function isoAfter(days: number): string {
  return new Date(Date.parse(`${todayISOSeoul()}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * 여행 날짜 선택 — [오늘] 리셋 + 달력(GET 폼).
 * D+1~3은 단기예보, 그 이후는 30년 기후 계절 모드로 계산된다.
 */
export default function DateChips({ basePath, current, extraParams = {} }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`${basePath}${buildQuery({ ...extraParams })}`}
        aria-current={current === undefined ? "true" : undefined}
        className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
          current === undefined
            ? "bg-sky-600 text-white shadow-sm"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-sky-50 hover:text-sky-700"
        }`}
      >
        <LinkLabel>오늘</LinkLabel>
      </Link>

      {/* 여행 날짜 선택 (GET 폼 — date 쿼리로 이동) */}
      <form action={basePath} method="get" className="inline-flex items-center gap-1.5">
        {Object.entries(extraParams).map(([k, v]) =>
          v !== undefined && v !== "" ? (
            <input key={k} type="hidden" name={k} value={String(v)} />
          ) : null,
        )}
        <input
          type="date"
          name="date"
          defaultValue={current ?? todayISOSeoul()}
          min={todayISOSeoul()}
          max={isoAfter(366)}
          aria-label="여행 날짜 선택"
          className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
        />
        <button
          type="submit"
          className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-sky-50 hover:text-sky-700"
        >
          보기
        </button>
        {current && (
          <span className="text-xs font-semibold text-sky-700">
            {formatKoreanDate(current)} 기준
          </span>
        )}
      </form>
    </div>
  );
}
