/**
 * 에어비앤비식 범위 선택 상태 머신 — 순수함수 (DateRangePicker가 사용).
 * DayPicker 내장 range 선택 대신 직접 제어한다: 14일 상한과
 * "완성 후 재클릭 → 새 시작일" 리셋 동작을 정확히 강제하기 위해.
 */
import { MAX_RANGE_DAYS } from "@/components/search-params";
import { nightsBetween } from "@/lib/date";

export interface RangeSelection {
  from?: string;
  to?: string;
}

/**
 * 날짜 클릭 → 다음 선택 상태.
 * - 아무것도 없으면: 클릭일을 from으로
 * - from만 있고 클릭 ≤ from: from 재설정
 * - from만 있고 클릭 > from: MAX_RANGE_DAYS 초과면 from 재설정, 이내면 to 확정
 * - from+to 완성 상태에서 클릭: 새 from으로 리셋
 */
export function nextRangeSelection(
  sel: RangeSelection,
  clickedISO: string,
): RangeSelection {
  if (!sel.from || sel.to) return { from: clickedISO };
  if (clickedISO <= sel.from) return { from: clickedISO };
  if (nightsBetween(sel.from, clickedISO) + 1 > MAX_RANGE_DAYS) {
    return { from: clickedISO };
  }
  return { from: sel.from, to: clickedISO };
}

/** 선택된 범위의 숙박 일수 — 미완성 선택은 0 */
export function rangeNights(sel: RangeSelection): number {
  return sel.from && sel.to ? nightsBetween(sel.from, sel.to) : 0;
}
