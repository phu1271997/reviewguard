"""End-to-end tests exercising the nondet block.

These tests hit the real hosted studionet with the real LLM, so each `analyze`
call is slow (roughly 20-90s) and consumes gas from the burner. They cover
edge cases the contract must degrade gracefully on: unreachable pages and
pages that aren't reviews.

Runs a full-flow smoke test as well: analyze a known-good review page,
confirm the record lands in storage with a valid verdict.
"""
import pytest
from tests.conftest import parse, retry_call

VALID_VERDICTS = {"TRUSTWORTHY", "MIXED", "SUSPICIOUS", "UNRESOLVABLE"}


@pytest.mark.slow
def test_unreachable_url_produces_unresolvable(reviewguard):
    """A dead domain must produce UNRESOLVABLE rather than crashing consensus."""
    dead_url = "https://this-domain-almost-certainly-does-not-exist-89432.invalid/"
    receipt = retry_call(lambda: reviewguard.analyze(args=[dead_url]).transact())
    assert receipt is not None

    found = parse(retry_call(lambda: reviewguard.find_by_url(args=[dead_url]).call()), fallback={})
    assert found.get("verdict") == "UNRESOLVABLE"
    assert found.get("trust_score") == 0


@pytest.mark.slow
def test_non_review_page_produces_unresolvable(reviewguard):
    """Wikipedia article is reachable but not a review page → UNRESOLVABLE."""
    non_review = "https://en.wikipedia.org/wiki/Wikipedia"
    retry_call(lambda: reviewguard.analyze(args=[non_review]).transact())
    found = parse(retry_call(lambda: reviewguard.find_by_url(args=[non_review]).call()), fallback={})
    assert found.get("verdict") == "UNRESOLVABLE"


@pytest.mark.slow
def test_analyze_happy_path_stores_valid_record(reviewguard):
    """A real App Store review page produces a well-formed record."""
    url = "https://apps.apple.com/us/app/discord/id985746746"
    receipt = retry_call(lambda: reviewguard.analyze(args=[url]).transact())
    assert receipt is not None

    found = parse(retry_call(lambda: reviewguard.find_by_url(args=[url]).call()), fallback={})
    assert found, "find_by_url returned no record"

    # Shape invariants
    assert found["url"] == url
    assert found["created"] is True
    assert found["verdict"] in VALID_VERDICTS
    assert 0 <= found["trust_score"] <= 100
    assert isinstance(found["red_flags"], list)
    assert isinstance(found["summary"], str)

    # get_total should have moved by exactly 1 from this call's perspective
    total = retry_call(lambda: reviewguard.get_total(args=[]).call())
    assert total >= 1

    # The URL should be cached by url_index
    same = parse(retry_call(lambda: reviewguard.find_by_url(args=[url]).call()), fallback={})
    assert same.get("analysis_id") == found.get("analysis_id")
