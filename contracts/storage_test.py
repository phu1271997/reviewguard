# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

from dataclasses import dataclass


# ─────────────────────────────────────────────────────────────────────────────
# storage_test.py
# Deploy this FIRST on Studio (after Reset Storage + hard refresh) to confirm the
# environment works. It exercises the same storage primitives ReviewGuard uses:
#   - sized-int + str scalars
#   - a str-keyed TreeMap of an @allow_storage @dataclass struct
# without reassigning TreeMap/DynArray in __init__ (Rule 2).
# ─────────────────────────────────────────────────────────────────────────────
@allow_storage
@dataclass
class Row:
    n: bigint
    label: str


class Contract(gl.Contract):
    counter: u256
    name: str
    rows: TreeMap[str, Row]

    def __init__(self):
        self.counter = u256(0)
        self.name = "reviewguard-storage-test"

    @gl.public.write
    def bump(self) -> None:
        self.counter = u256(int(self.counter) + 1)

    @gl.public.write
    def put(self, key: str, n: int, label: str) -> None:
        self.rows[key] = Row(n=bigint(n), label=label)

    @gl.public.view
    def get_counter(self) -> int:
        return int(self.counter)

    @gl.public.view
    def get_name(self) -> str:
        return self.name

    @gl.public.view
    def get_row(self, key: str) -> str:
        if key not in self.rows:
            return "{}"
        r = self.rows[key]
        import json
        return json.dumps({"n": int(r.n), "label": r.label})
