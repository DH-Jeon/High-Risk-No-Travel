# -*- coding: utf-8 -*-
# 11_medical_curve.py — 의료 접근성 감점 커브의 실증 재보정 (제안 단계, 서비스 무변경)
#
# 현행: weights.ts MEDICAL — 복지부 취약지 기준(지역응급의료센터 30분/1시간)을
#       "도로 이동거리로 환산해" 10/20/30km 구간화 (환산 근거는 가정)
# 이 분석: 강원 119 실측(출동거리 km ↔ 출동→도착 분, n≈6,000)으로
#       거리→시간 환산을 데이터로 추정 → 골든타임 30분/60분에 대응하는
#       실제 km 경계를 역산 → 현행 구간과 비교, 필요 시 보정안 제시
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

HERE = Path(__file__).parent
ACC = HERE / "data" / "accidents"

t = pd.read_csv(ACC / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv")
a = pd.read_csv(ACC / "안전사고_0000" / "안전사고_0000.csv")
acc = pd.concat([t, a], ignore_index=True)
acc = acc[acc.GRNDS_SGG_NM != "강원도"].copy()

def to_dt(d, prefix):
    return pd.to_datetime(dict(
        year=d[f"{prefix}_YR"], month=d[f"{prefix}_MM"], day=d[f"{prefix}_DAY"],
        hour=d[f"{prefix}_HR"], minute=d[f"{prefix}_MN"]), errors="coerce")

acc["resp_min"] = (to_dt(acc, "GRNDS_ARVL") - to_dt(acc, "DSPT")).dt.total_seconds() / 60
acc["dist_km"] = pd.to_numeric(acc.GRNDS_DSTNC, errors="coerce")
d = acc[(acc.resp_min.between(1, 120)) & (acc.dist_km.between(0.1, 60))].copy()
print(f"유효 표본: {len(d)}건 (거리 0.1~60km, 시간 1~120분)")

# ── 1. 거리→시간 관계: 중앙값 회귀 (이상치 강건) ──
med = smf.quantreg("resp_min ~ dist_km", d).fit(q=0.5)
q90 = smf.quantreg("resp_min ~ dist_km", d).fit(q=0.9)
b0, b1 = med.params["Intercept"], med.params["dist_km"]
print(f"\n중앙값 회귀: 소요시간(분) = {b0:.1f} + {b1:.2f} × 거리(km)")
print(f"  (90분위 회귀: {q90.params['Intercept']:.1f} + {q90.params['dist_km']:.2f} × km — 악조건)")

# 자연장소 사고만 (산길·비포장 반영 여부 확인)
nat = d[d.ACDNT_OCRN_PLC_NM == "바다/강/산/논밭"]
mn = smf.quantreg("resp_min ~ dist_km", nat).fit(q=0.5)
print(f"  자연장소만(n={len(nat)}): {mn.params['Intercept']:.1f} + {mn.params['dist_km']:.2f} × km")

# 구간별 실측 중앙값 (모형 없이 원자료 확인)
bins = [0, 5, 10, 15, 20, 25, 30, 60]
d["km_bin"] = pd.cut(d.dist_km, bins)
tab = d.groupby("km_bin", observed=True).agg(
    n=("resp_min", "size"), resp_med=("resp_min", "median"),
    resp_p90=("resp_min", lambda s: s.quantile(0.9)),
).round(1)
print("\n구간별 실측:")
print(tab.to_string())

# ── 2. 골든타임 역산: 중앙값 기준 30분/60분에 걸리는 거리 ──
km30 = (30 - b0) / b1
km60 = (60 - b0) / b1
km30_bad = (30 - q90.params["Intercept"]) / q90.params["dist_km"]
print(f"\n골든타임 역산 (편도 출동 기준):")
print(f"  30분 도달 한계: 중앙값 {km30:.0f}km / 악조건(90분위) {km30_bad:.0f}km")
print(f"  60분 도달 한계: 중앙값 {km60:.0f}km")
print(f"  → 현행 구간 10/20/30km에 대응하는 실측 소요: "
      f"{b0 + b1 * 10:.0f}분 / {b0 + b1 * 20:.0f}분 / {b0 + b1 * 30:.0f}분")

# ── 3. 보정안: 시간 기준 감점 (병원 거리 er_km에 환산식 적용) ──
# 주의: er_km는 관광지→병원 직선거리, 실측은 소방서→현장 도로거리.
# 직선→도로 우회계수(강원 산지 통상 1.3~1.4)를 보수적으로 1.3 적용.
DETOUR = 1.3

def minutes_to_er(er_km):
    return b0 + b1 * er_km * DETOUR

def medical_points_current(km):
    if km >= 30: return 10.0
    if km > 20: return 5 + (km - 20) / 10 * 5
    if km > 10: return 2 + (km - 10) / 10 * 3
    return km / 10 * 2

def medical_points_proposed(km):
    m = minutes_to_er(km)
    if m >= 60: return 10.0        # 골든아워 초과 — 상한
    if m >= 30: return 5 + (m - 30) / 30 * 5   # 30~60분: 5→10
    if m >= 15: return 2 + (m - 15) / 15 * 3   # 15~30분: 2→5
    return m / 15 * 2               # 15분 이내: 0→2

places = pd.read_parquet(HERE / "places_clustered_v2.parquet")
places["min_est"] = places.er_km.map(minutes_to_er)
places["pts_cur"] = places.er_km.map(medical_points_current).round()
places["pts_new"] = places.er_km.map(medical_points_proposed).round()
places["diff"] = places.pts_new - places.pts_cur

print(f"\n관광지 775곳 적용 비교 (보정안 = 시간 기준 15/30/60분 구간):")
print(f"  감점 증가 {(places['diff'] > 0).sum()}곳 / 동일 {(places['diff'] == 0).sum()}곳 / 감소 {(places['diff'] < 0).sum()}곳")
print(f"  평균 변화 {places['diff'].mean():+.2f}점, 최대 {places['diff'].max():+.0f}점")

chg = places[places["diff"] != 0]
print("\n변화 큰 곳 (감점 증가 상위 8):")
print(places.nlargest(8, "diff")[["title", "sigungu", "er_km", "min_est", "pts_cur", "pts_new"]]
      .round(1).to_string(index=False))

out = places[["contentId", "title", "sigungu", "er_km", "min_est", "pts_cur", "pts_new", "diff"]]
out.to_csv(HERE / "data" / "medical_curve_proposal.csv", index=False, encoding="utf-8-sig")
print("\n저장: data/medical_curve_proposal.csv (제안 명세 — 서비스 반영은 협의 후)")
