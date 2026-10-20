"""Conversa do copiloto: o modelo escolhe ferramentas, o servidor corre-as e verifica todos os números do texto."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from novelo.adapters.openrouter import OpenRouterClient
from novelo.ai.prompts import load
from novelo.ai.tasks import AiTask
from novelo.ai.verify import unsupported_rounded
from novelo.features.copilot import web as web_service
from novelo.features.copilot.schemas import CopilotReply, CopilotRequest
from novelo.features.copilot.tools import CopilotTools
from novelo.features.users.models import User

log = logging.getLogger("novelo.copilot")

WARNING_TEXT = {
    "pt-PT": "Não consegui validar os números desta resposta, por isso mostro apenas os resultados calculados.",
    "en": "I could not verify the numbers in this answer, so I am showing only the calculated results.",
}
REWRITE = (
    "Your last answer used numbers that are not in the tool results of this turn: {numbers}. "
    "Rewrite it using only numbers copied exactly from the tool results (call a tool if you need one), "
    "in the same language, without mentioning this correction."
)


async def chat(db: AsyncSession, llm: OpenRouterClient, user: User, req: CopilotRequest) -> CopilotReply:
    system, version = load("copilot")  # prompt de sistema estável e primeiro: favorece o prompt caching
    tools = CopilotTools(db, user)
    today, today_facts = web_service.today_line()
    tools.facts.append(today_facts)  # «este ano» / «2026»: a data de hoje é um facto verificado
    context = f"[context] interface_language={req.locale}; active_scenario_id={req.scenario_id or 'none'}; {today}"
    messages: list[dict[str, Any]] = [{"role": "user", "content": context}]
    messages += [{"role": t.role, "content": t.content} for t in req.messages]
    last_user = req.messages[-1].content

    result = await llm.chat(
        system=system, messages=messages, tools=tools.specs(), execute=tools.execute, task=AiTask.COPILOT
    )
    bad = unsupported_rounded(result.text, tools.facts, also_allowed=last_user) if result.text else {-1.0}
    if bad:
        log.info("copilot answer failed number check count=%s; rewriting once", len(bad))
        correction = REWRITE.format(numbers=", ".join(str(n) for n in sorted(bad) if n >= 0) or "(empty answer)")
        retry = await llm.chat(
            system=system,
            messages=[*result.messages, {"role": "user", "content": correction}],
            tools=tools.specs(),
            execute=tools.execute,
            max_iterations=3,
            task=AiTask.COPILOT,
        )
        result = retry
        bad = unsupported_rounded(result.text, tools.facts, also_allowed=last_user) if result.text else {-1.0}

    verified = not bad
    return CopilotReply(
        text=result.text if verified else WARNING_TEXT[req.locale],
        cards=list(tools.cards.values())[:6],
        tools_used=tools.trace,
        verified=verified,
        warning=None if verified else "numbers_unverified",
        prompt_version=version,
        model=llm.model_for(AiTask.COPILOT),
        language=req.locale,
    )
