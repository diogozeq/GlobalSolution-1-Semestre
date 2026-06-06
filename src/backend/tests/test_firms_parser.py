from app.ingestion.firms import parse_firms_csv

CSV = """latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
-3.1234,-57.5678,345.2,0.5,0.4,2026-06-06,1722,N,VIIRS,h,2.0NRT,320.1,45.6,D
-7.0001,-55.4002,338.0,0.5,0.4,2026-06-05,0402,1,VIIRS,80,2.0NRT,315.0,30.2,N
-9.5000,-40.5000,310.0,0.5,0.4,2026-06-02,1710,N,VIIRS,l,2.0NRT,300.0,12.0,D
"""


def test_parse_count_and_fields():
    foci = parse_firms_csv(CSV)
    assert len(foci) == 3
    first = foci[0]
    assert first["lat"] == -3.1234
    assert first["lon"] == -57.5678
    assert first["brightness"] == 345.2
    assert first["source"] == "FIRMS"


def test_confidence_letter_normalization():
    foci = parse_firms_csv(CSV)
    # 'h' -> 90, numeric 80 stays, 'l' -> 25
    assert foci[0]["confidence"] == 90.0
    assert foci[1]["confidence"] == 80.0
    assert foci[2]["confidence"] == 25.0


def test_acq_datetime_parsed():
    foci = parse_firms_csv(CSV)
    dt = foci[0]["acq_datetime"]
    assert dt.year == 2026 and dt.month == 6 and dt.day == 6
    assert dt.hour == 17 and dt.minute == 22


def test_skips_invalid_rows():
    bad = "latitude,longitude,acq_date,acq_time\n,,2026-06-06,1200\n-1.0,-50.0,2026-06-06,1200\n"
    foci = parse_firms_csv(bad)
    assert len(foci) == 1
