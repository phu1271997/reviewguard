"""Shared fixtures: deploy ReviewGuard once per session (studionet writes are slow)."""
import json
import time

import pytest
from gltest import get_contract_factory


@pytest.fixture(scope="session")
def reviewguard():
    """Deploy a fresh ReviewGuard contract once, reuse across the whole test run.

    Studio RPC occasionally drops the connection during a slow request; retry
    the deploy a couple of times before giving up.
    """
    last_err = None
    for attempt in range(3):
        try:
            factory = get_contract_factory(contract_file_path="ReviewGuard.py")
            return factory.deploy(args=[])
        except Exception as e:
            last_err = e
            time.sleep(4 * (attempt + 1))
    raise last_err


def retry_call(fn, tries=3, delay=3):
    """Retry a flaky RPC call (Studio occasionally returns RemoteDisconnected)."""
    last = None
    for i in range(tries):
        try:
            return fn()
        except Exception as e:
            last = e
            time.sleep(delay * (i + 1))
    raise last


def parse(value, fallback=None):
    """Contract views return JSON strings — decode once here."""
    if value is None:
        return fallback
    if isinstance(value, (dict, list, int, float, bool)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback
