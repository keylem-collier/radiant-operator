"""
Backchannel STT filter — drops filler-only transcripts while the agent speaks.

Adapted from AssemblyAI-Solutions/livekit-interruption-filters (MIT).
"""

from __future__ import annotations

import logging
import string
import time
from collections.abc import AsyncIterable

from livekit import rtc
from livekit.agents import Agent, stt
from livekit.agents.voice import ModelSettings

BACKCHANNELS = frozenset(
    {
        "mhm",
        "mm",
        "mmhm",
        "mmhmm",
        "uh",
        "uhhuh",
        "huh",
        "um",
        "umm",
        "uhm",
        "er",
        "erm",
        "hmm",
        "hm",
        "ah",
        "oh",
        "yeah",
        "yep",
        "yup",
        "okay",
        "ok",
        "right",
        "alright",
        "gotcha",
        "totally",
        "sure",
    }
)

_TRANSCRIPT_TYPES = {
    stt.SpeechEventType.INTERIM_TRANSCRIPT,
    stt.SpeechEventType.PREFLIGHT_TRANSCRIPT,
    stt.SpeechEventType.FINAL_TRANSCRIPT,
}

_PUNCT_STRIP = str.maketrans("", "", string.punctuation)

log = logging.getLogger("backchannel_stt_filter")


def _is_all_backchannel(text: str) -> bool:
    tokens = text.lower().translate(_PUNCT_STRIP).split()
    return bool(tokens) and all(tok in BACKCHANNELS for tok in tokens)


class BackchannelSTTFilterMixin:
    _FILTER_GRACE_S: float = 1.0
    _last_speaking_at: float = 0.0

    async def stt_node(
        self, audio: AsyncIterable[rtc.AudioFrame], model_settings: ModelSettings
    ):
        async for ev in Agent.default.stt_node(self, audio, model_settings):
            if self._should_drop(ev):
                text = ev.alternatives[0].text if ev.alternatives else ""
                log.info(
                    "event_filtered transcript=%r ev_type=%s agent_state=%s",
                    text,
                    ev.type,
                    self.session.agent_state,
                )
                continue
            yield ev

    def _should_drop(self, ev: stt.SpeechEvent) -> bool:
        now = time.monotonic()
        if self.session.agent_state == "speaking":
            self._last_speaking_at = now
        elif now - self._last_speaking_at > self._FILTER_GRACE_S:
            return False
        if ev.type not in _TRANSCRIPT_TYPES:
            return False
        text = ev.alternatives[0].text if ev.alternatives else ""
        return _is_all_backchannel(text)
