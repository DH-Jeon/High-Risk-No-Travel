/**
 * 기상청 단기예보(VilageFcstInfoService_2.0/getVilageFcst) 클라이언트.
 *
 * 계약: fetchKmaDailyWeather(nx, ny) — 오늘(KST) 기준 최고기온·최대 강수확률·
 * 최대 풍속·강수량 합계를 반환. 격자당 1시간 캐시(시군 대표점 18곳 = 시간당 최대 18회).
 * 서버 전용 — KMA_API_KEY는 클라이언트 번들에 노출 금지.
 */
import { z } from "zod";
import { createTtlCache } from "./cache";

const BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

/**
 * 당일 조회에 쓰는 발표 시각(KST). 각 발표는 API 반영까지 ~10분 소요.
 * 23시 발표는 다음날 예보부터 시작하므로 당일 조회에는 쓰지 않는다
 * ("오늘의 점수"에 내일 예보가 섞이는 문제) — 자정~02:10 구간 전용.
 */
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20];
/** 발표 후 API 반영 대기 여유 (분) */
const PUBLISH_DELAY_MIN = 10;

export interface KmaDailyWeather {
  /** 오늘 최고 체감온도 ℃ (습도 있으면 폭염특보 산정식, 없으면 최고기온 TMX) */
  tempC?: number;
  /** 오늘 강수확률 최댓값 % (POP) */
  rainProbPct?: number;
  /** 오늘 풍속 최댓값 m/s (WSD) */
  windMs?: number;
  /** 오늘 시간당 강수량(PCP) 합계 mm — 전부 "강수없음"이면 undefined */
  rainMm?: number;
}

