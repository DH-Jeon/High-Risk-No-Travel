/**
 * 체감온도(여름철) 순수 계산 — 폭염 감점의 평가 기준값.
 * 기상청 폭염특보 기준이 "일 최고 체감온도"(주의보 33℃/경보 35℃)이므로
 * 건구기온 대신 이 값으로 폭염을 평가한다 (score.ts 참조).
 *
 * 적용 기간: 기상청 여름철 산식의 공식 적용 기간은 5~9월 — 호출부(kma.ts)가
 * 예보 날짜의 월로 게이트한다. 겨울철 풍속냉각(wind chill) 산식은 범위 외.
 *
 * 의도된 동작: 건조한 날(예: 영동 높새바람 고온건조)은 체감온도가 건구기온보다
 * 낮게 평가되어 폭염 감점이 줄어든다 — 폭염특보 자체가 체감온도 기준이라
 * 건조하면 특보도 늦게 발령되는 것과 일치한다.
 */

/** 상대습도(%)는 0~100으로 clamp 후 계산 */
function clampRh(rhPct: number): number {
  return Math.min(100, Math.max(0, rhPct));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * 습구온도 근사(반올림 전) — rh는 이미 clamp된 값.
 * 출처: Stull, R., 2011: Wet-Bulb Temperature from Relative Humidity and
 * Air Temperature. J. Appl. Meteor. Climatol., 50, 2267–2269. (atan은 라디안)
 */
function wetBulbRawC(taC: number, rh: number): number {
  return (
    taC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(taC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/** 습구온도 근사 ℃ (Stull 2011) — 소수 1자리 반올림 */
export function wetBulbC(taC: number, rhPct: number): number {
  return round1(wetBulbRawC(taC, clampRh(rhPct)));
}

/**
 * 기상청 여름철(5~9월) 체감온도 ℃ — 습구온도 기반, 2022.5. 개정 산식.
 * 출처: 기상청 기상자료개방포털 체감온도 산출식(여름철).
 * 체감 = −0.2442 + 0.55399·Tw + 0.45535·Ta − 0.0022·Tw² + 0.00278·Tw·Ta + 3.0
 */
export function apparentTempSummerC(taC: number, rhPct: number): number {
  const tw = wetBulbRawC(taC, clampRh(rhPct));
  return round1(
    -0.2442 +
      0.55399 * tw +
      0.45535 * taC -
      0.0022 * tw * tw +
      0.00278 * tw * taC +
      3.0,
  );
}
