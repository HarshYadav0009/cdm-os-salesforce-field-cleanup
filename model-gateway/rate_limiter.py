"""
CDM-OS — Model Gateway: Rate Limiter

Per-agent and per-model sliding window rate limiter supporting RPM (Requests Per Minute),
RPD (Requests Per Day), and TPM (Tokens Per Minute), tailored for free-tier constraints.
"""

import time
from typing import Dict, List, Tuple
from model_gateway.model_registry import ModelInfo


class RateLimitExceeded(Exception):
    """Raised when a request exceeds RPM, RPD, or TPM limits."""

    def __init__(self, message: str, model_id: str, limit_type: str, retry_after_sec: float = 60.0):
        super().__init__(message)
        self.model_id = model_id
        self.limit_type = limit_type
        self.retry_after_sec = retry_after_sec


class RateLimiter:
    """Sliding-window rate limiter for LLM provider requests."""

    def __init__(self):
        # Key: (agent_id, model_id) -> list of request timestamps (seconds)
        self._request_history: Dict[Tuple[str, str], List[float]] = {}
        # Key: (agent_id, model_id) -> list of (timestamp, token_count)
        self._token_history: Dict[Tuple[str, str], List[Tuple[float, int]]] = {}

    def check_and_record(self, agent_id: str, model_info: ModelInfo, estimated_tokens: int = 100):
        """
        Validates whether the request is within rate limits for model_info.
        If allowed, records the request timestamp and estimated token count.
        """
        now = time.time()
        key = (agent_id, model_info.model_id)

        if key not in self._request_history:
            self._request_history[key] = []
        if key not in self._token_history:
            self._token_history[key] = []

        # ── 1. Clean history older than 24 hours ──────────────
        one_day_ago = now - 86400
        self._request_history[key] = [t for t in self._request_history[key] if t > one_day_ago]

        one_min_ago = now - 60
        self._token_history[key] = [
            (t, count) for (t, count) in self._token_history[key] if t > one_min_ago
        ]

        reqs_in_last_day = len(self._request_history[key])
        reqs_in_last_min = len([t for t in self._request_history[key] if t > one_min_ago])

        # ── 2. Check Requests Per Day (RPD) ────────────────────
        if reqs_in_last_day >= model_info.rate_limit_rpd:
            raise RateLimitExceeded(
                f"Agent '{agent_id}' exceeded RPD limit ({model_info.rate_limit_rpd}) "
                f"for model '{model_info.model_id}'.",
                model_id=model_info.model_id,
                limit_type="RPD",
                retry_after_sec=3600.0,
            )

        # ── 3. Check Requests Per Minute (RPM) ──────────────────
        if reqs_in_last_min >= model_info.rate_limit_rpm:
            raise RateLimitExceeded(
                f"Agent '{agent_id}' exceeded RPM limit ({model_info.rate_limit_rpm}) "
                f"for model '{model_info.model_id}'.",
                model_id=model_info.model_id,
                limit_type="RPM",
                retry_after_sec=60.0 - (now - self._request_history[key][-1]),
            )

        # ── 4. Check Tokens Per Minute (TPM) ────────────────────
        tokens_in_last_min = sum(count for (_, count) in self._token_history[key])
        if tokens_in_last_min + estimated_tokens > model_info.rate_limit_tpm:
            raise RateLimitExceeded(
                f"Agent '{agent_id}' exceeded TPM limit ({model_info.rate_limit_tpm}) "
                f"for model '{model_info.model_id}'.",
                model_id=model_info.model_id,
                limit_type="TPM",
                retry_after_sec=30.0,
            )

        # Record usage
        self._request_history[key].append(now)
        self._token_history[key].append((now, estimated_tokens))

    def reset(self, agent_id: str = None, model_id: str = None):
        """Reset rate limit history (useful for testing or quota resets)."""
        if agent_id is None and model_id is None:
            self._request_history.clear()
            self._token_history.clear()
        else:
            keys_to_del = [
                k for k in self._request_history.keys()
                if (agent_id is None or k[0] == agent_id) and (model_id is None or k[1] == model_id)
            ]
            for k in keys_to_del:
                self._request_history.pop(k, None)
                self._token_history.pop(k, None)
