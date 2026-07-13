# -*- coding: utf-8 -*-
# 17_export_service_data.py — 계절모드 서비스 연결용 데이터 export
#
# ① seasonal_scenarios.csv → harinote/src/data/seasonal-scenarios.json
#    { "<sigunguCode>": { "<month>": { seatElev, tmaxMed, tminMed, windMed,
#                                       wetdayPct, tmaxP90, tminP10, precipP90, windP90 } } }
# ② places_clustered_v2.parquet → harinote/src/data/elevations.json
#    { "<contentId>": 표고(m, 정수) }
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
OUT = HERE.parent / "harinote" / "src" / "data"

# ① 계절 시나리오
scen = pd.read_csv(HERE / "data" / "seasonal_scenarios.csv")
scenarios = {}
for r in scen.itertuples():
    scenarios.setdefault(str(int(r.sigunguCode)), {})[str(int(r.month))] = {
        "seatElev": round(float(r.seat_elev), 1),
        "tmaxMed": float(r.tmax_med),
        "tminMed": float(r.tmin_med),
        "windMed": float(r.wind_med),
        "wetdayPct": int(r.wetday_pct),
        "tmaxP90": float(r.tmax_p90),
        "tminP10": float(r.tmin_p10),
        "precipP90": float(r.precip_p90),
        "windP90": float(r.wind_p90),
    }
p1 = OUT / "seasonal-scenarios.json"
p1.write_text(json.dumps(scenarios, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"저장: {p1} — {len(scen)}행 ({len(scenarios)}시군)")

# ② 관광지 표고
places = pd.read_parquet(HERE / "places_clustered_v2.parquet")
elev = {
    str(int(r.contentId)): int(round(r.elevation_m))
    for r in places.itertuples()
    if pd.notna(r.elevation_m)
}
p2 = OUT / "elevations.json"
p2.write_text(json.dumps(elev, separators=(",", ":")), encoding="utf-8")
print(f"저장: {p2} — {len(elev)}곳 (전체 {len(places)}곳)")

# 수기 대조용 샘플
for cid in list(elev)[:3]:
    print(f"  표고 샘플 contentId={cid}: {elev[cid]}m")
print("  강릉 1월:", scenarios["1"]["1"])
