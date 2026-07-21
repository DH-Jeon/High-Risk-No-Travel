# 2022 실제 일별 기상 수집 (Open-Meteo ERA5 아카이브, 무료·키불필요)
# 기존 평년(1991-2020) 좌표를 그대로 재사용해 2022만 추가로 받는다.
# 사고 데이터(2022) 캘리브레이션의 설명변수(X) 원천.
import json, glob, os, time, urllib.request, urllib.parse

SRC = "data/climate_daily_raw"      # 좌표 출처(평년 캐시)
OUT = "data/climate_2022_raw"
os.makedirs(OUT, exist_ok=True)
DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"

sigungu = [os.path.splitext(os.path.basename(f))[0] for f in sorted(glob.glob(f"{SRC}/*.json"))]
print(f"대상 {len(sigungu)}개 시군")

for sg in sigungu:
    out = f"{OUT}/{sg}.json"
    if os.path.exists(out):
        print(f"  [skip] {sg}"); continue
    meta = json.load(open(f"{SRC}/{sg}.json", encoding="utf-8"))
    lat, lng = meta["latitude"], meta["longitude"]
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "start_date": "2022-01-01", "end_date": "2022-12-31",
        "daily": DAILY, "timezone": "Asia/Seoul",
    })
    url = f"https://archive-api.open-meteo.com/v1/archive?{q}"
    with urllib.request.urlopen(url, timeout=60) as r:
        d = json.load(r)
    json.dump(d, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    n = len(d["daily"]["time"])
    print(f"  [ok] {sg}: {n}일 ({d['daily']['time'][0]}~{d['daily']['time'][-1]})")
    time.sleep(0.5)  # 예의상 간격
print("완료")
