"""Cheap tests that hit only view methods — no consensus wait per call."""
from tests.conftest import parse


def test_deploy_produces_zero_state(reviewguard):
    """Fresh contract: get_total is 0, list_analyses is [], find_by_url returns {}."""
    total = reviewguard.get_total(args=[]).call()
    assert total == 0

    listed = parse(reviewguard.list_analyses(args=[]).call(), fallback=None)
    assert listed == []

    found = parse(
        reviewguard.find_by_url(args=["https://apps.apple.com/us/app/discord/id985746746"]).call(),
        fallback=None,
    )
    assert found == {}


def test_get_analysis_missing_id_raises(reviewguard):
    """get_analysis(nonexistent) should surface an error rather than a stub record."""
    import pytest
    with pytest.raises(Exception):
        reviewguard.get_analysis(args=[999]).call()


def test_url_index_starts_empty(reviewguard):
    """No URL should be cached in a fresh contract."""
    for url in [
        "https://apps.apple.com/us/app/discord/id985746746",
        "https://en.wikipedia.org/wiki/Wikipedia",
        "http://localhost/",
    ]:
        found = parse(reviewguard.find_by_url(args=[url]).call(), fallback=None)
        assert found == {}
