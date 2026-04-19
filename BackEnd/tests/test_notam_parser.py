from app.services.notam_parser import NotamParser


def test_parse_qline_circle_to_feature() -> None:
    parser = NotamParser()
    raw = (
        "A1234/26 NOTAMN\n"
        "Q) LTBB/QWULW/IV/NBO/W/000/050/4116N02844E005\n"
        "A) LTBB B) 2604101000 C) 2604101400\n"
        "E) DRONE OPS PROHIBITED."
    )
    feature = parser.parse_to_feature({"traditionalMessage": raw, "notamNumber": "A1234/26"})
    assert feature is not None
    assert feature["zone_code"] == "A1234/26"
    assert feature["geometry"]["type"] == "Polygon"
    assert len(feature["geometry"]["coordinates"][0]) >= 4


def test_parse_polygon_pairs_from_text() -> None:
    parser = NotamParser()
    raw = (
        "A9999/26 NOTAMN\n"
        "Q) LTBB/QXXXX/IV/NBO/W/000/999/0000N00000E005\n"
        "E) AREA BOUNDED BY 410500N0284500E 410600N0284600E 410400N0284700E"
    )
    feature = parser.parse_to_feature({"traditionalMessage": raw, "notamNumber": "A9999/26"})
    assert feature is not None
    assert feature["geometry"]["type"] == "Polygon"
    assert len(feature["geometry"]["coordinates"][0]) >= 4


def test_parse_returns_none_for_non_spatial_notam() -> None:
    parser = NotamParser()
    raw = "A0001/26 NOTAMN\nE) AIRPORT INFO MESSAGE ONLY."
    feature = parser.parse_to_feature({"traditionalMessage": raw})
    assert feature is None


def test_parse_ignores_generic_xx_qcode_notam() -> None:
    parser = NotamParser()
    raw = (
        "G2211/01 NOTAMN\n"
        "Q) LTXX/QXXXX/IV/BO/E/000/999/3918N03521E567\n"
        "A) LTAA LTBB B) 0109251345 C) PERM\n"
        "E) ADMINISTRATIVE INFORMATION MESSAGE."
    )
    feature = parser.parse_to_feature({"icaoMessage": raw, "notamNumber": "G2211/01"})
    assert feature is None


def test_parse_ignores_too_large_radius_notam() -> None:
    parser = NotamParser()
    raw = (
        "X0001/26 NOTAMN\n"
        "Q) LTBB/QWULW/IV/NBO/W/000/999/3918N03521E567\n"
        "E) DRONE OPS PROHIBITED."
    )
    feature = parser.parse_to_feature({"icaoMessage": raw, "notamNumber": "X0001/26"})
    assert feature is None


def test_parse_caps_render_radius_for_medium_qline_notam() -> None:
    parser = NotamParser()
    raw = (
        "A2222/26 NOTAMN\n"
        "Q) LTBB/QWULW/IV/NBO/W/000/050/4116N02844E050\n"
        "E) DRONE OPS PROHIBITED."
    )
    feature = parser.parse_to_feature({"icaoMessage": raw, "notamNumber": "A2222/26"})
    assert feature is not None
    assert feature["raw_radius_nm"] == 50.0
    assert feature["render_radius_nm"] == 1.2
