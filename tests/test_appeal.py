"""Phase 2 additions: appeal / dispute flow.

file_appeal is a payable write that runs another nondet block (adversarial
re-analysis), so the actual re-analysis is a `slow` test. The cheap tests
below only exercise the input validation and view methods.
"""
import pytest
from gltest.assertions import tx_execution_failed
from tests.conftest import parse, retry_call


def test_get_appeal_total_starts_at_zero(reviewguard):
    assert retry_call(lambda: reviewguard.get_appeal_total(args=[]).call()) == 0


def test_list_appeals_starts_empty(reviewguard):
    result = retry_call(lambda: reviewguard.list_appeals(args=[]).call())
    assert parse(result, fallback=None) == []


def test_appeals_for_missing_analysis_returns_empty(reviewguard):
    result = retry_call(lambda: reviewguard.appeals_for(args=[999]).call())
    assert parse(result, fallback=None) == []


def test_get_appeal_missing_id_raises(reviewguard):
    with pytest.raises(Exception):
        retry_call(lambda: reviewguard.get_appeal(args=[42]).call())


def test_file_appeal_rejects_missing_analysis(reviewguard):
    """Appealing an analysis that doesn't exist must fail at the guard."""
    receipt = retry_call(lambda: reviewguard.file_appeal(
        args=[9999, "This analysis should not exist, so the appeal must fail."]
    ).transact(value=1))
    assert tx_execution_failed(receipt), "appeal on nonexistent analysis should fail"


@pytest.mark.parametrize("bad_reason", ["", "short", "x" * 9])
def test_file_appeal_rejects_short_reason(reviewguard, bad_reason):
    """Reason must be at least MIN_REASON_LEN chars."""
    receipt = retry_call(lambda: reviewguard.file_appeal(
        args=[0, bad_reason]
    ).transact(value=1))
    assert tx_execution_failed(receipt)


def test_file_appeal_rejects_reason_over_cap(reviewguard):
    """Reason must be at most MAX_REASON_LEN (2000) chars."""
    long_reason = "x" * 2100
    receipt = retry_call(lambda: reviewguard.file_appeal(
        args=[0, long_reason]
    ).transact(value=1))
    assert tx_execution_failed(receipt)


@pytest.mark.parametrize(
    "sneaky",
    [
        "This reason contains a \x00 null byte and should be rejected.",
        "This reason contains a carriage \r return and should be rejected.",
    ],
)
def test_file_appeal_rejects_control_chars_in_reason(reviewguard, sneaky):
    """Control chars in reason are a prompt-injection vector — must be rejected."""
    receipt = retry_call(lambda: reviewguard.file_appeal(args=[0, sneaky]).transact(value=1))
    assert tx_execution_failed(receipt)


def test_file_appeal_rejects_zero_stake(reviewguard):
    """MIN_APPEAL_STAKE = 1 wei — a zero-stake appeal must fail."""
    receipt = retry_call(lambda: reviewguard.file_appeal(
        args=[0, "A well-formed reason of sufficient length that would otherwise pass."]
    ).transact(value=0))
    assert tx_execution_failed(receipt)
