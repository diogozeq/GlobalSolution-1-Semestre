"""OpenRouter client with per-task model fallback.

Uses the OpenAI SDK pointed at OpenRouter's base URL. Model IDs are read from
settings and tried in order until one succeeds.
"""
from __future__ import annotations

import logging
from threading import Lock

from app.core.config import settings

logger = logging.getLogger("orbitguard.llm")
_rotation_lock = Lock()
_rotation_offsets: dict[str, int] = {"report": 0, "agent": 0}


class LLMUnavailable(Exception):
    """Raised when no model could produce a completion (or no API key)."""


def _dedupe(models: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for model in models:
        if model and model not in seen:
            seen.add(model)
            out.append(model)
    return out


def _rotate(task: str, models: list[str]) -> list[str]:
    if len(models) < 2:
        return models
    with _rotation_lock:
        offset = _rotation_offsets.get(task, 0) % len(models)
        _rotation_offsets[task] = offset + 1
    return models[offset:] + models[:offset]


def _models_for(task: str) -> list[str]:
    primary = settings.report_models if task == "report" else settings.agent_models
    return _dedupe(_rotate(task, primary) + settings.fallback_models)


def chat_completion(
    task: str,
    messages: list[dict],
    *,
    json_mode: bool = False,
    temperature: float = 0.3,
    max_tokens: int = 900,
) -> tuple[str, str]:
    """Return (content, model_id). Raises LLMUnavailable on total failure."""
    if not settings.llm_enabled:
        raise LLMUnavailable("OPENROUTER_API_KEY ausente")

    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover
        raise LLMUnavailable(f"openai SDK indisponível: {exc}") from exc

    client = OpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )

    last_error: Exception | None = None
    for model in _models_for(task):
        try:
            kwargs: dict = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content or ""
            if content.strip():
                return content, model
        except Exception as exc:  # noqa: BLE001 - try next model
            if json_mode:
                try:
                    kwargs.pop("response_format", None)
                    resp = client.chat.completions.create(**kwargs)
                    content = resp.choices[0].message.content or ""
                    if content.strip():
                        return content, model
                except Exception as retry_exc:  # noqa: BLE001 - try next model
                    logger.warning("LLM model %s failed without JSON mode: %s", model, retry_exc)
            logger.warning("LLM model %s failed: %s", model, exc)
            last_error = exc
            continue

    raise LLMUnavailable(str(last_error) if last_error else "Nenhum modelo respondeu")
