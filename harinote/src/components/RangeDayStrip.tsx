/**
 * 기간 일자별 점수 스트립 (서버 컴포넌트) — 상세 페이지 기간 모드 전용.
 * 셀마다 날짜·대표점수·모드(예보/기후)를 보여주고, 가장 주의가 필요한 날을 강조한다.
 * 셀을 누르면 그날 단일 날짜로 드릴다운 (?date=그날, end 제거).
 */
import Link from "next/link";
import type { RangeSafety } from "@/lib/datasource";
import type { RiskLevel } from "@/lib/safety/types";
import { buildQuery } from "@/components/search-params";

/** 등급색 — SafetyScoreBadge와 같은 emerald/amber/red 팔레트 */
const GRADE_CELL: Record<RiskLevel, { text: string; bg: string }> = {
  low: { text: "text-emerald-700", bg: "bg-emerald-50" },
  moderate: { text: "text-amber-700", bg: "bg-amber-50" },
  high: { text: "text-red-700", bg: "bg-red-50" },
};

const MODE_LABEL = { forecast: "예보", seasonal: "기후" } as const;

/** 셀 표기용 "7/20 (월)" */
function shortDay(iso: string): string {
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${iso}T12:00:00+09:00`));
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))} (${weekday})`;
}

interface Props {
  range: RangeSafety;
  /** 드릴다운 링크의 기준 경로 (예: /places/126273) */
  basePath: string;
  /** date 외에 유지할 쿼리 파라미터 (profile 등) */
  extraParams?: Record<string, string | number | undefined>;
}

export default function RangeDayStrip({
  range,
  basePath,
  extraParams = {},
}: Props) {
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex w-max gap-2" aria-label="기간 일자별 안전 점수">
        {range.days.map((day) => {
          const isWorst = day.dateISO === range.worst.dateISO;
          const c = GRADE_CELL[day.breakdown.grade];
          return (
            <li key={day.dateISO}>
              <Link
                href={`${basePath}${buildQuery({ ...extraParams, date: day.dateISO })}`}
                className={`flex w-[76px] flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 transition-shadow hover:shadow-md ${c.bg} ${
                  isWorst
                    ? "ring-2 ring-red-400"
                    : "ring-1 ring-slate-200"
                }`}
              >
                <span className="text-[11px] font-semibold text-slate-500">
                  {shortDay(day.dateISO)}
                </span>
                <span
                  className={`text-lg font-extrabold tabular-nums ${c.text}`}
                >
                  {day.breakdown.score}
                </span>
                <span className="rounded-full bg-white/80 px-1.5 py-px text-[10px] font-semibold text-slate-400">
                  {MODE_LABEL[day.mode]}
                </span>
                {isWorst && (
                  <span className="text-[10px] font-bold text-red-600">
                    가장 주의
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
