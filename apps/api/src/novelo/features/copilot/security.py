"""Varrimento de texto que vai para o prompt (memória, persona, instruções): injeção, exfiltração e dados sensíveis.

Tudo o que o utilizador ou o modelo grava e que depois é injetado no prompt passa aqui. Bloqueia e regista
(sem o conteúdo); a mensagem de erro diz o motivo genérico para o modelo ou o utilizador corrigirem.
"""

import logging
import re
import unicodedata

log = logging.getLogger("novelo.copilot.security")

_INVISIBLE = {0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x2060, 0xFEFF, 0x00AD}
_INJECTION = [
    r"ignor\w*\s+(\w+\s+){0,3}(instruc|instruç|regras|rules|instructions|prompt)",
    r"(disregard|forget|override|bypass)\s+(\w+\s+){0,3}(rules|instructions|polic|safety|guardrail)",
    r"(esquece|desconsidera|ignora)\s+(\w+\s+){0,3}(regras|instru|seguran)",
    r"\b(you are now|from now on you|agora (és|es|tu és)|a partir de agora (és|es))\b",
    r"(system|developer)\s*(prompt|message|mode)|prompt\s+do\s+sistema|modo\s+(de\s+)?programador",
    r"\bjailbreak\b|\bDAN\b|\bact as\b|\bfinge ser\b|\bpretend to be\b",
    r"(reveal|show|print|repeat|leak|mostra|revela|repete)\s+(\w+\s+){0,3}(prompt|instru|regras|rules|memor)",
    r"(do not|don't|never|nunca|não)\s+(\w+\s+){0,2}(tell|inform|disclose|diz|digas|avises|mostres)\s+(\w+\s+){0,2}(user|utilizador)",
    r"(inventa|inventar|invent|fabricate|make up|fake)\s+(\w+\s+){0,3}(n[uú]meros|numbers|valores|values|dados|data|kpi)",
    r"(sem|without|skip|no|nunca|never|stop|n[aã]o|don't|do not)\s+(\w+\s+){0,2}(verif|check|valid)\w*",
    r"(sempre|always|automatically|automaticamente)\s+(\w+\s+){0,3}(chama|call|execut|run|apaga|delete|aprova|approve|confirma|confirm)",
    r"(call|chama|run|executa|invoke)\s+(the\s+|a\s+)?(tool|ferramenta|action|ação|acao)\b",
]
_EXFIL = [
    r"https?://|ftp://|www\.",
    r"\b(api[_ -]?key|secret|token|password|passwd|senha|palavra[- ]passe|credencia\w*|private key|ssh-rsa|bearer)\b",
    r"\bsk-[A-Za-z0-9_-]{10,}",
    r"[A-Za-z0-9+/=]{40,}",
    r"\b(curl|wget|nc|netcat|base64|eval|exec|powershell)\b\s",
]
_SENSITIVE = [
    r"[\w.+-]+@[\w-]+\.[\w.-]+",  # email
    r"(?<!\d)(\+?\d[\d ]{8,}\d)(?!\d)|(?<!\d)\d{9}(?!\d)",  # telefone, NIF, cartão
    r"\b(nif|niss|nib|passaporte|passport|cart[aã]o de cidad[aã]o)\b\s*(n[ºo.]?\s*)?[:\-]?\s*\d",
    r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b",  # IBAN
    r"\b(sa[uú]de|doen[cç]a|diagn[oó]stico|religi[aã]o|partido|orienta[cç][aã]o sexual|etnia|health|diagnosis|religion|ethnicity)\b",
    r"\b(morada|endere[cç]o|address)\b",
]
_VOLATILE = r"\d[\d  .,]*\s*(€|eur|%|toneladas?|kg|t\b|t/ano|€/t)"  # números que mudam: ficam nos dados, não na memória

_COMPILED = {
    "injection": [re.compile(p, re.IGNORECASE) for p in _INJECTION],
    "exfiltration": [re.compile(p, re.IGNORECASE) for p in _EXFIL],
    "sensitive": [re.compile(p, re.IGNORECASE) for p in _SENSITIVE],
    "volatile": [re.compile(_VOLATILE, re.IGNORECASE)],
}


class Blocked(ValueError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _has_invisible(text: str) -> bool:
    for ch in text:
        cp = ord(ch)
        if cp in _INVISIBLE or 0x202A <= cp <= 0x202E or 0x2066 <= cp <= 0x2069 or 0xE0000 <= cp <= 0xE007F:
            return True
        if unicodedata.category(ch) == "Cc" and ch not in "\n\t":
            return True
    return False


def scan(text: str, *, allow_volatile: bool = False, where: str = "memory") -> None:
    """Levanta `Blocked(motivo)` se o texto não pode entrar no prompt. Não devolve nada se estiver limpo."""
    if _has_invisible(text):
        log.warning("blocked %s text reason=invisible_unicode", where)
        raise Blocked("invisible_unicode")
    folded = unicodedata.normalize("NFKC", text)
    for reason, patterns in _COMPILED.items():
        if reason == "volatile" and allow_volatile:
            continue
        if any(p.search(folded) for p in patterns):
            log.warning("blocked %s text reason=%s", where, reason)
            raise Blocked(reason)


EXPLANATION = {
    "invisible_unicode": "contains invisible or control characters",
    "injection": "looks like an instruction aimed at the assistant (not allowed)",
    "exfiltration": "contains a link, credential or encoded payload",
    "sensitive": "contains personal or sensitive data (emails, phone numbers, IDs, health, address...)",
    "volatile": "contains figures that change (€, %, tonnes); keep those in the data, not in memory",
}
