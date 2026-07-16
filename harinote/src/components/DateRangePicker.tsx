"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { ko } from "react-day-picker/locale";
import { addDaysISO } from "@/lib/date";
import { buildQuery, MAX_RANGE_DAYS } from "@/components/search-params";
import {
  nextRangeSelection,
  rangeNights,
  type RangeSelection,
} from "@/components/range-select";

interface Props {
  /** 날짜 쿼리를 바꿔 이동할 기준 경로 (예: /places/126273) */
  basePath: string;
  /** 현재 선택된 기간 (URL 확정값) — 없으면 오늘 모드 */
  current?: { start?: string; end?: string };
  /** date/end 외에 유지할 쿼리 파라미터 (profile 등) */
  extraParams?: Record<string, string | number | undefined>;
  /** 서버에서 계산해 내려받는 KST 오늘 — 클라이언트 재계산 금지 (하이드레이션 안전) */
  todayISO: string;
  /** 선택 가능한 마지막 날짜 (D+366) */
  maxISO: string;
}

/** YYYY-MM-DD → 로컬 Date (달력 표시용) */
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 로컬 Date → YYYY-MM-DD */
function dateToISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 트리거 표기용 "7월 20일" */
function shortLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
}

/**
 * 에어비앤비식 여행 기간 선택 — 트리거 칩 + 범위 달력 팝오버.
 * 시작·종료가 완성되는 즉시 ?date=&end= 로 이동한다.
 * 선택 로직은 range-select.ts 상태 머신 (14일 상한·재클릭 리셋).
 */
export default function DateRangePicker({
  basePath,
  current = {},
  extraParams = {},
  todayISO,
  maxISO,
}: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<RangeSelection>({
    from: current.start,
    to: current.end,
  });
  // 데스크톱(sm 이상) 2개월 표시 — 초기값 1로 하이드레이션 불일치 회피
  const [months, setMonths] = useState(1);

  // URL 확정값이 바뀌면(네비게이션) 임시 선택 상태를 동기화
  // — effect 대신 렌더 중 상태 보정 패턴 (react.dev: you might not need an effect)
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (
    prevCurrent.start !== current.start ||
    prevCurrent.end !== current.end
  ) {
    setPrevCurrent(current);
    setSel({ from: current.start, to: current.end });
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setMonths(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 외부 클릭·Escape로 닫기 — 닫을 때 미확정 선택은 URL 값으로 되돌린다
  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
      setSel({ from: current.start, to: current.end });
    }
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, current.start, current.end]);

  function navigate(dateParams: { date?: string; end?: string }) {
    setOpen(false);
    router.push(`${basePath}${buildQuery({ ...extraParams, ...dateParams })}`);
  }

  function handleDayClick(day: Date) {
    const next = nextRangeSelection(sel, dateToISO(day));
    setSel(next);
    if (next.from && next.to) {
      navigate({ date: next.from, end: next.to });
    }
  }

  const hasSelection = Boolean(current.start);
  const triggerLabel = current.start
    ? current.end
      ? `${shortLabel(current.start)} ~ ${shortLabel(current.end)} · ${rangeNights(
          { from: current.start, to: current.end },
        )}박`
      : shortLabel(current.start)
    : "🗓 날짜 선택";

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          // 칩을 다시 눌러 닫을 때도 미확정 선택을 URL 확정값으로 되돌린다
          // (외부 클릭·Escape의 close()와 동일 — 반선택 상태 잔존 방지)
          if (open) setSel({ from: current.start, to: current.end });
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
          hasSelection
            ? "bg-sky-600 text-white shadow-sm"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-sky-50 hover:text-sky-700"
        }`}
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="여행 기간 선택"
          className="absolute left-0 top-full z-50 mt-2 w-max max-w-[92vw] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200"
        >
          <DayPicker
            mode="range"
            locale={ko}
            numberOfMonths={months}
            defaultMonth={isoToDate(sel.from ?? addDaysISO(todayISO, 1))}
            startMonth={isoToDate(todayISO)}
            endMonth={isoToDate(maxISO)}
            // from만 선택된 상태는 to=from으로 넘겨 시작일 원 표시를 유지한다
            // (range_* 하이라이트는 from·to가 모두 있어야 그려진다)
            selected={
              sel.from
                ? {
                    from: isoToDate(sel.from),
                    to: isoToDate(sel.to ?? sel.from),
                  }
                : undefined
            }
            // onSelect가 없으면 DayPicker가 내장 addToRange 로직으로 내부 상태를
            // 그려 range-select.ts 상태 머신과 하이라이트가 어긋난다 — no-op이라도
            // 넘겨 controlled 모드로 전환하고, 선택 로직은 onDayClick이 전담한다
            onSelect={() => {}}
            onDayClick={handleDayClick}
            // 내일부터 D+366까지만 선택 가능 (parseDate 규칙과 동일)
            disabled={[
              { before: isoToDate(addDaysISO(todayISO, 1)) },
              { after: isoToDate(maxISO) },
            ]}
            classNames={{
              root: "relative",
              nav: "absolute inset-x-0 top-0 flex items-center justify-between",
              button_previous:
                "flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30",
              button_next:
                "flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30",
              chevron: "h-4 w-4 fill-current",
              months: "flex gap-8",
              month: "space-y-2",
              month_caption: "flex h-8 items-center justify-center",
              caption_label: "text-sm font-bold text-slate-900",
              month_grid: "border-collapse",
              weekday:
                "h-8 w-10 text-center text-[11px] font-medium text-slate-400",
              day: "p-0 text-center",
              day_button:
                "h-10 w-10 rounded-full text-sm font-medium transition-shadow hover:ring-2 hover:ring-inset hover:ring-slate-900",
              // 에어비앤비 룩: 양끝은 진한 원, 사이는 라운딩 없는 연회색 밴드
              range_start: "rounded-full bg-slate-900 text-white",
              range_end: "rounded-full bg-slate-900 text-white",
              range_middle: "rounded-none bg-slate-100 text-slate-800",
              today:
                "[&>button]:relative [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-slate-400 [&>button]:after:content-['']",
              disabled: "opacity-30 [&>button]:pointer-events-none",
              outside: "text-slate-300",
            }}
          />

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">
              {sel.from && !sel.to
                ? `종료일을 선택하세요 (최대 ${MAX_RANGE_DAYS}일)`
                : "시작일과 종료일을 차례로 선택하세요"}
            </p>
            <div className="flex items-center gap-2">
              {sel.from && !sel.to && (
                <button
                  type="button"
                  onClick={() => navigate({ date: sel.from })}
                  className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  이 날짜만 보기
                </button>
              )}
              {(sel.from || hasSelection) && (
                <button
                  type="button"
                  onClick={() => navigate({})}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                >
                  날짜 지우기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
