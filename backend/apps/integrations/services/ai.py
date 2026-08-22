"""
AI assistant abstraction (section 21 of the spec). Not required for the
MVP — NullAIService is the default and simply reports itself as
unavailable so callers can no-op gracefully. Wire a real provider by
setting AI_SERVICE_CLASS and AI_API_KEY in the environment later.
"""
from __future__ import annotations

import abc
from django.utils.module_loading import import_string


class AIService(abc.ABC):
    @abc.abstractmethod
    def is_available(self) -> bool: ...

    @abc.abstractmethod
    def summarize_conversation(self, messages: list[dict]) -> str: ...

    @abc.abstractmethod
    def suggest_reply(self, messages: list[dict]) -> str: ...

    @abc.abstractmethod
    def detect_intent(self, message_text: str) -> str: ...

    @abc.abstractmethod
    def detect_sentiment(self, message_text: str) -> str: ...


class NullAIService(AIService):
    def is_available(self) -> bool:
        return False

    def summarize_conversation(self, messages: list[dict]) -> str:
        return ""

    def suggest_reply(self, messages: list[dict]) -> str:
        return ""

    def detect_intent(self, message_text: str) -> str:
        return "UNKNOWN"

    def detect_sentiment(self, message_text: str) -> str:
        return "NEUTRAL"


def get_ai_service() -> AIService:
    from django.conf import settings

    service_class = import_string(settings.AI_SERVICE_CLASS)
    return service_class()
