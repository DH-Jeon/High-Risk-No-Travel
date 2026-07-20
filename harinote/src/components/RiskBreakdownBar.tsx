import type { RiskFactor, RiskLevel } from "@/lib/safety/types";

const LEVEL_STYLE: Record<RiskLevel, { bar: string; badge: string }> = {
  low: { bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  moderate: { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  high: { bar: "bg-red-500", badge: "bg-red-50 text-red-700" },
};

/** 위험 요인별 감점 막대 — "왜 이 점수인가"를 설명하는 핵심 컴포넌트 */
export default function RiskBreakdownBar({
  factors,
  compact = false,
}: {
  factors: RiskFactor[];
  /** 지역 팝업 등 좁은 곳: 카드·설명 없이 한 화면에 다 보이는 조밀 행 */
  compact?: boolean;
}) {
  if (factors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        표시할 세부 주의 요인 데이터가 아직 없습니다.
      </div>
    );
  }

  if (compact) {
    return (
      <ul className="space-y-1.5">
        {factors.map((f) => {
          const s = LEVEL_STYLE[f.level];
          const ratio = f.maxPoints > 0 ? Math.min(f.points / f.maxPoints, 1) : 0;
          const widthPct = f.points > 0 ? Math.max(ratio * 100, 5) : 0;
          return (
            <li key={f.key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2">
              <span className="flex items-center gap-1 truncate text-xs font-semibold text-slate-700">
                {f.label}
                <span className="tabular-nums text-[10px] font-normal text-slate-400">
                  {f.value}
                  {f.unit}
                </span>
              </span>
              <span
                className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${f.label} 감점 ${f.points}점`}
              >
                <span
                  className={`block h-full rounded-full ${s.bar}`}
                  style={{ width: `${widthPct}%` }}
                />
              </span>
              <span className="w-8 text-right text-xs font-bold tabular-nums text-slate-600">
                {f.points > 0 ? `−${f.points}` : "0"}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-4">
      {factors.map((f) => {
        const s = LEVEL_STYLE[f.level];
        const ratio =
          f.maxPoints > 0 ? Math.min(f.points / f.maxPoints, 1) : 0;
        const widthPct = f.points > 0 ? Math.max(ratio * 100, 5) : 0;

        return (
          <li key={f.key} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                {f.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.badge}`}
                >
                  {f.value}
                  {f.unit}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-600">
                −{f.points}
                <span className="text-xs font-normal text-slate-400">
                  {" "}
                  / 최대 −{f.maxPoints}점
                </span>
              </span>
            </div>

            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`${f.label} 감점 ${f.points}점, 상한 ${f.maxPoints}점`}
            >
              <div
                className={`h-full rounded-full ${s.bar} transition-[width]`}
                style={{ width: `${widthPct}%` }}
              />
            </div>

            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {f.description}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
