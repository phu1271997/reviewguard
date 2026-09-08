"""Phase 4 additions: on-chain reputation registry + trust leaderboard.

The registry is populated as a side effect of analyze() / cross_verify(), both
of which run nondet blocks, so end-to-end population is covered by the `slow`
test. The cheap tests exercise the new view methods and their zero-state
invariants, which need no LLM.
"""
import pytest

from tests.conftest import parse, retry_call


def test_get_domain_total_starts_at_zero(reviewguard):
    assert retry_call(lambda: reviewguard.get_domain_total(args=[]).call()) == 0


def test_list_domains_starts_empty(reviewguard):
    result = retry_call(lambda: reviewguard.list_domains(args=[]).call())
    assert parse(result, fallback=None) == []


def test_get_domain_unknown_returns_empty_object(reviewguard):
    """Unknown domain -> '{}' (not an error), mirroring find_by_url."""
    result = retry_call(lambda: reviewguard.get_domain(args=["nope.example"]).call())
    assert parse(result, fallback=None) == {}


def test_get_domain_normalizes_input(reviewguard):
    """get_domain applies the same host normalization as writes, so a full URL
    or a www-prefixed host resolves to the same (still-empty) record here."""
    for probe in [
        "https://www.apps.apple.com/us/app/x",
        "apps.apple.com",
        "HTTP://Apps.Apple.com:443/",
    ]:
        result = retry_call(lambda p=probe: reviewguard.get_domain(args=[p]).call())
        assert parse(result, fallback=None) == {}


@pytest.mark.slow
def test_registry_populates_from_analyze(reviewguard):
    """A single analyze() must create a DomainRep for its host with the full
    derived shape (tier, avg, distribution)."""
    url = "https://apps.apple.com/us/app/discord/id985746746"
    retry_call(lambda: reviewguard.analyze(args=[url]).transact(), tries=2, delay=5)

    total = retry_call(lambda: reviewguard.get_domain_total(args=[]).call())
    assert total >= 1

    rec = parse(retry_call(lambda: reviewguard.get_domain(args=["apps.apple.com"]).call()))
    assert rec and rec.get("domain") == "apps.apple.com"
    assert rec["total_checks"] >= 1
    assert rec["tier"] in ("TRUSTED", "MIXED", "WATCH", "FLAGGED", "UNRATED")
    assert rec["last_verdict"] in ("TRUSTWORTHY", "MIXED", "SUSPICIOUS", "UNRESOLVABLE")

    listing = parse(retry_call(lambda: reviewguard.list_domains(args=[]).call()))
    assert isinstance(listing, list) and any(d["domain"] == "apps.apple.com" for d in listing)
