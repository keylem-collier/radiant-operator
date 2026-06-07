import contextlib
import json
import logging
import os
import textwrap
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    inference,
    room_io,
)
from livekit.agents.voice.turn import TurnHandlingOptions
from livekit.plugins import ai_coustics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from moss import DocumentInfo, MossClient, QueryOptions

from filters.backchannel_stt import BackchannelSTTFilterMixin

logger = logging.getLogger("agent")

AGENT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(AGENT_DIR / ".env.local")
load_dotenv(AGENT_DIR.parent / ".env.local")

KNOWLEDGE_INDEX = os.getenv("MOSS_INDEX_NAME", "knowledge")
MEMORY_INDEX = os.getenv("MOSS_MEMORY_INDEX_NAME", "memory")
DEFAULT_USER_ID = "operator_1"

MAYA_INSTRUCTIONS = textwrap.dedent(
    """\
    You are Maya — an empathetic, funny paid-media strategist friend talking to a
    founder or operator. You speak over voice, so lead with warmth and useful
    takes — like a sharp growth friend beside them, not a corporate assistant.

    # Empathy and background creative

    - When they vent or share friction, acknowledge it first ("That sucks",
      "Yeah that's rough", "I get why that would fry you").
    - While you talk, creative work queues in the background — video prompts,
      hooks, search copy, image concepts from what they say.
    - When they share an insight or direction, lightly affirm you're on it:
      "I'm queueing video concepts for that", "I'll spin hooks off that while
      we keep talking."
    - Keep the conversation going. Do not stop to explain tooling or ask
      permission for every job.

    # Grounding

    - For paid-media, Meta, Google Search, TikTok, creative, offers, hooks,
      landing pages, or customer-pattern questions, call `search_knowledge`
      before you answer and ground your reply in the snippets.
    - If snippets do not cover the question, say so honestly rather than guessing.

    # Memory

    - When the user shares a durable fact (role, client, preference, constraint),
      call `remember_fact`.
    - When a reply depends on something they told you earlier, call `recall_facts`
      first.

    # Voice output rules

    - Plain text only. No markdown, lists, JSON, code, or emojis.
    - Keep replies very short: one or two sentences, about twenty-five words max.
    - One punchy take or one sharp question — not both unless essential.
    - Do not mention tools, providers, APIs, or internal systems.
    - Do not claim to publish ads or access live ad accounts.
    - Weave retrieved context in naturally without saying "according to my memory."
    """
)


class MayaAgent(BackchannelSTTFilterMixin, Agent):
    def __init__(self, *, room=None, user_id: str = DEFAULT_USER_ID) -> None:
        super().__init__(
            llm=inference.LLM(model="openai/gpt-4.1-mini"),
            instructions=MAYA_INSTRUCTIONS,
        )
        self._room = room
        self._user_id = user_id
        self._moss = MossClient(
            os.getenv("MOSS_PROJECT_ID"), os.getenv("MOSS_PROJECT_KEY")
        )
        self._indexes_loaded = False

    async def on_enter(self) -> None:
        if self._indexes_loaded:
            return
        try:
            await self._moss.load_index(KNOWLEDGE_INDEX)
            await self._moss.load_index(MEMORY_INDEX)
            self._indexes_loaded = True
            logger.info(
                "Loaded Moss indexes '%s' and '%s'",
                KNOWLEDGE_INDEX,
                MEMORY_INDEX,
            )
        except Exception:
            logger.exception("Failed to preload Moss indexes; will retry on use")

    async def _publish_moss_context(self, query: str, result) -> None:
        if self._room is None:
            return
        try:
            matches: list[dict] = []
            for doc in getattr(result, "docs", None) or []:
                entry: dict = {"text": (getattr(doc, "text", "") or "").strip()}
                score = getattr(doc, "score", None)
                if score is not None:
                    with contextlib.suppress(TypeError, ValueError):
                        entry["score"] = float(score)
                metadata = getattr(doc, "metadata", None)
                if metadata:
                    entry["metadata"] = metadata
                matches.append(entry)

            payload = {
                "type": "moss_context",
                "data": {
                    "query": query,
                    "matches": matches,
                    "time_taken_ms": getattr(result, "time_taken_ms", None),
                    "timestamp": datetime.now(timezone.utc).timestamp(),
                },
            }
            encoded = json.dumps(payload, default=str).encode("utf-8")
            await self._room.local_participant.publish_data(
                payload=encoded, reliable=True
            )
        except Exception:
            logger.exception("Failed to publish moss_context data")

    @function_tool()
    async def search_knowledge(self, context: RunContext, query: str) -> str:
        """Search paid-media knowledge for facts to ground your answer."""
        result = await self._moss.query(
            KNOWLEDGE_INDEX, query, QueryOptions(top_k=3)
        )
        await self._publish_moss_context(query, result)

        docs = getattr(result, "docs", None) or []
        snippets = [(getattr(d, "text", "") or "").strip() for d in docs]
        snippets = [s for s in snippets if s]
        if not snippets:
            return "No relevant context was found for that question."
        return "\n\n".join(snippets)

    @function_tool()
    async def remember_fact(self, context: RunContext, fact: str) -> str:
        """Persist a durable fact the user shares."""
        doc = DocumentInfo(
            id=f"{self._user_id}-{uuid.uuid4()}",
            text=fact,
            metadata={"user_id": self._user_id},
        )
        await self._moss.add_docs(MEMORY_INDEX, [doc])
        try:
            await self._moss.load_index(MEMORY_INDEX)
        except Exception:
            logger.exception("Failed to reload memory index after write")
        return "Got it, I'll remember that."

    @function_tool()
    async def recall_facts(self, context: RunContext, query: str) -> str:
        """Recall facts this user shared earlier."""
        result = await self._moss.query(
            MEMORY_INDEX,
            query,
            QueryOptions(
                top_k=5,
                filter={
                    "field": "user_id",
                    "condition": {"$eq": self._user_id},
                },
            ),
        )
        await self._publish_moss_context(query, result)

        docs = getattr(result, "docs", None) or []
        facts = [(getattr(d, "text", "") or "").strip() for d in docs]
        facts = [f for f in facts if f]
        if not facts:
            return "I don't have anything remembered for you yet."
        return "\n".join(facts)


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm

AGENT_NAME = os.getenv("AGENT_NAME", "agent-py")


@server.rtc_session(agent_name=AGENT_NAME)
async def radiant_agent(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    user_id = DEFAULT_USER_ID
    if ctx.job.metadata:
        try:
            meta = json.loads(ctx.job.metadata)
            user_id = meta.get("user_id", DEFAULT_USER_ID)
        except json.JSONDecodeError:
            logger.warning("ctx.job.metadata was not valid JSON; using default user_id")

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        turn_detection=MultilingualModel(),
        turn_handling=TurnHandlingOptions(
            endpointing={
                "mode": "dynamic",
                "min_delay": 0.8,
                "max_delay": 4.0,
            },
            interruption={
                "enabled": True,
                "mode": "adaptive",
                "min_words": 2,
                "min_duration": 0.6,
                "resume_false_interruption": True,
            },
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(
        agent=MayaAgent(room=ctx.room, user_id=user_id),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        ),
    )

    await ctx.connect()

    await session.generate_reply(
        instructions=(
            "Greet the user warmly in one short sentence. Introduce yourself as "
            "Maya, their paid-media strategist friend, and invite them to talk "
            "through a customer insight or campaign problem."
        )
    )


if __name__ == "__main__":
    cli.run_app(server)
