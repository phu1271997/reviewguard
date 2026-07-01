# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

import json
import typing
from dataclasses import dataclass


# ═════════════════════════════════════════════════════════════════════════════
# ReviewGuard.py
#
# An on-chain "fake-review detector". A user submits the URL of a review page
# (a Google Maps place, an Amazon/marketplace product page, a Yelp listing…).
# The contract READS THAT PAGE LIVE on-chain (gl.nondet.web.render) and REASONS
# with an LLM (gl.nondet.exec_prompt) to judge how trustworthy the reviews look:
# bot-like language, generic copy-paste praise, suspicious bursts, incentivized
# wording, rating/text mismatch. It returns a verdict + a 0-100 trust score plus
# concrete red flags, and stores the analysis on-chain.
#
# WHY GENLAYER IS THE HEART (removal test passes):
#   The whole product is "an on-chain agent that reads a review page and judges
#   whether the reviews are authentic." A normal smart contract cannot fetch a
#   web page or reason about writing style. Remove the web-read + LLM and there
#   is nothing left. No money changes hands — the judgement itself is the product.
#
# CONSENSUS CHECKS MEANING, NOT SHAPE (Axis 2):
#   The non-deterministic analysis is wrapped in
#   gl.eq_principle.prompt_comparative(...). Validators do NOT require byte-equal
#   JSON. They use NLP to check the leader's and their own analysis reach the
#   SAME verdict and a close trust score. Two validators disagreeing on the
#   verdict cannot both pass.
# ═════════════════════════════════════════════════════════════════════════════


# Verdict vocabulary
VERDICT_TRUSTWORTHY = "TRUSTWORTHY"     # reviews look genuine
VERDICT_MIXED = "MIXED"                 # some signal of manipulation
VERDICT_SUSPICIOUS = "SUSPICIOUS"       # strong signs of fake/incentivized reviews
VERDICT_UNRESOLVABLE = "UNRESOLVABLE"   # page unreadable / not a review page

# The equivalence principle: what validators must agree on (meaning, not bytes).
CREDIBILITY_PRINCIPLE = (
    "Both analyses must reach the same verdict label "
    "(one of TRUSTWORTHY, MIXED, SUSPICIOUS, UNRESOLVABLE) for the same review "
    "page. Their trust_score values should be close (within about 20 points). "
    "The specific wording of the red flags and summary may differ, as long as "
    "the overall judgement of authenticity is the same."
)


@allow_storage
@dataclass
class Analysis:
    # Custom storage structs MUST be @allow_storage @dataclass (R18).
    # Every persisted integer is bigint, NOT u256/int (R14).
    analysis_id: bigint
    url: str
    requester: Address
    verdict: str
    trust_score: bigint          # 0..100, higher = more trustworthy
    red_flags: str               # newline-joined bullet points
    summary: str                 # one-paragraph human summary
    created: bool                # whether analysis has been produced


class Contract(gl.Contract):
    owner: Address
    next_id: bigint
    # TreeMap keys MUST be str (R19). We key analyses by str(analysis_id).
    analyses: TreeMap[str, Analysis]
    # cache: url -> analysis_id (str), so repeat lookups are cheap and free
    url_index: TreeMap[str, bigint]

    def __init__(self):
        # Scalars only; never touch TreeMap fields in __init__ (Rule 2).
        self.owner = gl.message.sender_address
        self.next_id = bigint(0)

    # ─────────────────────────────────────────────────────────────────────────
    # WRITE: analyze a review page. This is the core nondet method.
    #
    # It reads the page live + asks the LLM to grade authenticity, wrapped in
    # eq_principle.prompt_comparative so validators agree on MEANING. The result
    # is stored and can be read back with get_analysis / list_analyses.
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.write
    def analyze(self, url: str) -> int:
        if not (url.startswith("https://") or url.startswith("http://")):
            raise Exception("ReviewGuard: url must start with http:// or https://")

        # Copy the value we need into a local; nondet blocks cannot touch self.
        target_url = url

        # The nondet block: read the page + judge. Returns a JSON string so the
        # comparative equivalence principle can NLP-compare leader vs validator.
        def analyze_block() -> str:
            page = _safe_render(target_url)
            if page is None:
                return json.dumps({
                    "verdict": VERDICT_UNRESOLVABLE,
                    "trust_score": 0,
                    "red_flags": ["The page could not be loaded or is empty."],
                    "summary": "The review page was unreachable, so authenticity "
                               "could not be assessed.",
                })
            prompt = _build_prompt(target_url, page)
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            return _normalize(raw)

        # Validators compare MEANING, not bytes (Axis 2).
        result_json = gl.eq_principle.prompt_comparative(analyze_block, CREDIBILITY_PRINCIPLE)

        data = _coerce(result_json)
        if data is None:
            data = {
                "verdict": VERDICT_UNRESOLVABLE,
                "trust_score": 0,
                "red_flags": ["Analysis output could not be parsed."],
                "summary": "The analysis could not be completed.",
            }

        verdict = _clean_verdict(data.get("verdict"))
        score = _clamp_score(data.get("trust_score", 0))
        flags = data.get("red_flags", [])
        if isinstance(flags, list):
            red_flags = "\n".join([str(f) for f in flags])[:2000]
        else:
            red_flags = str(flags)[:2000]
        summary = str(data.get("summary", ""))[:2000]

        aid = int(self.next_id)
        record = Analysis(
            analysis_id=bigint(aid),
            url=target_url,
            requester=gl.message.sender_address,
            verdict=verdict,
            trust_score=bigint(score),
            red_flags=red_flags,
            summary=summary,
            created=True,
        )
        self.analyses[str(aid)] = record
        self.url_index[target_url] = bigint(aid)
        self.next_id = bigint(aid + 1)
        return aid

    # ─────────────────────────────────────────────────────────────────────────
    # VIEWS (read-only) — for the frontend
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.view
    def get_analysis(self, analysis_id: int) -> str:
        key = str(analysis_id)
        if key not in self.analyses:
            raise Exception("ReviewGuard: analysis does not exist")
        return json.dumps(_to_dict(self.analyses[key]))

    @gl.public.view
    def get_total(self) -> int:
        return int(self.next_id)

    @gl.public.view
    def list_analyses(self) -> str:
        out = []
        i = 0
        total = int(self.next_id)
        while i < total:
            key = str(i)
            if key in self.analyses:
                out.append(_to_dict(self.analyses[key]))
            i += 1
        return json.dumps(out)

    @gl.public.view
    def find_by_url(self, url: str) -> str:
        # Returns the cached analysis for a URL, or an empty object if none.
        if url not in self.url_index:
            return json.dumps({})
        aid = int(self.url_index[url])
        key = str(aid)
        if key not in self.analyses:
            return json.dumps({})
        return json.dumps(_to_dict(self.analyses[key]))


