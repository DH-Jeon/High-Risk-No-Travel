# -*- coding: utf-8 -*-
# 16b_seasonal_scenarios.py — 계절 모드 v2: 분위수 시나리오 ("통상일 / 궂은날")
#
# v1(기대 감점)의 실패: 특보일 확률(~10%)이 감점을 희석해 장마철 계곡이 무위험으로 나옴.
# v2: 시군×월의 일별 30년 분포에서 두 시나리오를 뽑아 점수 엔진에 그대로 입력
#   - 통상일: 중앙값 (tmax/tmin/강수/바람 median)
#   - 궂은날: 나쁜 쪽 90분위 (여름: tmax p90 / 겨울: tmin p10 / 강수 p90 / 바람 p90)
#   → "그날 가도 될까"의 답 = 점수 '범위' (통상 88 · 궂은날 58)
# 장점: 극단 보존, 산식 무변경(입력만 두 벌), 해석 직관적, 분위수는 통계적으로 방어 가능
import json
from pathlib import Path

import numpy as np
import pandas as pd

from safety_engine import compute_safety_score

HERE = Path(__file__).parent
RAW = HERE / "data" / "climate_daily_raw"
LAPSE = 0.0065

SEATS = {1: "강릉시", 2: "고성군", 3: "동해시", 4: "삼척시", 5: "속초시", 6: "양구군",
         7: "양양군", 8: "영월군", 9: "원주시", 10: "인제군", 11: "정선군", 12: "철원군",
         13: "춘천시", 14: "태백시", 15: "평창군", 16: "홍천군", 17: "화천군", 18: "횡성군"}
# 산불 달력 (산림청 산불조심기간): 봄 3단계, 가을 2단계
FIRE_BY_MONTH = {1: 1, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 2, 12: 2}

rows = []
for code, name in SEATS.items():
    f = RAW / f"{name}.json"
    if not f.exists():
        continue
    data = json.loads(f.read_text(encoding="utf-8"))
    d = pd.DataFrame(data["daily"])
    d["month"] = pd.to_datetime(d.time).dt.month
    for m, g in d.groupby("month"):
        wet = g.precipitation_sum >= 1.0
        rows.append({
            "sigunguCode": code, "sigungu": name, "month": m,
            "seat_elev": data.get("elevation"),
            # 통상일 (중앙값)
            "tmax_med": g.temperature_2m_max.median(),
            "tmin_med": g.temperature_2m_min.median(),
            "wind_med": g.windspeed_10m_max.median(),
            "wetday_pct": round(wet.mean() * 100),
            # 궂은날 (나쁜 쪽 90분위)
            "tmax_p90": g.temperature_2m_max.quantile(0.9),
            "tmin_p10": g.temperature_2m_min.quantile(0.1),
            "precip_p90": g.precipitation_sum.quantile(0.9),
            "wind_p90": g.windspeed_10m_max.quantile(0.9),
        })
scen = pd.DataFrame(rows).round(1)
scen.to_csv(HERE / "data" / "seasonal_scenarios.csv", index=False, encoding="utf-8-sig")
print(f"저장: data/seasonal_scenarios.csv ({len(scen)}행 = {scen.sigungu.nunique()}시군 × 12월)")

# ── 겨울 한파 감점(cold)은 엔진에 없으므로 heat 슬롯과 별도로 추정치만 표기 ──
def cold_points(t):
    if t > -5: return 0.0
    if t > -12: return (-5 - t) / 7 * 8
    if t > -15: return 12 + (-12 - t) * (10 / 3)
    return min(25, 22 + (-15 - t) * 1.5)

def seasonal_range(place, month):
    """관광지 + 월 → (통상일 점수, 궂은날 점수). 표고 기온감률 보정 포함."""
    s = scen[(scen.sigunguCode == place.sigunguCode) & (scen.month == month)]
    if s.empty:
        return None
    s = s.iloc[0]
    dz_t = -LAPSE * (place.elevation_m - s.seat_elev)
    fire = FIRE_BY_MONTH[month]
    common = dict(pm25=25, forestFireLevel=fire, emergencyRoomKm=round(place.er_km, 1))

    typical = dict(tempC=s.tmax_med + dz_t, rainProbPct=int(s.wetday_pct),
                   windMs=s.wind_med, **common)
    bad = dict(tempC=s.tmax_p90 + dz_t, rainProbPct=85, rainMm=s.precip_p90,
               windMs=s.wind_p90, **common)

    out = {}
    for label, inp, tmin in [("typical", typical, s.tmin_med), ("bad", bad, s.tmin_p10)]:
        sc = compute_safety_score(inp, place.envType)
        # 한파 감점: 엔진 외 별도 차감 (실내 0.3 가중)
        cold = cold_points(tmin + dz_t) * (0.3 if place.envType == "indoor" else 1.0)
        out[label] = max(0, sc["score"] - round(cold))
    return out["typical"], out["bad"]

# ── 데모 ──
places = pd.read_parquet(HERE / "places_clustered_v2.parquet")
demo = {
    "계방산(평창) — 고산": 125612,
    "미산계곡(인제) — 수변": int(places[places.title == "미산계곡"].contentId.iloc[0]),
    "갯마을해변(양양) — 해안": int(places[(places.envType == "outdoor_coast") & (places.sigunguCode == 7)].contentId.iloc[0]),
    "춘천문학공원 — 도심": int(places[places.title == "춘천문학공원"].contentId.iloc[0]),
}
months = [1, 4, 7, 10]
print("\n[데모: 월별 계절 점수 범위 — 통상일/궂은날]")
print("관광지".ljust(24) + "".join(f"{m}월".rjust(12) for m in months))
for label, cid in demo.items():
    pl = places[places.contentId == cid].iloc[0]
    cells = []
    for m in months:
        r = seasonal_range(pl, m)
        cells.append(f"{r[0]:.0f}/{r[1]:.0f}" if r else "—")
    print(label.ljust(24) + "".join(c.rjust(12) for c in cells))

# ── 검증: '궂은날 위험도(100-점수)' 월평균 ↔ 119 사고 월별 ──
from scipy.stats import spearmanr
acc = pd.read_csv(HERE / "data" / "accidents" / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv")
monthly_acc = acc.DCLR_MM.value_counts().sort_index()
sample = places.sample(150, random_state=42)
risk_by_m = []
for m in range(1, 13):
    scores = [seasonal_range(p, m) for p in sample.itertuples()]
    scores = [s[1] for s in scores if s]
    risk_by_m.append(100 - np.mean(scores))
rho, pv = spearmanr(risk_by_m, monthly_acc.reindex(range(1, 13)).values)
print(f"\n[검증] 궂은날 위험도 월별 ↔ 119 사고 건수: rho={rho:+.2f} (p={pv:.3f}) — 노출 교란 있음, 방향 참고")
print("월별 궂은날 평균 위험도:", [f"{m}월 {r:.0f}" for m, r in zip(range(1, 13), risk_by_m)])
