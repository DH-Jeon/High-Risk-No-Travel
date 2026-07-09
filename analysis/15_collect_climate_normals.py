# -*- coding: utf-8 -*-
# 15_collect_climate_normals.py — 강원 18개 시군 기후 평년값 수집 (계절 모드 재료)
#
# 소스: Open-Meteo Archive API (ERA5 재분석, 무료·키 불필요)
#   https://archive-api.open-meteo.com/v1/archive
# 기간: 1991-01-01 ~ 2020-12-31 (WMO 평년 기준 30년)
# 지점: 시군청 소재지 18곳 (risk/regions.ts SIGUNGU_SEATS와 동일)
# 산출(시군×월): 평균 최고/최저기온, 월강수량 + 특보급 일수 빈도
#   폭염일(tmax≥33/35), 한파일(tmin≤-12/-15), 호우일(일강수≥30/60mm), 강풍일(≥14m/s)
# 주의: ERA5는 격자 재분석값 — 기상청 공식 평년값과 다를 수 있음 (키 확보 시 교차검증 예정)
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
OUT_RAW = HERE / "data" / "climate_daily_raw"
OUT_RAW.mkdir(exist_ok=True)

SEATS = {
    1: ("강릉시", 37.7519, 128.8761), 2: ("고성군", 38.3806, 128.4678),
    3: ("동해시", 37.5247, 129.1143), 4: ("삼척시", 37.4499, 129.1651),
    5: ("속초시", 38.207, 128.5918), 6: ("양구군", 38.1057, 127.9899),
    7: ("양양군", 38.0752, 128.619), 8: ("영월군", 37.1837, 128.4614),
    9: ("원주시", 37.3387, 127.9201), 10: ("인제군", 38.0697, 128.1707),
    11: ("정선군", 37.3806, 128.6608), 12: ("철원군", 38.1466, 127.3132),
    13: ("춘천시", 37.8813, 127.7298), 14: ("태백시", 37.1641, 128.9856),
    15: ("평창군", 37.3708, 128.3901), 16: ("홍천군", 37.6969, 127.8887),
    17: ("화천군", 38.1062, 127.7082), 18: ("횡성군", 37.4917, 127.985),
}

VARS = "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"

def fetch_daily(name, lat, lng):
    cache = OUT_RAW / f"{name}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "start_date": "1991-01-01", "end_date": "2020-12-31",
        "daily": VARS, "windspeed_unit": "ms", "timezone": "Asia/Seoul",
    })
    url = f"https://archive-api.open-meteo.com/v1/archive?{q}"
    # 무료 티어 호출량 제한(429) — 대기 후 재시도 (분당 한도는 곧 풀림)
    for attempt in range(8):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = json.loads(r.read().decode())
            cache.write_text(json.dumps(data), encoding="utf-8")
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 70
                print(f"  {name}: 429 제한 — {wait}초 대기 후 재시도 ({attempt + 1}/8)")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"{name}: 재시도 초과")

rows = []
for code, (name, lat, lng) in SEATS.items():
    data = fetch_daily(name, lat, lng)
    d = pd.DataFrame(data["daily"])
    d["time"] = pd.to_datetime(d.time)
    d["month"] = d.time.dt.month
    d["year"] = d.time.dt.year
    g = d.groupby("month")
    n_years = 30
    agg = pd.DataFrame({
        "tmax_avg": g.temperature_2m_max.mean(),
        "tmin_avg": g.temperature_2m_min.mean(),
        # 월강수량: (월별 합 / 30년) — 연도별 월합의 평균
        "precip_mm": d.groupby(["year", "month"]).precipitation_sum.sum().groupby("month").mean(),
        # 특보급 일수: 해당 월에 평균 며칠 발생하는가 (30년 평균)
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
    # 대표점 표고 (ERA5 격자 표고 — 기온감률 보정 기준점)
    agg["seat_elevation_m"] = data.get("elevation", np.nan)
    rows.append(agg.reset_index())
    print(f"  {name}: 완료 (표고 {data.get('elevation')}m)")
    time.sleep(10)

normals = pd.concat(rows, ignore_index=True)
normals.to_csv(HERE / "data" / "climate_normals.csv", index=False, encoding="utf-8-sig")
print(f"\n저장: data/climate_normals.csv ({len(normals)}행 = 18시군 × 12월)")

# ── 요약: 계절 prior의 뼈대가 보이는지 ──
print("\n[월별 전체 시군 평균 — 계절 패턴]")
m = normals.groupby("month")[["tmax_avg", "tmin_avg", "precip_mm",
                              "heat33_days", "cold12_days", "rain30_days", "wind14_days"]].mean().round(1)
print(m.to_string())

print("\n[한파 취약 시군 TOP 5 — 1월 tmin]")
jan = normals[normals.month == 1].nsmallest(5, "tmin_avg")
print(jan[["sigungu", "tmin_avg", "cold12_days", "seat_elevation_m"]].to_string(index=False))

print("\n[호우 집중 시군 TOP 5 — 7~8월 rain30 일수 합]")
summer = normals[normals.month.isin([7, 8])].groupby("sigungu").rain30_days.sum().nlargest(5)
print(summer.round(1).to_string())