# ═════════════════════════════════════════════════════════════════════════════
# Module-level helpers (kept out of the class; nondet blocks cannot touch self)
# ═════════════════════════════════════════════════════════════════════════════
def _safe_render(url: str) -> typing.Optional[str]:
    """Render a page to text; return None on any failure (dead/empty page)."""
    try:
        text = gl.nondet.web.render(url, mode="text")
        if text is None:
            return None
        s = str(text).strip()
        if len(s) == 0:
            return None
        return s
    except Exception:
        return None


def _build_prompt(url: str, page_text: str) -> str:
    page_text = page_text[:9000]  # keep prompt bounded
    return (
        "You are an expert at detecting fake, incentivized, or manipulated "
        "online reviews. You are given the text of a review page. Judge how "
        "trustworthy the reviews on this page appear.\n\n"
        f"PAGE URL: {url}\n\n"
        "=== PAGE TEXT ===\n"
        f"{page_text}\n\n"
        "Look for signals such as:\n"
        "- Repetitive or templated wording across many reviews\n"
        "- Generic praise with no concrete detail\n"
        "- Bursts of very similar reviews in a short time\n"
        "- Overuse of superlatives or marketing language\n"
        "- Mismatch between star ratings and the actual text\n"
        "- Reviewers with no history or obviously incentivized language\n\n"
        "Then decide a single verdict:\n"
        "- TRUSTWORTHY: reviews look genuine and varied\n"
        "- MIXED: some manipulation signals but not dominant\n"
        "- SUSPICIOUS: strong signs of fake or incentivized reviews\n"
        "- UNRESOLVABLE: the page is not a review page or lacks reviews to judge\n\n"
        "Return ONLY a JSON object, no markdown, no text outside JSON:\n"
        '{"verdict": "TRUSTWORTHY|MIXED|SUSPICIOUS|UNRESOLVABLE", '
        '"trust_score": <integer 0-100, higher = more trustworthy>, '
        '"red_flags": ["<short concrete flag>", "..."], '
        '"summary": "<one short paragraph explaining the judgement>"}'
    )


def _normalize(raw: typing.Any) -> str:
    """Coerce an LLM response to a clean, canonical JSON string."""
    data = _coerce(raw)
    if data is None:
        data = {
            "verdict": VERDICT_UNRESOLVABLE,
            "trust_score": 0,
            "red_flags": ["The model returned malformed output."],
            "summary": "Analysis could not be produced.",
        }
    clean = {
        "verdict": _clean_verdict(data.get("verdict")),
        "trust_score": _clamp_score(data.get("trust_score", 0)),
        "red_flags": data.get("red_flags", []),
        "summary": str(data.get("summary", ""))[:2000],
    }
    return json.dumps(clean, sort_keys=True)


def _coerce(raw: typing.Any) -> typing.Optional[dict]:
    """Accept dict / JSON string / bytes; return a dict or None."""
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8", "ignore")
        except Exception:
            return None
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith("```"):
            s = s.strip("`")
            if s.startswith("json"):
                s = s[4:]
        s = s.strip()
        try:
            obj = json.loads(s)
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _clean_verdict(v: typing.Any) -> str:
    s = str(v).upper().strip()
    if s in (VERDICT_TRUSTWORTHY, VERDICT_MIXED, VERDICT_SUSPICIOUS, VERDICT_UNRESOLVABLE):
        return s
    return VERDICT_UNRESOLVABLE


def _clamp_score(value: typing.Any) -> int:
    try:
        v = int(value)
    except Exception:
        return 0
    if v < 0:
        return 0
    if v > 100:
        return 100
    return v


def _addr_str(addr: Address) -> str:
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


def _to_dict(a: Analysis) -> dict:
    return {
        "analysis_id": int(a.analysis_id),
        "url": a.url,
        "requester": _addr_str(a.requester),
        "verdict": a.verdict,
        "trust_score": int(a.trust_score),
        "red_flags": a.red_flags.split("\n") if a.red_flags else [],
        "summary": a.summary,
        "created": bool(a.created),
    }