/** KST 날짜(YYYYMMDD)와 자정 기준 경과 분 — 서버 타임존에 의존하지 않는다 */
function kstParts(d: Date): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    date: `${parts.year}${parts.month}${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * 가장 최근의 "발표시각 + 10분"이 지난 base_date/base_time 선택 (Asia/Seoul 기준).
 * 자정~02:10 사이에는 전날 23시 발표를 쓴다 (23시 발표는 오늘 0시부터의 예보라 라벨과 일치).
 * 23:10~23:59에는 20시 발표를 유지한다 — 23시 발표를 쓰면 "오늘" 요약이 내일 예보가 된다.
 */
export function pickBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const { date, minutes } = kstParts(now);
  let picked: number | undefined;
  for (const h of BASE_HOURS) {
    if (minutes >= h * 60 + PUBLISH_DELAY_MIN) picked = h;
  }
  if (picked !== undefined) {
    return { baseDate: date, baseTime: `${String(picked).padStart(2, "0")}00` };
  }
  // 자정~02:10 — 전날 23시 발표 (KST는 DST가 없어 -24h가 정확히 전날이다)
  const prev = kstParts(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return { baseDate: prev.date, baseTime: "2300" };
}

/**
 * 여름철 체감온도(℃) — 기상청 폭염특보 산정식 (기온 Ta, 상대습도 RH%).
 * 습구온도 Tw는 Stull(2011) 근사식으로 구한다.
 * 기온 25℃ 미만에서는 체감온도 개념이 무의미하므로 기온을 그대로 반환.
 * 근거: 기상청 폭염특보 발표 기준은 '일 최고 체감온도'이며 이 식으로 산정한다.
 */
export function feelsLikeSummerC(ta: number, rh: number): number {
  if (ta < 25 || !Number.isFinite(rh)) return ta;
  const r = Math.max(0, Math.min(100, rh));
  // Stull 습구온도 근사 (℃)
  const tw =
    ta * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) +
    Math.atan(ta + r) -
    Math.atan(r - 1.67633) +
    0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) -
    4.686035;
  const feels =
    -0.2442 +
    0.55399 * tw +
    0.45535 * ta -
    0.0022 * tw * tw +
    0.00278 * tw * ta +
    3.0;
  // 체감이 기온보다 낮게 나오는 이상치는 기온으로 하한 (건조 시)
  return Math.round(Math.max(feels, ta) * 10) / 10;
}

/**
 * PCP(1시간 강수량) 문자열 파싱.
 * "강수없음"→undefined, "1mm 미만"→0.5, "30.0~50.0mm"→40(중간값), "50.0mm 이상"→50, "1.0mm"→1
 */
export function parsePcp(value: string | undefined | null): number | undefined {
  if (value == null) return undefined;
  const v = value.trim();
  if (v === "" || v === "-" || v === "강수없음") return undefined;
  if (v.includes("미만")) return 0.5;
  // "30.0~50.0mm" — 범위는 중간값을 취한다. 상한을 쓰면 하루 합산 시
  // 시간대마다 +10mm씩 과대 누적돼 감점이 체계적으로 부풀려진다
  const range = /([\d.]+)\s*~\s*([\d.]+)/.exec(v);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const num = /([\d.]+)/.exec(v);
  if (!num) return undefined;
  const parsed = Number(num[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const kmaItemSchema = z.object({
  category: z.string(),
  fcstDate: z.string(),
  fcstTime: z.string(),
  fcstValue: z.string(),
});
type KmaItem = z.infer<typeof kmaItemSchema>;

const kmaResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string(),
      resultMsg: z.string().optional(),
    }),
    body: z
      .object({
        items: z.object({ item: z.array(kmaItemSchema) }).optional(),
      })
      .optional(),
  }),
});

function requireApiKey(): string {
  const key = process.env.KMA_API_KEY;
  if (!key) {
    throw new Error(
      "KMA_API_KEY가 설정되지 않았습니다. .env.local에 data.go.kr '일반 인증키(Decoding)' 값을 넣어주세요.",
    );
  }
  return key;
}

/**
 * 예보 item 목록 → 하루 요약.
 * fallbackToEarliest(오늘 조회 전용): targetDate의 item이 없으면 가장 이른
 * 예보일로 대체한다. 미래 날짜 조회에서는 끄고 빈 요약을 돌려받아
 * "그 날짜 예보 없음 → 계절모드 폴백" 신호로 쓴다.
 */
export function summarizeDaily(
  items: KmaItem[],
  targetDate: string,
  fallbackToEarliest = true,
): KmaDailyWeather {
  let dayItems = items.filter((i) => i.fcstDate === targetDate);
  if (dayItems.length === 0 && items.length > 0 && fallbackToEarliest) {
    const earliest = items.reduce(
      (min, i) => (i.fcstDate < min ? i.fcstDate : min),
      items[0].fcstDate,
    );
    dayItems = items.filter((i) => i.fcstDate === earliest);
  }

  let tmx: number | undefined;
  let tmpMax: number | undefined;
  let popMax: number | undefined;
  let wsdMax: number | undefined;
  let pcpSum: number | undefined;
  // 시간대별 (기온, 습도) — 최고 체감온도를 뽑기 위해 페어로 모은다
  const tempRhByTime = new Map<string, { ta?: number; rh?: number }>();

  for (const item of dayItems) {
    const n = Number(item.fcstValue);
    switch (item.category) {
      case "TMX":
        if (Number.isFinite(n)) tmx = n;
        break;
      case "TMP": {
        if (Number.isFinite(n)) {
          tmpMax = tmpMax === undefined ? n : Math.max(tmpMax, n);
          const e = tempRhByTime.get(item.fcstTime) ?? {};
          e.ta = n;
          tempRhByTime.set(item.fcstTime, e);
        }
        break;
      }
      case "REH": {
        if (Number.isFinite(n)) {
          const e = tempRhByTime.get(item.fcstTime) ?? {};
          e.rh = n;
          tempRhByTime.set(item.fcstTime, e);
        }
        break;
      }
      case "POP":
        if (Number.isFinite(n)) popMax = popMax === undefined ? n : Math.max(popMax, n);
        break;
      case "WSD":
        if (Number.isFinite(n)) wsdMax = wsdMax === undefined ? n : Math.max(wsdMax, n);
        break;
      case "PCP": {
        // 하루 누적 강수량(합계) — 호우 특보 임계값이 누적 기준이라 최댓값보다 합계가 적합
        const mm = parsePcp(item.fcstValue);
        if (mm !== undefined) pcpSum = (pcpSum ?? 0) + mm;
        break;
      }
    }
  }

  // 일 최고 체감온도 — 기온·습도가 함께 있는 시간대만 체감 계산 (폭염특보 기준).
  // 습도(REH) 미제공 시에는 계산하지 않고 최고기온(TMX)을 그대로 쓴다.
  let feelsMax: number | undefined;
  for (const { ta, rh } of tempRhByTime.values()) {
    if (ta === undefined || rh === undefined) continue;
    const f = feelsLikeSummerC(ta, rh);
    feelsMax = feelsMax === undefined ? f : Math.max(feelsMax, f);
  }

  const weather: KmaDailyWeather = {};
  // 폭염 판정용 기온 = 체감온도(습도 있을 때) 또는 최고기온
  const tempC =
    feelsMax !== undefined
      ? Math.max(feelsMax, tmx ?? feelsMax) // 체감·실측 최고기온 중 높은 쪽
      : (tmx ?? tmpMax);
  if (tempC !== undefined) weather.tempC = tempC;
  if (popMax !== undefined) weather.rainProbPct = popMax;
  if (wsdMax !== undefined) weather.windMs = wsdMax;
  if (pcpSum !== undefined) weather.rainMm = Math.round(pcpSum * 10) / 10;
  return weather;
}

/**
 * 원시 호출 — 캐시 없이 1회 fetch + 파싱. 스모크 스크립트에서도 사용.
 * targetDate(YYYYMMDD)를 주면 그 날짜(D+1~3)의 예보 요약 — 응답에 해당
 * 날짜가 없으면 빈 요약을 반환한다 (미래 조회는 earliest 폴백 없음).
 */
export async function fetchKmaDailyWeatherRaw(
  nx: number,
  ny: number,
  now: Date = new Date(),
  targetDate?: string,
): Promise<KmaDailyWeather> {
  const key = requireApiKey();
  const { baseDate, baseTime } = pickBaseDateTime(now);
  const params = new URLSearchParams({
    serviceKey: key,
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
    numOfRows: "500", // 하루치(24h × 12카테고리 ≈ 288행)를 충분히 커버
    pageNo: "1",
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  const text = await res.text();

  // 키 오류 등은 dataType=JSON을 무시하고 XML(OpenAPI_ServiceResponse)로 온다
  if (text.trimStart().startsWith("<")) {
    const authMsg = /<returnAuthMsg>([^<]*)<\/returnAuthMsg>/.exec(text)?.[1];
    const reasonCode = /<returnReasonCode>([^<]*)<\/returnReasonCode>/.exec(text)?.[1];
    throw new Error(
      `기상청 API가 XML 오류를 반환했습니다: ${authMsg ?? "원인 불명"} (returnReasonCode=${reasonCode ?? "?"})`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `기상청 API 호출 실패: HTTP ${res.status} ${text.trim().slice(0, 100)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`기상청 API 응답이 JSON이 아닙니다: ${text.trim().slice(0, 100)}`);
  }

  const parsed = kmaResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `기상청 API 응답이 예상 스키마와 다릅니다: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const { resultCode, resultMsg } = parsed.data.response.header;
  // 주의: 기상청 정상 코드는 "00" (TourAPI의 "0000"과 다름)
  if (resultCode !== "00") {
    throw new Error(
      `기상청 API 오류 응답: resultCode=${resultCode}, resultMsg=${resultMsg ?? "메시지 없음"}`,
    );
  }

  const items = parsed.data.response.body?.items?.item ?? [];
  return summarizeDaily(
    items,
    targetDate ?? kstParts(now).date,
    targetDate === undefined,
  );
}

/** 격자·날짜별 1시간 캐시 (실패는 5분 후 재시도) */
const cache = createTtlCache<KmaDailyWeather>(60 * 60 * 1000, 5 * 60 * 1000);

/** 격자(nx, ny)의 날씨 요약 — targetDate(YYYYMMDD) 미지정 시 오늘. 1시간 메모리 캐시 */
export function fetchKmaDailyWeather(
  nx: number,
  ny: number,
  targetDate?: string,
): Promise<KmaDailyWeather> {
  const dateKey = targetDate ?? "today";
  return cache.get(`${nx},${ny},${dateKey}`, () =>
    fetchKmaDailyWeatherRaw(nx, ny, new Date(), targetDate),
  );
}
