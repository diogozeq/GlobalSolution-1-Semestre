from app.ingestion.inpe import parse_inpe_csv


CSV = """id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,risco_fogo,frp
abc,-11.549900,-52.786700,2026-06-06 22:00:00,GOES-19,SAO FELIX DO ARAGUAIA,MATO GROSSO,Brasil,0.68,43.9
bad,,,,,,,,,
"""


def test_parse_inpe_official_daily_csv():
    foci = parse_inpe_csv(CSV)
    assert len(foci) == 1
    assert foci[0]["source"] == "INPE"
    assert foci[0]["lat"] == -11.5499
    assert foci[0]["lon"] == -52.7867
    assert foci[0]["satellite"] == "GOES-19"
    assert foci[0]["confidence"] == 68
    assert foci[0]["frp"] == 43.9
