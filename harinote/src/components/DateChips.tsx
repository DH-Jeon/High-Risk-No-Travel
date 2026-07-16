import Link from "next/link";
import { buildQuery } from "@/components/search-params";
import { addDaysISO, formatKoreanDate, todayISOSeoul } from "@/lib/date";
import LinkLabel from "@/components/LinkLabel";
import DateRangePicker from "@/components/DateRangePicker";

interface Props {
  /** 날짜 쿼리를 바꿔 이동할 기준 경로 (예: /places/126273) */
  basePath: string;
  /** 현재 선택 시작 날짜 (YYYY-MM-DD, 없으면 오늘) */
  current?: string;
  /** 현재 선택 종료 날짜 — 있으면 기간 모드 */
  end?: string;
  /** date/end 외에 유지할 쿼리 파라미터 (profile 등) */
  extraParams?: Record<string, string | number | undefined>;
}

/**
 * 여행 날짜·기간 선택 — [오늘] 리셋 + 에어비앤비식 범위 달력.
 * 단일 날짜: D+1~3 단기예보, 이후 30년 기후 계절 모드.
 * 기간: 일자별 점수 중 가장 주의가 필요한 날(최악일)이 대표 점수.
 */
export default function DateChips({
  basePath,
  current,
  end,
  extraParams = {},
}: Props) {
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

      <DateRangePicker
        basePath={basePath}
        current={{ start: current, end }}
        extraParams={extraParams}
        todayISO={todayISOSeoul()}
        maxISO={addDaysISO(todayISOSeoul(), 366)}
      />

      {current && (
        <span className="text-xs font-semibold text-sky-700">
          {formatKoreanDate(current)}
          {end && ` ~ ${formatKoreanDate(end)}`} 기준
        </span>
      )}
    </div>
  );
}
