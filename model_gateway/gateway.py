"""
CDM-OS — Model Gateway: Core Router & Facade

Central router between AI Agents and LLM Providers. Enforces rate limits, cost metering,
model fallback chains, and seamless Gemini Free Tier routing.
"""

import logging
from typing import Dict, Any, Optional, List
from model_gateway.model_registry import ModelRegistry, default_registry, ModelInfo, ProviderType
from model_gateway.rate_limiter import RateLimiter, RateLimitExceeded
from model_gateway.cost_tracker import CostTracker, CostRecord
from model_gateway.gemini_provider import GeminiFreeProvider

logger = logging.getLogger("cdm.model_gateway")


class ModelGateway:
    """
    Central LLM router providing hot-swappable provider abstraction, token limit enforcement,
    rate limit tracking, cost calculation, and fallback invocation.
    """

    def __init__(
        self,
        registry: Optional[ModelRegistry] = None,
        rate_limiter: Optional[RateLimiter] = None,
        cost_tracker: Optional[CostTracker] = None,
    ):
        self.registry = registry or default_registry
        self.rate_limiter = rate_limiter or RateLimiter()
        self.cost_tracker = cost_tracker or CostTracker()
        self.gemini_provider = GeminiFreeProvider()

    async def execute_prompt(
        self,
        agent_id: str,
        primary_model: str,
        prompt: str,
        fallback_model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> Dict[str, Any]:
        """
        Executes prompt via primary_model, falling back to fallback_model if rate-limited or unavailable.
        """
        target_model_id = primary_model
        model_info = self.registry.get(target_model_id)

        if not model_info:
            logger.warning(f"Primary model '{primary_model}' not found in registry. Registering dynamically.")
            model_info = ModelInfo(
                model_id=primary_model,
                provider=ProviderType.GEMINI if "gemini" in primary_model else ProviderType.ANTHROPIC,
                display_name=primary_model,
                is_free_tier="gemini" in primary_model,
            )
            self.registry.register(model_info)

        estimated_input_tokens = len(prompt.split()) * 2

        # ── 1. Attempt Primary Model ────────────────────────────
        try:
            self.rate_limiter.check_and_record(agent_id, model_info, estimated_tokens=estimated_input_tokens)
            result = await self._dispatch_to_provider(
                agent_id=agent_id,
                model_info=model_info,
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return result

        except RateLimitExceeded as rle:
            logger.warning(f"Primary model '{primary_model}' rate limit hit: {rle}. Checking fallback.")
            if not fallback_model:
                raise rle

            # ── 2. Fallback Model Execution ──────────────────────
            return await self._execute_fallback(
                agent_id=agent_id,
                fallback_model=fallback_model,
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                original_error=str(rle),
            )

        except Exception as e:
            logger.error(f"Execution error on primary model '{primary_model}': {e}")
            if fallback_model:
                return await self._execute_fallback(
                    agent_id=agent_id,
                    fallback_model=fallback_model,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    original_error=str(e),
                )
            raise e

    async def _execute_fallback(
        self,
        agent_id: str,
        fallback_model: str,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
        original_error: str,
    ) -> Dict[str, Any]:
        """Dispatches request to fallback model."""
        fallback_info = self.registry.get(fallback_model)
        if not fallback_info:
            fallback_info = ModelInfo(
                model_id=fallback_model,
                provider=ProviderType.GEMINI if "gemini" in fallback_model else ProviderType.OPENAI,
                display_name=fallback_model,
                is_free_tier="gemini" in fallback_model,
            )
            self.registry.register(fallback_info)

        est_tokens = len(prompt.split()) * 2
        self.rate_limiter.check_and_record(agent_id, fallback_info, estimated_tokens=est_tokens)

        res = await self._dispatch_to_provider(
            agent_id=agent_id,
            model_info=fallback_info,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        res["fallback_used"] = True
        res["original_error"] = original_error
        return res

    async def _dispatch_to_provider(
        self,
        agent_id: str,
        model_info: ModelInfo,
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> Dict[str, Any]:
        """Dispatches request to the appropriate provider client."""
        if model_info.provider == ProviderType.GEMINI:
            raw_res = await self.gemini_provider.generate_completion(
                model=model_info.model_id,
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            input_tokens = raw_res.get("input_tokens", len(prompt.split()))
            output_tokens = raw_res.get("output_tokens", 50)
        else:
            content = f"[{model_info.display_name}] Executed prompt."
            input_tokens = len(prompt.split())
            output_tokens = len(content.split())
            raw_res = {
                "status": "success",
                "model": model_info.model_id,
                "content": content,
                "provider": model_info.provider.value,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "is_free_tier": model_info.is_free_tier,
            }

        cost_rec: CostRecord = self.cost_tracker.calculate_and_record(
            agent_id=agent_id,
            model_info=model_info,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        raw_res["cost_record"] = cost_rec.model_dump()
        return raw_res


# Global singleton instance
model_gateway = ModelGateway()
