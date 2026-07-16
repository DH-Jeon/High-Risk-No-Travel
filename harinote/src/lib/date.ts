/** KST(Asia/Seoul) 날짜 유틸 — 서버 타임존에 의존하지 않는다 */

const KST_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 오늘 날짜 YYYY-MM-DD (KST) */
export function todayISOSeoul(now: Date = new Date()): string {
  return KST_FMT.format(now);
}

/** YYYY-MM-DD가 실제 존재하는 날짜인지 (2026-02-31 같은 값 거부) */
export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** dateISO가 KST 오늘로부터 며칠 뒤인지 (오늘=0, 어제=-1) */
export function dayOffsetSeoul(dateISO: string, now: Date = new Date()): number {
  const ms =
    Date.parse(`${dateISO}T00:00:00Z`) -
    Date.parse(`${todayISOSeoul(now)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** YYYY-MM-DD → 기상청 base/fcst 날짜 형식 YYYYMMDD */
export function toKmaDate(dateISO: string): string {
  return dateISO.replaceAll("-", "");
}

/** YYYY-MM-DD → 월 (1~12) */
export function monthOfISO(dateISO: string): number {
  return Number(dateISO.slice(5, 7));
}

/** dateISO + n일 → YYYY-MM-DD (n은 음수 가능). ISO 문자열은 UTC ms 산술이라 타임존 무관 */
export function addDaysISO(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** 시작~종료 날짜 목록 (양끝 포함). end < start면 [start]로 방어 */
export function eachDayISO(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  for (let d = startISO; d <= endISO; d = addDaysISO(d, 1)) days.push(d);
  return days.length > 0 ? days : [startISO];
}

/** 숙박 일수 — 7/20~7/23이면 3(박). 같은 날이나 역순이면 0 */
export function nightsBetween(startISO: string, endISO: string): number {
  const ms =
    Date.parse(`${endISO}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** 화면 표기용 "M월 D일 (요일)" */
export function formatKoreanDate(dateISO: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateISO}T12:00:00+09:00`));
}
