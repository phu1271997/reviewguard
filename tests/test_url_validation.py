"""URL validation is checked BEFORE the nondet block.

The contract raises inside `analyze()` when the URL doesn't start with
http:// or https://. gltest surfaces that as a receipt whose execution
failed (rather than a Python exception), so we check with
`tx_execution_failed`.
"""
import pytest
from gltest.assertions import tx_execution_failed
from tests.conftest import retry_call


@pytest.mark.parametrize(
    "bad_url",
    [
        "not-a-url",
        "ftp://example.com/reviews",
        "www.example.com/reviews",   # missing scheme
        "javascript:alert(1)",
        "",
    ],
)
def test_analyze_rejects_bad_urls(reviewguard, bad_url):
    """The tx must land as a FAILED execution, and get_total must not advance."""
    total_before = retry_call(lambda: reviewguard.get_total(args=[]).call())
    receipt = retry_call(lambda: reviewguard.analyze(args=[bad_url]).transact())
    assert tx_execution_failed(receipt), f"analyze({bad_url!r}) should have failed"
    total_after = retry_call(lambda: reviewguard.get_total(args=[]).call())
    assert total_after == total_before, "failed analyze must not create an Analysis record"
