import { addDaysISO } from "@/lib/date";

/**
 * 날짜 스테퍼 표시 상태 — selected는 [todayISO, maxISO]로 클램프.
 * prev/next가 undefined면 해당 방향 버튼 비활성 (오늘 이전·D+3 이후 이동 불가).
 */
export function stepperView(
  current: string | undefined,
  todayISO: string,
  maxISO: string,
): { selected: string; prev?: string; next?: string } {
  const raw = current ?? todayISO;
  const selected = raw < todayISO ? todayISO : raw > maxISO ? maxISO : raw;
  return {
    selected,
    prev: selected > todayISO ? addDaysISO(selected, -1) : undefined,
    next: selected < maxISO ? addDaysISO(selected, 1) : undefined,
  };
}
