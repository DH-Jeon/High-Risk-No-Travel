/**
 * AI 3줄 요약 배치 — 관광지 소개문(detailCommon2 원문) → Groq(llama-3.1-8b-instant)
 * → src/data/summaries.json {contentId: [줄1, 줄2, 줄3]}
 *
 * 실행: npx tsx --env-file=.env.local scripts/seed-summaries.ts
 * - GROQ_API_KEY(환경변수) + TOUR_API_KEY 필요
 * - 환각 방지: "원문에 없는 정보 금지" 프롬프트 + 화면에 "AI 요약" 표기
 * - 429(rate limit)는 대기 후 재시도, 재실행 시 완료분 건너뜀 (이어받기)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fetchPlaceOverview } from "../src/lib/tour/overview";

const PLACES_PATH = "src/data/gangwon.json";
const OVERVIEWS_PATH = "src/data/overviews.json";
const OUT_PATH = "src/data/summaries.json";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

const PROMPT = `다음 강원도 관광지 소개문을 정확히 3줄로 요약해줘.
규칙:
- 원문에 없는 정보를 추가하지 말 것 (과장·추측 금지)
- 각 줄은 30자 이내의 간결한 한국어 문장
- JSON 문자열 배열만 출력: ["...","...","..."]`;

async function summarize(key: string, title: string, overview: string): Promise<string[] | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: `[${title}]\n${overview.slice(0, 1500)}` },
        ],
      }),
    });
    if (res.status === 429) {
      const wait = 15_000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    try {
      const arr = JSON.parse(m[0]) as unknown;
      if (Array.isArray(arr) && arr.length === 3 && arr.every((x) => typeof x === "string")) {
        return (arr as string[]).map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      return null;
    }
    return null;
  }
  return null;
}

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY 환경변수가 없습니다.");

  const places: { contentId: number; title: string }[] = JSON.parse(
    readFileSync(PLACES_PATH, "utf8"),
  );
  // 소개문 보유 관광지만 대상 (overviews.json 키 = 990곳)
  const hasOverview = new Set(Object.keys(JSON.parse(readFileSync(OVERVIEWS_PATH, "utf8"))));
  const out: Record<string, string[]> = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, "utf8"))
    : {};

  const targets = places.filter(
    (p) => hasOverview.has(String(p.contentId)) && !out[String(p.contentId)],
  );
  console.log(`대상: ${targets.length}곳 (완료분 제외)`);

  let done = 0;
  for (const p of targets) {
    const overview = await fetchPlaceOverview(p.contentId);
    if (overview) {
      const lines = await summarize(groqKey, p.title, overview);
      if (lines) out[String(p.contentId)] = lines;
    }
    done++;
    if (done % 50 === 0) {
      writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
      console.log(`진행 ${done}/${targets.length} — 요약 ${Object.keys(out).length}건`);
    }
    await new Promise((r) => setTimeout(r, 2100)); // ~28 RPM (무료 티어 30 RPM 여유)
  }

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
  console.log(`완료: ${Object.keys(out).length}곳 요약 → ${OUT_PATH}`);
}

main();
