"""
CDM-OS — Model Gateway Package

Hot-swappable AI provider routing layer with native support for Anthropic, OpenAI,
and Gemini Free tier models.
"""

from model_gateway.gateway import ModelGateway
from model_gateway.model_registry import ModelRegistry, ModelInfo, ProviderType, TierType
from model_gateway.rate_limiter import RateLimiter, RateLimitExceeded
from model_gateway.cost_tracker import CostTracker, CostRecord
from model_gateway.gemini_provider import GeminiFreeProvider

__all__ = [
    "ModelGateway",
    "ModelRegistry",
    "ModelInfo",
    "ProviderType",
    "TierType",
    "RateLimiter",
    "RateLimitExceeded",
    "CostTracker",
    "CostRecord",
    "GeminiFreeProvider",
]
