# -*- coding: utf-8 -*-
# 18_kids_match.py — 유아 동반 가능 문화시설(한국문화정보원, 2022-10-31 기준)을
# 우리 관광지(gangwon.json)와 매칭 → harinote/src/data/kids-friendly.json
#
# 매칭 규칙: 이름 정규화 일치(공백·특수문자 제거) AND 좌표 거리 ≤ 500m
#            (이름만 같고 먼 곳 = 동명 시설 오매칭 방지)
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
OUT = HERE.parent / "harinote" / "src" / "data" / "kids-friendly.json"

kids = pd.read_csv(HERE / "data" / "kids_facilities_20221031.csv", encoding="cp949")
kids = kids[kids["시도 명칭"].str.contains("강원", na=False)].copy()
print(f"강원 시설: {len(kids)}행")

places = json.loads(
    (HERE.parent / "harinote" / "src" / "data" / "gangwon.json").read_text("utf-8")
)

def norm(s):
    return re.sub(r"[^가-힣a-zA-Z0-9]", "", str(s))

kids["_norm"] = kids["시설명"].map(norm)
kids_by_norm = {}
for r in kids.itertuples():
    kids_by_norm.setdefault(r._norm if hasattr(r, "_norm") else norm(r.시설명), []).append(r)
# itertuples는 한글 속성명이 깨질 수 있어 dict 재구성
kids_rows = kids.to_dict("records")
kids_by_norm = {}
for r in kids_rows:
    kids_by_norm.setdefault(norm(r["시설명"]), []).append(r)

def dist_km(lat1, lng1, lat2, lng2):
    dy = (lat1 - lat2) * 111.0
    dx = (lng1 - lng2) * 88.8  # 위도 37.5° 기준
    return (dx * dx + dy * dy) ** 0.5

def yn(v):
    return str(v).strip().upper() in ("Y", "1", "TRUE", "예", "있음")

out = {}
for p in places:
    cands = kids_by_norm.get(norm(p["title"]))
    if not cands:
        continue
    best = None
    for r in cands:
        try:
            d = dist_km(p["lat"], p["lng"], float(r["위도"]), float(r["경도"]))
        except (TypeError, ValueError):
            continue
        if d <= 0.5 and (best is None or d < best[0]):
            best = (d, r)
    if best is None:
        continue
    r = best[1]
    info = {
        "nursing": yn(r["수유실 보유 여부"]),
        "familyToilet": yn(r["가족 화장실 보유 여부"]),
        "stroller": yn(r["유모차 대여 여부"]),
        "kidsZone": yn(r["키즈존 여부"]),
    }
    age = str(r.get("입장 가능 나이", "")).strip()
    if age and age.lower() != "nan":
        info["age"] = age
    out[str(p["contentId"])] = info

OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), "utf-8")
print(f"매칭: {len(out)}곳 → {OUT}")
for cid, v in list(out.items())[:5]:
    title = next(p["title"] for p in places if str(p["contentId"]) == cid)
    print(" ", title, v)
