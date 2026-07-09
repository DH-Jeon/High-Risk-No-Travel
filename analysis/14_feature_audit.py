# -*- coding: utf-8 -*-
# 14_feature_audit.py — 현재 사이트가 실제로 내는 출력 전수 점검
# 목적: "정보 전달력이 있는가"를 대표 관광지의 실제 기능 출력으로 확인.
#       각 기능의 데이터 실체(실데이터/mock/미연동)를 함께 표시.
from pathlib import Path
import numpy as np
import pandas as pd
from safety_engine import compute_safety_score
import importlib.util

# 13번의 mock 재현 로직 재사용
spec = importlib.util.spec_from_file_location("m13", Path(__file__).parent / "13_profile_effect.py")

HERE = Path(__file__).parent
M32 = 0xFFFFFFFF
def imul(a, b): return (a * b) & M32
def hash32(seed):
    x = (seed + 0x9E3779B9) & M32
    x = imul(x ^ (x >> 16), 0x21F0AAAD)
    x = imul(x ^ (x >> 15), 0x735A2D97)
    return (x ^ (x >> 15)) & M32
def rand01(cid, salt): return hash32((imul(cid, 0x9E3779B1) ^ imul(salt, 0x85EBCA6B)) & M32) / 0x1_0000_0000
SCEN = ["clear", "heatwave", "rainy", "bad_air"]
def mock_input(cid, env):
    s = SCEN[hash32(cid) % 4]; r = lambda salt: rand01(cid, salt)
    if s == "clear": inp = dict(tempC=23+r(1)*4, rainProbPct=round(r(2)*20), windMs=1+r(3)*3, pm25=round(5+r(4)*10), forestFireLevel=1, emergencyRoomKm=3+r(5)*7)
    elif s == "heatwave":
        sev=r(6); inp = dict(tempC=34+sev*2, rainProbPct=round(r(2)*20), windMs=1+r(3)*3, pm25=round(20+sev*35), forestFireLevel=4 if sev>.75 else 3 if sev>.4 else 2, emergencyRoomKm=4+sev*30)
    elif s == "rainy":
        sev=r(7); inp = dict(tempC=24+r(1)*4, rainProbPct=round(70+sev*20), rainMm=round(20+sev*60), windMs=5+sev*9, pm25=round(5+r(4)*15), forestFireLevel=1, emergencyRoomKm=4+r(5)*16)
    else: inp = dict(tempC=26+r(1)*5, rainProbPct=round(r(2)*20), windMs=1+r(3)*2, pm25=round(60+r(8)*30), forestFireLevel=2 if r(9)>.5 else 1, emergencyRoomKm=4+r(5)*20)
    if env=="outdoor_mountain": inp["windMs"]+=2
    elif env=="outdoor_coast": inp["windMs"]+=3
    return inp, s

def haversine(a, b, c, d):
    R=6371; p1,p2=np.radians(a),np.radians(c)
    return 2*R*np.arcsin(np.sqrt(np.sin((p2-p1)/2)**2+np.cos(p1)*np.cos(p2)*np.sin(np.radians(d-b)/2)**2))

df = pd.read_parquet(HERE / "places_features.parquet")
attr = df[df.contentTypeId == 12].reset_index(drop=True).copy()

# 전체 점수 (default) — 대체지 계산용
recs = []
for r_ in attr.itertuples():
    inp, s = mock_input(int(r_.contentId), r_.envType)
    inp["emergencyRoomKm"] = round(r_.er_km, 1)
    sc = compute_safety_score(inp, r_.envType, "default")
    recs.append({"score": sc["score"], "scen": s, **{f"pt_{k}": sc[k] for k in ["heat","rain_wind","pm","fire","medical"]}})
sc_df = pd.DataFrame(recs)
attr = pd.concat([attr, sc_df], axis=1)

print(f"전체 관광지 {len(attr)}곳 안전점수 분포: 최저 {attr.score.min()} / 중앙 {attr.score.median():.0f} / 최고 {attr.score.max()}")
print(f"등급 분포: low(70+) {(attr.score>=70).sum()} / moderate(40~69) {attr.score.between(40,69).sum()} / high(<40) {(attr.score<40).sum()}")
print(f"mock 날씨 시나리오 배정: {attr.scen.value_counts().to_dict()}\n")

# 대표 4곳: 위험한 폭염, 안전한 도심, 고산, 해안
samples = {
    "계방산(평창) — 고산·의료취약": 125612,
    "폭염 시나리오 대표": int(attr[attr.scen=="heatwave"].sort_values("score").iloc[0].contentId),
    "비 시나리오 대표": int(attr[attr.scen=="rainy"].sort_values("score").iloc[0].contentId),
    "안전 도심 대표": int(attr[attr.scen=="clear"].sort_values("score", ascending=False).iloc[0].contentId),
}

for label, cid in samples.items():
    row = attr[attr.contentId == cid].iloc[0]
    inp, s = mock_input(cid, row.envType)
    inp["emergencyRoomKm"] = round(row.er_km, 1)
    print("="*72)
    print(f"[{label}]  {row.title} ({row.sigungu}, 표고 {row.elevation_m:.0f}m)")
    print(f"  mock 날씨({s}): 기온 {inp['tempC']:.1f}℃ / 강수 {inp['rainProbPct']}% / 풍속 {inp['windMs']:.1f}m/s / PM {inp['pm25']} / 산불 {inp['forestFireLevel']}단계")
    print(f"  응급실 거리(실계산): {row.er_km:.1f}km")
    print("  ── 프로필별 안전점수 ──")
    for p, pn in [("default","기본"),("with_kids","아이"),("with_seniors","부모님"),("own_car","자차")]:
        sc = compute_safety_score(inp, row.envType, p)
        print(f"    {pn:5s}: {sc['score']:3d}점  (폭염-{sc['heat']} 강수강풍-{sc['rain_wind']} 미세-{sc['pm']} 산불-{sc['fire']} 의료-{sc['medical']})")
    # 대체지 top3 (30km, 점수+5, cat 유사)
    cand = attr[attr.contentId != cid].copy()
    cand["dist"] = haversine(row.lat, row.lng, cand.lat.values, cand.lng.values)
    cand = cand[(cand.dist <= 30) & (cand.score >= row.score + 5)]
    def sim(c): return 3 if c.cat3==row.cat3 else 2 if c.cat2==row.cat2 else 1
    cand["sim"] = cand.apply(sim, axis=1)
    cand = cand.sort_values(["sim","score","dist"], ascending=[False,False,True]).head(3)
    print("  ── 안전 대체지 추천 ──")
    if len(cand)==0: print("    (없음)")
    for c in cand.itertuples():
        print(f"    {c.title} — {c.score}점 · {c.dist:.1f}km")
