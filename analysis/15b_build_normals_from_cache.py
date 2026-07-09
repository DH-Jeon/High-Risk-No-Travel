# -*- coding: utf-8 -*-
# 15b_build_normals_from_cache.py — 캐시된 시군만으로 climate_normals.csv 생성
# (15의 집계와 동일 — 429로 미수집된 시군은 건너뛰고 나중에 15 재실행으로 보충)
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
OUT_RAW = HERE / "data" / "climate_daily_raw"

SEATS = {
    1: "강릉시", 2: "고성군", 3: "동해시", 4: "삼척시", 5: "속초시", 6: "양구군",
    7: "양양군", 8: "영월군", 9: "원주시", 10: "인제군", 11: "정선군", 12: "철원군",
    13: "춘천시", 14: "태백시", 15: "평창군", 16: "홍천군", 17: "화천군", 18: "횡성군",
}

rows, missing = [], []
for code, name in SEATS.items():
    cache = OUT_RAW / f"{name}.json"
    if not cache.exists():
        missing.append(name)
        continue
    data = json.loads(cache.read_text(encoding="utf-8"))
    d = pd.DataFrame(data["daily"])
    d["time"] = pd.to_datetime(d.time)
    d["month"] = d.time.dt.month
    d["year"] = d.time.dt.year
    g = d.groupby("month")
    n_years = 30
    agg = pd.DataFrame({
        "tmax_avg": g.temperature_2m_max.mean(),
        "tmin_avg": g.temperature_2m_min.mean(),
        "precip_mm": d.groupby(["year", "month"]).precipitation_sum.sum().groupby("month").mean(),
        "heat33_days": g.temperature_2m_max.apply(lambda s: (s >= 33).sum() / n_years),
        "heat35_days": g.temperature_2m_max.apply(lambda s: (s >= 35).sum() / n_years),
        "cold12_days": g.temperature_2m_min.apply(lambda s: (s <= -12).sum() / n_years),
        "cold15_days": g.temperature_2m_min.apply(lambda s: (s <= -15).sum() / n_years),
        "rain30_days": g.precipitation_sum.apply(lambda s: (s >= 30).sum() / n_years),
        "rain60_days": g.precipitation_sum.apply(lambda s: (s >= 60).sum() / n_years),
        "wind14_days": g.windspeed_10m_max.apply(lambda s: (s >= 14).sum() / n_years),
    }).round(2)
    agg["sigunguCode"] = code
    agg["sigungu"] = name
    agg["seat_elevation_m"] = data.get("elevation")
    rows.append(agg.reset_index())

normals = pd.concat(rows, ignore_index=True)
normals.to_csv(HERE / "data" / "climate_normals.csv", index=False, encoding="utf-8-sig")
print(f"생성: {normals.sigungu.nunique()}개 시군 × 12월 = {len(normals)}행"
      + (f" — 미수집: {missing} (15 재실행으로 보충)" if missing else ""))
