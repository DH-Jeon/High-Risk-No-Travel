# -*- coding: utf-8 -*-
# 16_seasonal_prior.py — 계절 위험 prior: "그날(D+11~)의 기대 감점" 설계
#
# 문제: 평년 '평균'을 그대로 점수 엔진에 넣으면 극단이 씻겨나간다
#   (7월 평균 최고기온 ~28℃ → 폭염 감점 0, 실제로는 폭염일이 월 3~5일 존재)
# 설계: 특보급 '일수 빈도'를 확률로 보고 기대 감점을 계산
#   E[감점] = P(경보급)×경보 대표감점 + P(주의보급)×주의보 대표감점 + (1−P)×평년평균 감점
# 산불: 기후가 아닌 산림청 공식 산불조심기간(봄 2/1~5/15, 가을 11/1~12/15) 달력 prior
# 표고: 시군 대표점 기온에 기온감률(-0.65℃/100m)로 관광지별 보정
from pathlib import Path

import numpy as np
import pandas as pd

from safety_engine import (compute_safety_score, heat_points, rain_points,
                           wind_points, medical_points, ENV_WEIGHT)

HERE = Path(__file__).parent
DIM = {1: 31, 2: 28.25, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31}
LAPSE = 0.0065

nm = pd.read_csv(HERE / "data" / "climate_normals.csv")

# ── 한파 감점 (12_winter_scenario와 동일 구조) ──
def cold_points(t):
    if t > -5: return 0.0
    if t > -12: return (-5 - t) / 7 * 8
    if t > -15: return 12 + (-12 - t) * (10 / 3)
    return min(25, 22 + (-15 - t) * 1.5)

# ── 산불 달력 prior: 산림청 공식 산불조심기간 ──
# 봄(2/1~5/15) — 연중 최다 발생기, 대표 3단계 / 가을(11/1~12/15) 2단계 / 그 외 1단계
FIRE_LEVEL_BY_MONTH = {1: 1, 2: 3, 3: 3, 4: 3, 5: 2.5, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1.5, 11: 2, 12: 2}
FIRE_PTS = {1: 0, 1.5: 3, 2: 6, 2.5: 9, 3: 12}

def expected_deductions(row, dim):
    """시군×월 평년 행 → 요인별 기대 base 감점 (env/표고 가중 전)"""
    p33 = row.heat33_days / dim
    p35 = row.heat35_days / dim
    e_heat = (p35 * 23 + max(0, p33 - p35) * 17
              + max(0, 1 - p33) * heat_points(row.tmax_avg))
    p12 = row.cold12_days / dim
    p15 = row.cold15_days / dim
    e_cold = (p15 * 23 + max(0, p12 - p15) * 17
              + max(0, 1 - p12) * cold_points(row.tmin_avg))
    p30 = row.rain30_days / dim
    p60 = row.rain60_days / dim
    # 호우일 대표 감점: 60mm급(prob80%+heavy)≈18, 30mm급(prob70%+moderate)≈15 / 그 외 맑음 0
    e_rain = p60 * 18 + max(0, p30 - p60) * 15
    e_wind = (row.wind14_days / dim) * 8
    e_fire = FIRE_PTS[FIRE_LEVEL_BY_MONTH[int(row.month)]]
    return e_heat, e_cold, e_rain, e_wind, e_fire

rows = []
for r in nm.itertuples():
    dim = DIM[int(r.month)]
    e_heat, e_cold, e_rain, e_wind, e_fire = expected_deductions(r, dim)
    rows.append({"sigunguCode": r.sigunguCode, "sigungu": r.sigungu, "month": int(r.month),
                 "e_heat": e_heat, "e_cold": e_cold, "e_rain": e_rain,
                 "e_wind": e_wind, "e_fire": e_fire,
                 "tmax_avg": r.tmax_avg, "tmin_avg": r.tmin_avg,
                 "seat_elev": r.seat_elevation_m})
prior = pd.DataFrame(rows).round(2)
prior.to_csv(HERE / "data" / "seasonal_prior.csv", index=False, encoding="utf-8-sig")
print(f"저장: data/seasonal_prior.csv ({len(prior)}행)")

print("\n[월별 전 시군 평균 기대 base 감점 — 계절 프로파일]")
print(prior.groupby("month")[["e_heat", "e_cold", "e_rain", "e_wind", "e_fire"]].mean().round(1).to_string())

# ── 관광지 단위 적용: 계절 모드 점수 함수 ──
def seasonal_score(place, month, profile="default"):
    """관광지 + 월 → 계절 모드 기대 안전점수 (표고·env·프로필 가중 반영)"""
    p = prior[(prior.sigunguCode == place.sigunguCode) & (prior.month == month)].iloc[0]
    env = ENV_WEIGHT[place.envType]
    dz = (place.elevation_m - p.seat_elev)  # 대표점 대비 표고차
    # 표고 보정: 기온 −0.65℃/100m — 한파·폭염 기대감점을 보정 기온으로 재평가
    t_shift = -LAPSE * dz
    e_heat = max(0, p.e_heat + (heat_points(p.tmax_avg + t_shift) - heat_points(p.tmax_avg)))
    e_cold = max(0, p.e_cold + (cold_points(p.tmin_avg + t_shift) - cold_points(p.tmin_avg)))
    kids = 1.3 if profile == "with_kids" else 1.0
    med_w = 1.5 if profile == "with_seniors" else 1.0
    ded = (min(25, e_heat * env["heat"] * kids)
           + min(25, e_cold * (0.3 if place.envType == "indoor" else 1.0))
           + min(20, p.e_rain * env["rain"] + p.e_wind * env["wind"])
           + min(20, p.e_fire * env["fire"])
           + min(10, medical_points(place.er_km) * med_w))
    return round(max(0, min(100, 100 - ded)), 1)

# ── 데모: 대표 관광지 × 계절 ──
places = pd.read_parquet(HERE / "places_clustered_v2.parquet")
demo = {
    "계방산(평창) 고산": 125612,
    "미산계곡(인제) 수변": int(places[places.title == "미산계곡"].contentId.iloc[0]),
    "경포해변급 해안(양양권)": int(places[(places.envType == "outdoor_coast") & (places.sigunguCode == 7)].contentId.iloc[0]),
}
print("\n[데모: 월별 계절 모드 점수 — '그날 가도 될까'의 답]")
months = [1, 4, 7, 10]
header = "관광지".ljust(28) + "".join(f"{m}월".rjust(8) for m in months)
print(header)
for label, cid in demo.items():
    pl = places[places.contentId == cid].iloc[0]
    scores = [seasonal_score(pl, m) for m in months]
    print(f"{label} ({pl.title})".ljust(28) + "".join(f"{s:8.0f}" for s in scores))

# ── 검증: 계절 위험지수 vs 119 월별 사고 (방향성 확인) ──
acc = pd.read_csv(HERE / "data" / "accidents" / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv")
monthly_acc = acc.DCLR_MM.value_counts().sort_index()
risk_idx = prior.groupby("month")[["e_heat", "e_cold", "e_rain", "e_wind", "e_fire"]].mean().sum(axis=1)
from scipy.stats import spearmanr
rho, pv = spearmanr(risk_idx.values, monthly_acc.reindex(risk_idx.index).values)
print(f"\n[검증] 월별 계절 위험지수 ↔ 119 관광지 사고 건수: Spearman rho={rho:+.2f} (p={pv:.3f})")
print("(사고 건수엔 방문객 수 교란 있음 — 방향성 참고용)")
