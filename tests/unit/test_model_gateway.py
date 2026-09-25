"""
CDM-OS — Unit Tests for Model Gateway & Gemini Free Support
"""

import pytest
from model_gateway.model_registry import ModelRegistry, ProviderType, TierType
from model_gateway.rate_limiter import RateLimiter, RateLimitExceeded
from model_gateway.cost_tracker import CostTracker
from model_gateway.gemini_provider import GeminiFreeProvider
from model_gateway.gateway import ModelGateway


def test_gemini_free_models_registered():
    """Verify Gemini Free tier models are correctly registered in ModelRegistry."""
    registry = ModelRegistry()

    flash_15 = registry.get("gemini/gemini-1.5-flash")
    assert flash_15 is not None
    assert flash_15.provider == ProviderType.GEMINI
    assert flash_15.is_free_tier is True
    assert flash_15.tier == TierType.FREE
    assert flash_15.input_cost_per_1k == 0.0
    assert flash_15.output_cost_per_1k == 0.0
    assert flash_15.rate_limit_rpm == 15

    flash_20 = registry.get("gemini/gemini-2.0-flash")
    assert flash_20 is not None
    assert flash_20.is_free_tier is True
    assert flash_20.input_cost_per_1k == 0.0

    pro_15 = registry.get("gemini/gemini-1.5-pro")
    assert pro_15 is not None
    assert pro_15.is_free_tier is True

    free_models = registry.list_models(free_tier_only=True)
    assert len(free_models) >= 4


def test_cost_tracker_zero_billing_for_gemini_free():
    """Verify CostTracker records zero cost for Gemini Free tier invocations."""
    registry = ModelRegistry()
    tracker = CostTracker()

    gemini_info = registry.get("gemini/gemini-1.5-flash")
    paid_info = registry.get("anthropic/claude-3-5-sonnet-20241022")

    rec_free = tracker.calculate_and_record(
        agent_id="test_agent",
        model_info=gemini_info,
        input_tokens=5000,
        output_tokens=1000,
    )

    assert rec_free.total_cost == 0.0
    assert rec_free.is_free_tier is True

    rec_paid = tracker.calculate_and_record(
        agent_id="test_agent",
        model_info=paid_info,
        input_tokens=1000,
        output_tokens=1000,
    )

    assert rec_paid.total_cost > 0.0
    assert rec_paid.is_free_tier is False

    summary = tracker.get_summary(agent_id="test_agent")
    assert summary["free_tier_calls"] == 1
    assert summary["paid_calls"] == 1
    assert summary["total_cost_usd"] == rec_paid.total_cost


def test_rate_limiter_gemini_rpm():
    """Verify rate limiter enforces Requests Per Minute limit for Gemini Free models."""
    registry = ModelRegistry()
    limiter = RateLimiter()
    gemini_info = registry.get("gemini/gemini-1.5-flash")

    # RPM is 15 for gemini-1.5-flash
    for i in range(15):
        limiter.check_and_record("agent_test", gemini_info, estimated_tokens=10)

    # 16th request should fail
    with pytest.raises(RateLimitExceeded) as exc_info:
        limiter.check_and_record("agent_test", gemini_info, estimated_tokens=10)

    assert exc_info.value.limit_type == "RPM"
    assert exc_info.value.model_id == "gemini/gemini-1.5-flash"


@pytest.mark.asyncio
async def test_model_gateway_gemini_execution():
    """Verify ModelGateway executes Gemini prompt successfully."""
    gateway = ModelGateway()
    result = await gateway.execute_prompt(
        agent_id="agent_sf_cleanup",
        primary_model="gemini/gemini-1.5-flash",
        prompt="Analyze Salesforce Account custom fields",
    )

    assert result["status"] == "success"
    assert result["provider"] == "gemini"
    assert result["is_free_tier"] is True
    assert result["cost_record"]["total_cost"] == 0.0


@pytest.mark.asyncio
async def test_model_gateway_fallback_trigger():
    """Verify ModelGateway triggers fallback model when primary hits rate limits."""
    registry = ModelRegistry()
    limiter = RateLimiter()
    cost_tracker = CostTracker()
    gateway = ModelGateway(registry=registry, rate_limiter=limiter, cost_tracker=cost_tracker)

    gemini_info = registry.get("gemini/gemini-1.5-flash")

    # Exhaust Gemini free tier RPM
    for _ in range(15):
        limiter.check_and_record("agent_fallback_test", gemini_info, estimated_tokens=10)

    # Execute prompt with Gemini primary & Anthropic fallback
    res = await gateway.execute_prompt(
        agent_id="agent_fallback_test",
        primary_model="gemini/gemini-1.5-flash",
        fallback_model="anthropic/claude-3-5-sonnet-20241022",
        prompt="Deprecate unused status fields",
    )

    assert res["status"] == "success"
    assert res.get("fallback_used") is True
    assert "RPM" in res.get("original_error", "")
