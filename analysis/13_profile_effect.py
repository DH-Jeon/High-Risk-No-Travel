# -*- coding: utf-8 -*-
# 13_profile_effect.py — "프로필(기본/아이/부모님/자차)을 바꿔도 점수가 같다"의 원인 진단
# 앱의 mockRiskInputFor(risk-inputs.ts) + getLiveRiskInput(er_km 실계산)을 재현해
# 프로필별로 실제 점수가 달라지는 관광지가 몇 곳인지 집계한다.
from pathlib import Path

import numpy as np
import pandas as pd

from safety_engine import compute_safety_score

HERE = Path(__file__).parent
M32 = 0xFFFFFFFF

def imul(a, b):
    return (a * b) & M32

def hash32(seed):
    x = (seed + 0x9E3779B9) & M32
    x = imul(x ^ (x >> 16), 0x21F0AAAD)
    x = imul(x ^ (x >> 15), 0x735A2D97)
    return (x ^ (x >> 15)) & M32

def rand01(cid, salt):
    return hash32((imul(cid, 0x9E3779B1) ^ imul(salt, 0x85EBCA6B)) & M32) / 0x1_0000_0000

SCEN = ["clear", "heatwave", "rainy", "bad_air"]

def mock_input(cid, env):
    s = SCEN[hash32(cid) % 4]
    r = lambda salt: rand01(cid, salt)
    if s == "clear":
        inp = dict(tempC=23 + r(1) * 4, rainProbPct=round(r(2) * 20), windMs=1 + r(3) * 3,
                   pm25=round(5 + r(4) * 10), forestFireLevel=1, emergencyRoomKm=3 + r(5) * 7)
    elif s == "heatwave":
        sev = r(6)
        inp = dict(tempC=34 + sev * 2, rainProbPct=round(r(2) * 20), windMs=1 + r(3) * 3,
                   pm25=round(20 + sev * 35), forestFireLevel=4 if sev > .75 else 3 if sev > .4 else 2,
                   emergencyRoomKm=4 + sev * 30)
    elif s == "rainy":
        sev = r(7)
        inp = dict(tempC=24 + r(1) * 4, rainProbPct=round(70 + sev * 20), rainMm=round(20 + sev * 60),
                   windMs=5 + sev * 9, pm25=round(5 + r(4) * 15), forestFireLevel=1,
                   emergencyRoomKm=4 + r(5) * 16)
    else:  # bad_air
        inp = dict(tempC=26 + r(1) * 5, rainProbPct=round(r(2) * 20), windMs=1 + r(3) * 2,
                   pm25=round(60 + r(8) * 30), forestFireLevel=2 if r(9) > .5 else 1,
                   emergencyRoomKm=4 + r(5) * 20)
    if env == "outdoor_mountain":
        inp["windMs"] += 2
    elif env == "outdoor_coast":
        inp["windMs"] += 3
    if r(10) < 0.7:
        inp["shelterKm"] = 0.4 + r(11) * 4
    return inp, s

df = pd.read_parquet(HERE / "places_features.parquet")
attr = df[df.contentTypeId == 12].copy()

PROFILES = ["default", "with_kids", "with_seniors", "own_car"]
rows = []
scen_count = {}
for r_ in attr.itertuples():
    inp, s = mock_input(int(r_.contentId), r_.envType)
    inp["emergencyRoomKm"] = round(r_.er_km, 1)  # 앱: 병원 좌표 실계산으로 덮어씀
    scen_count[s] = scen_count.get(s, 0) + 1
    scores = {p: compute_safety_score(inp, r_.envType, p)["score"] for p in PROFILES}
    rows.append(scores)

res = pd.DataFrame(rows)
print(f"관광지 {len(res)}곳 · mock 시나리오 배정: {scen_count}\n")

print("프로필별 '기본과 점수가 다른' 관광지 수:")
for p in PROFILES[1:]:
    diff = (res[p] != res["default"])
    n = diff.sum()
    avg = (res[p] - res["default"])[diff].mean() if n else 0
    print(f"  {p:13s}: {n:3d}곳 / {len(res)} ({n/len(res)*100:.1f}%)  평균 변화 {avg:+.1f}점")

print("\n원인 분해:")
# 자차: road 감점이 입력에 아예 없음 → 항상 0
print("  · own_car(자차): roadRisk 미연동 → road 감점 항상 0 → 어떤 곳도 변화 없음")
# 아이: heat 또는 pm 감점 있는 곳에서만
heat_or_pm = attr.apply(lambda x: (lambda inp: inp[0]["tempC"] >= 28 or inp[0]["pm25"] >= 16)(mock_input(int(x.contentId), x.envType)), axis=1)
print(f"  · with_kids(아이): 폭염 or 미세먼지 감점 있는 곳에서만 → 해당 {heat_or_pm.sum()}곳")
# 부모: medical 감점 있고 & 상한(10) 미만인 곳에서만
def med_room(x):
    return round(x.er_km, 1)
med_between = attr.er_km.between(6.7, 30, inclusive="neither")  # 감점>0 이고 <10점(상한) 대략
print(f"  · with_seniors(부모님): 의료 감점이 있고 상한(10점) 전인 곳 → 대략 {med_between.sum()}곳")
print("    (응급실 30km+는 이미 medical 10점 상한이라 ×1.5 해도 clamp되어 변화 없음)")
