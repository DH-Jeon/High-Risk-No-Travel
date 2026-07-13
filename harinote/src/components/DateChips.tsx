import Link from "next/link";
import { buildQuery } from "@/components/search-params";
import { todayISOSeoul } from "@/lib/date";
import LinkLabel from "@/components/LinkLabel";

const OFFSET_LABEL = ["오늘", "내일", "모레", "글피"];

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
 * 링크 기반 여행 날짜 선택 — 오늘~글피 칩 + 달력(GET 폼).
 * D+1~3은 단기예보, 그 이후는 30년 기후 계절 모드로 계산된다.
 */
export default function DateChips({ basePath, current, extraParams = {} }: Props) {
  const chips = [0, 1, 2, 3].map((off) => ({
    label: OFFSET_LABEL[off],
    iso: off === 0 ? undefined : isoAfter(off),
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const active = c.iso === current;
        return (
          <Link
            key={c.label}
            href={`${basePath}${buildQuery({ ...extraParams, date: c.iso })}`}
            aria-current={active ? "true" : undefined}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-sky-50 hover:text-sky-700"
            }`}
          >
            <LinkLabel>{c.label}</LinkLabel>
          </Link>
        );
      })}

      {/* 더 먼 날짜: 달력 선택 (GET 폼 — date 쿼리로 이동) */}
      <form action={basePath} method="get" className="inline-flex items-center gap-1.5">
        {Object.entries(extraParams).map(([k, v]) =>
          v !== undefined && v !== "" ? (
            <input key={k} type="hidden" name={k} value={String(v)} />
          ) : null,
        )}
        <input
          type="date"
          name="date"
          defaultValue={current ?? ""}
          min={isoAfter(1)}
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
      </form>
    </div>
  );
}
