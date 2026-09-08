"""Phase 3 additions: multi-source cross-verification engine.

cross_verify(urls_json) reads several review pages live and reasons over all
of them under consensus, so a happy-path run is a `slow` test (real web.render
+ exec_prompt). The cheap tests below exercise input validation and the new
view methods, which need no LLM.
"""
import json

import pytest
from gltest.assertions import tx_execution_failed
from tests.conftest import parse, retry_call


# ── view invariants at zero state ────────────────────────────────────────────
def test_get_report_total_starts_at_zero(reviewguard):
    assert retry_call(lambda: reviewguard.get_report_total(args=[]).call()) == 0


def test_list_reports_starts_empty(reviewguard):
    result = retry_call(lambda: reviewguard.list_reports(args=[]).call())
    assert parse(result, fallback=None) == []


def test_get_report_missing_id_raises(reviewguard):
    with pytest.raises(Exception):
        retry_call(lambda: reviewguard.get_report(args=[7]).call())


# ── input validation (no nondet work reached) ────────────────────────────────
def test_cross_verify_rejects_single_source(reviewguard):
    """Fewer than MIN_SOURCES (2) valid URLs must fail before any fetch."""
    payload = json.dumps(["https://apps.apple.com/us/app/discord/id985746746"])
    receipt = retry_call(lambda: reviewguard.cross_verify(args=[payload]).transact())
    assert tx_execution_failed(receipt), "one source should be rejected"


def test_cross_verify_rejects_empty_list(reviewguard):
    receipt = retry_call(lambda: reviewguard.cross_verify(args=["[]"]).transact())
    assert tx_execution_failed(receipt)


def test_cross_verify_dedupes_below_minimum(reviewguard):
    """Two entries that are the same URL collapse to one -> below MIN_SOURCES."""
    payload = json.dumps(["https://example.com/x", "https://example.com/x"])
    receipt = retry_call(lambda: reviewguard.cross_verify(args=[payload]).transact())
    assert tx_execution_failed(receipt), "duplicates should not satisfy the 2-source minimum"


def test_cross_verify_rejects_too_many_sources(reviewguard):
    """More than MAX_SOURCES (5) URLs must fail."""
    urls = [f"https://example.com/{i}" for i in range(6)]
    receipt = retry_call(lambda: reviewguard.cross_verify(args=[json.dumps(urls)]).transact())
    assert tx_execution_failed(receipt)


@pytest.mark.parametrize(
    "bad",
    [
        ["https://ok.com/a", "ftp://nope.com/b"],
        ["https://ok.com/a", "notaurl"],
        ["https://ok.com/a", "https://bad.com/\npath"],
    ],
)
def test_cross_verify_rejects_bad_urls(reviewguard, bad):
    """Any invalid scheme / control char in ANY url fails the whole tx."""
    receipt = retry_call(lambda: reviewguard.cross_verify(args=[json.dumps(bad)]).transact())
    assert tx_execution_failed(receipt)


# ── happy path: real multi-source cross-verification (slow) ──────────────────
@pytest.mark.slow
def test_cross_verify_two_readable_sources(reviewguard):
    """Two renderable pages produce a stored report with the full schema.

    We use two Wikipedia pages (reliably renderable by headless Chromium). They
    are not review pages, so the expected overall verdict is UNRESOLVABLE, but
    the point of this test is the STRUCTURE: a report is stored, keyed, and
    carries the new per_source / consistency fields.
    """
    urls = [
        "https://en.wikipedia.org/wiki/Discord_(software)",
        "https://en.wikipedia.org/wiki/Slack_(software)",
    ]
    receipt = retry_call(
        lambda: reviewguard.cross_verify(args=[json.dumps(urls)]).transact(),
        tries=2, delay=5,
    )
    # tx should succeed (contract degrades gracefully, it does not revert)
    total = retry_call(lambda: reviewguard.get_report_total(args=[]).call())
    assert total >= 1

    report = parse(retry_call(lambda: reviewguard.get_report(args=[total - 1]).call()))
    assert report is not None
    assert report["verdict"] in ("TRUSTWORTHY", "MIXED", "SUSPICIOUS", "UNRESOLVABLE")
    assert report["consistency"] in ("CONSISTENT", "DIVERGENT", "INSUFFICIENT")
    assert 0 <= int(report["trust_score"]) <= 100
    assert isinstance(report["per_source"], list)
    assert int(report["requested_count"]) == 2
    assert isinstance(report["urls"], list) and len(report["urls"]) == 2
