# -*- coding: utf-8 -*-
# 02_collect_elevation.py — 관광지 2,086곳 표고 수집 (OpenTopoData SRTM 30m)
# 무료 공개 API: 요청당 100지점, 1초 간격 예의 준수 → 약 21회 호출
import json
import time
from pathlib import Path

import pandas as pd
import urllib.request

HERE = Path(__file__).parent
OUT = HERE / "data" / "elevation.json"

df = pd.read_parquet(HERE / "places_eda.parquet")
points = df[["contentId", "lat", "lng"]].to_dict("records")

# 이미 수집된 것 이어받기 (재실행 안전)
done: dict[str, float | None] = {}
if OUT.exists():
    done = json.loads(OUT.read_text(encoding="utf-8"))

todo = [p for p in points if str(p["contentId"]) not in done]
print(f"전체 {len(points)}곳 중 수집 대상 {len(todo)}곳")

BATCH = 100
for i in range(0, len(todo), BATCH):
    batch = todo[i : i + BATCH]
    locs = "|".join(f"{p['lat']:.6f},{p['lng']:.6f}" for p in batch)
    url = f"https://api.opentopodata.org/v1/srtm30m?locations={locs}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            res = json.loads(r.read().decode())
        for p, item in zip(batch, res["results"]):
            done[str(p["contentId"])] = item["elevation"]
        print(f"  [{i + len(batch)}/{len(todo)}] ok")
    except Exception as e:
        print(f"  [{i}] 실패: {e} — 지금까지 저장 후 계속")
    OUT.write_text(json.dumps(done), encoding="utf-8")
    time.sleep(1.2)

vals = pd.Series({k: v for k, v in done.items() if v is not None}, dtype=float)
print(f"\n수집 완료: {len(vals)}/{len(points)}곳, 결측 {len(done) - len(vals)}곳")
print(vals.describe(percentiles=[0.1, 0.5, 0.9]).round(0))
print(f"저장: {OUT}")
