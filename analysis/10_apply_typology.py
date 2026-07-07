# -*- coding: utf-8 -*-
# 10_apply_typology.py — 분류 결과를 "현재 산출식"에 적용했을 때의 점수 영향 (before/after)
# 서비스 산식은 그대로 두고, 입력(envType)만 분석 결과로 보정한다:
#   보정 규칙: 고지·오지형 & 표고 400m+ & 현재 envType=outdoor_general → outdoor_mountain
#   (근거: 클러스터링이 찾은 고지대 오지 — 산불·강풍 가중 누락 상태)
# 시나리오: 산불철 봄날 (산불 3단계 + 강풍 10m/s) — 보정이 드러나는 조건
from pathlib import Path

import pandas as pd

from safety_engine import compute_safety_score

HERE = Path(__file__).parent
CLUSTER_NAME = {0: "근교전천후", 1: "실내", 2: "산악", 3: "고지오지", 4: "수변", 5: "해안"}

df = pd.read_parquet(HERE / "places_clustered_v2.parquet")
df["type"] = df.k6.map(CLUSTER_NAME)

# ── 보정 대상 ──
target = (df.type == "고지오지") & (df.elevation_m >= 400) & (df.envType == "outdoor_general")
df["envType_fixed"] = df.envType.where(~target, "outdoor_mountain")
print(f"envType 보정 대상: {target.sum()}건 / 775건 (고지오지 132건 중 표고 400m+ )")

# ── 산불철 시나리오로 before/after 점수 ──
SCEN = {"tempC": 22, "rainProbPct": 10, "windMs": 10, "pm25": 25, "forestFireLevel": 3}

def score(env_col):
    return [
        compute_safety_score({**SCEN, "emergencyRoomKm": km}, et)["score"]
        for km, et in zip(df.er_km, df[env_col])
    ]

df["score_before"] = score("envType")
df["score_after"] = score("envType_fixed")
df["delta"] = df.score_after - df.score_before

chg = df[target].copy()
print(f"\n[산불철 시나리오: 산불 3단계 + 풍속 10m/s]")
print(f"보정 대상 {len(chg)}건의 점수 변화: 평균 {chg.delta.mean():+.1f}점 "
      f"(범위 {chg.delta.min():+.0f} ~ {chg.delta.max():+.0f})")

def grade(s):
    return "low" if s >= 70 else ("moderate" if s >= 40 else "high")

chg["grade_before"] = chg.score_before.map(grade)
chg["grade_after"] = chg.score_after.map(grade)
flip = chg[chg.grade_before != chg.grade_after]
print(f"등급이 바뀌는 곳: {len(flip)}건 (low → moderate 등 — 사용자에게 보이는 변화)")

print("\n변화 큰 사례 10곳:")
cols = ["title", "sigungu", "elevation_m", "er_km", "score_before", "score_after", "grade_before", "grade_after"]
print(chg.nsmallest(10, "delta")[cols].round(0).to_string(index=False))

# 전체 분포 영향 (보정 비대상 포함)
print(f"\n전체 775건 중 점수 변동: {(df.delta != 0).sum()}건 (비대상은 변화 없음 — 최소 침습 확인)")

out = chg[["contentId", "title", "sigungu", "elevation_m", "er_km",
           "score_before", "score_after", "grade_before", "grade_after"]]
out.to_csv(HERE / "data" / "envtype_fix_impact.csv", index=False, encoding="utf-8-sig")
print("저장: data/envtype_fix_impact.csv")
