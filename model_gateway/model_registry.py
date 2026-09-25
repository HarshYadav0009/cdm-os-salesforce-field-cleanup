"""
CDM-OS — Model Gateway: Model Registry

Maintains model definitions, providers, cost structures, capabilities,
and free-tier quota limits (including Google Gemini Free Tier).
"""

from enum import Enum
from typing import Dict, Optional, List
from pydantic import BaseModel, Field


class ProviderType(str, Enum):
    GEMINI = "gemini"
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class TierType(str, Enum):
    FREE = "free"
    STANDARD = "standard"
    ENTERPRISE = "enterprise"


class ModelInfo(BaseModel):
    """Metadata and rate/cost rules for a registered LLM."""

    model_id: str = Field(..., description="Canonical ID e.g. gemini/gemini-1.5-flash")
    provider: ProviderType
    display_name: str
    tier: TierType = TierType.STANDARD
    is_free_tier: bool = False
    context_window: int = 128000
    max_output_tokens: int = 4096
    input_cost_per_1k: float = 0.0  # USD per 1,000 input tokens
    output_cost_per_1k: float = 0.0  # USD per 1,000 output tokens
    rate_limit_rpm: int = 60  # Requests per minute default
    rate_limit_rpd: int = 10000  # Requests per day default
    rate_limit_tpm: int = 100000  # Tokens per minute default
    supports_tools: bool = True
    supports_vision: bool = False


class ModelRegistry:
    """Registry cataloging available models across LLM providers."""

    def __init__(self):
        self._models: Dict[str, ModelInfo] = {}
        self._register_defaults()

    def _register_defaults(self):
        # ── Gemini Free Tier Models ──────────────────────────────
        self.register(
            ModelInfo(
                model_id="gemini/gemini-1.5-flash",
                provider=ProviderType.GEMINI,
                display_name="Google Gemini 1.5 Flash (Free Tier)",
                tier=TierType.FREE,
                is_free_tier=True,
                context_window=1000000,
                max_output_tokens=8192,
                input_cost_per_1k=0.0,
                output_cost_per_1k=0.0,
                rate_limit_rpm=15,
                rate_limit_rpd=1500,
                rate_limit_tpm=1000000,
                supports_tools=True,
                supports_vision=True,
            )
        )

        self.register(
            ModelInfo(
                model_id="gemini/gemini-2.0-flash",
                provider=ProviderType.GEMINI,
                display_name="Google Gemini 2.0 Flash (Free Tier)",
                tier=TierType.FREE,
                is_free_tier=True,
                context_window=1048576,
                max_output_tokens=8192,
                input_cost_per_1k=0.0,
                output_cost_per_1k=0.0,
                rate_limit_rpm=15,
                rate_limit_rpd=1500,
                rate_limit_tpm=4000000,
                supports_tools=True,
                supports_vision=True,
            )
        )

        self.register(
            ModelInfo(
                model_id="gemini/gemini-2.0-flash-lite",
                provider=ProviderType.GEMINI,
                display_name="Google Gemini 2.0 Flash-Lite (Free Tier)",
                tier=TierType.FREE,
                is_free_tier=True,
                context_window=1048576,
                max_output_tokens=8192,
                input_cost_per_1k=0.0,
                output_cost_per_1k=0.0,
                rate_limit_rpm=30,
                rate_limit_rpd=1500,
                rate_limit_tpm=4000000,
                supports_tools=True,
                supports_vision=True,
            )
        )

        self.register(
            ModelInfo(
                model_id="gemini/gemini-1.5-pro",
                provider=ProviderType.GEMINI,
                display_name="Google Gemini 1.5 Pro (Free Tier)",
                tier=TierType.FREE,
                is_free_tier=True,
                context_window=2000000,
                max_output_tokens=8192,
                input_cost_per_1k=0.0,
                output_cost_per_1k=0.0,
                rate_limit_rpm=2,
                rate_limit_rpd=50,
                rate_limit_tpm=32000,
                supports_tools=True,
                supports_vision=True,
            )
        )

        # ── Anthropic Models ─────────────────────────────────────
        self.register(
            ModelInfo(
                model_id="anthropic/claude-3-5-sonnet-20241022",
                provider=ProviderType.ANTHROPIC,
                display_name="Claude 3.5 Sonnet",
                tier=TierType.STANDARD,
                is_free_tier=False,
                context_window=200000,
                max_output_tokens=8192,
                input_cost_per_1k=0.003,
                output_cost_per_1k=0.015,
                rate_limit_rpm=50,
                rate_limit_rpd=5000,
                rate_limit_tpm=100000,
            )
        )

        self.register(
            ModelInfo(
                model_id="anthropic/claude-3-haiku-20240307",
                provider=ProviderType.ANTHROPIC,
                display_name="Claude 3 Haiku",
                tier=TierType.STANDARD,
                is_free_tier=False,
                context_window=200000,
                max_output_tokens=4096,
                input_cost_per_1k=0.00025,
                output_cost_per_1k=0.00125,
                rate_limit_rpm=100,
                rate_limit_rpd=10000,
                rate_limit_tpm=100000,
            )
        )

        # ── OpenAI Models ────────────────────────────────────────
        self.register(
            ModelInfo(
                model_id="openai/gpt-4o",
                provider=ProviderType.OPENAI,
                display_name="GPT-4o",
                tier=TierType.STANDARD,
                is_free_tier=False,
                context_window=128000,
                max_output_tokens=4096,
                input_cost_per_1k=0.005,
                output_cost_per_1k=0.015,
                rate_limit_rpm=500,
                rate_limit_rpd=10000,
                rate_limit_tpm=300000,
            )
        )

        self.register(
            ModelInfo(
                model_id="openai/gpt-4o-mini",
                provider=ProviderType.OPENAI,
                display_name="GPT-4o Mini",
                tier=TierType.STANDARD,
                is_free_tier=False,
                context_window=128000,
                max_output_tokens=4096,
                input_cost_per_1k=0.00015,
                output_cost_per_1k=0.0006,
                rate_limit_rpm=500,
                rate_limit_rpd=10000,
                rate_limit_tpm=200000,
            )
        )

    def register(self, model_info: ModelInfo):
        """Register or update a model specification."""
        self._models[model_info.model_id] = model_info

    def get(self, model_id: str) -> Optional[ModelInfo]:
        """Retrieve model metadata by canonical model ID."""
        if not ("/" in model_id):
            if "gemini" in model_id.lower():
                model_id = f"gemini/{model_id}"
            elif "claude" in model_id.lower():
                model_id = f"anthropic/{model_id}"
            elif "gpt" in model_id.lower():
                model_id = f"openai/{model_id}"

        return self._models.get(model_id)

    def list_models(
        self,
        provider: Optional[ProviderType] = None,
        free_tier_only: bool = False,
    ) -> List[ModelInfo]:
        """List models filtered by provider or free tier availability."""
        res = list(self._models.values())
        if provider:
            res = [m for m in res if m.provider == provider]
        if free_tier_only:
            res = [m for m in res if m.is_free_tier]
        return res


# Global singleton instance
default_registry = ModelRegistry()
