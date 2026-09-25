"""
CDM-OS — Model Gateway: Cost Tracker

Tracks token usage and computes execution cost per call across agents and model providers.
Ensures zero-cost billing for Gemini Free Tier requests.
"""

from typing import Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from model_gateway.model_registry import ModelInfo


class CostRecord(BaseModel):
    """Execution cost record for a single LLM invocation."""

    agent_id: str
    model_id: str
    provider: str
    is_free_tier: bool
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_cost: float
    output_cost: float
    total_cost: float  # USD
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CostTracker:
    """Aggregates and records token usage costs."""

    def __init__(self):
        self._records: List[CostRecord] = []

    def calculate_and_record(
        self,
        agent_id: str,
        model_info: ModelInfo,
        input_tokens: int,
        output_tokens: int,
    ) -> CostRecord:
        """Calculates exact cost for input/output tokens and records it."""
        if model_info.is_free_tier:
            input_cost = 0.0
            output_cost = 0.0
            total_cost = 0.0
        else:
            input_cost = (input_tokens / 1000.0) * model_info.input_cost_per_1k
            output_cost = (output_tokens / 1000.0) * model_info.output_cost_per_1k
            total_cost = input_cost + output_cost

        record = CostRecord(
            agent_id=agent_id,
            model_id=model_info.model_id,
            provider=model_info.provider.value,
            is_free_tier=model_info.is_free_tier,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            input_cost=round(input_cost, 6),
            output_cost=round(output_cost, 6),
            total_cost=round(total_cost, 6),
        )

        self._records.append(record)
        return record

    def get_summary(self, agent_id: Optional[str] = None) -> Dict[str, float]:
        """Returns aggregate usage summary (total_tokens, total_cost, free_tier_calls)."""
        filtered = self._records
        if agent_id:
            filtered = [r for r in filtered if r.agent_id == agent_id]

        total_cost = sum(r.total_cost for r in filtered)
        total_tokens = sum(r.total_tokens for r in filtered)
        free_tier_calls = sum(1 for r in filtered if r.is_free_tier)
        paid_calls = len(filtered) - free_tier_calls

        return {
            "total_calls": len(filtered),
            "free_tier_calls": free_tier_calls,
            "paid_calls": paid_calls,
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 6),
        }

    def clear(self):
        """Clear cost records."""
        self._records.clear()
