"""Teste de fumo do email em produção (ou em dev): corre depois de cada deploy. Usa a API do Novelo, nunca o Resend.

Verifica `/ready`, o resumo e o DNS dos emails, envia um email de teste ao administrador e espera pelo estado final.

Uso:
    NOVELO_URL=https://novelo.helder.si SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... python scripts/smoke_email.py
Em produção o login exige Turnstile: usa `SMOKE_COOKIE` (cabeçalho Cookie de uma sessão de administrador, copiado
do navegador) em vez de email e password.

Saída: 0 = tudo bem; 1 = o email falhou ou há alertas críticos; 2 = não foi possível contactar a API.
"""

import os
import sys
import time

import httpx

BASE = os.environ.get("NOVELO_URL", "http://localhost:3190").rstrip("/")
API = f"{BASE}/api/v1"
CRITICAL = {"provider_not_configured", "provider_auth_invalid", "domain_not_verified"}
WAIT_S = int(os.environ.get("SMOKE_WAIT_S", "60"))


def say(ok: bool, text: str) -> bool:
    print(f"[{'ok' if ok else 'FALHOU'}] {text}")
    return ok


def main() -> int:
    headers = {"Cookie": os.environ["SMOKE_COOKIE"]} if os.environ.get("SMOKE_COOKIE") else {}
    try:
        with httpx.Client(base_url=API, headers=headers, timeout=15, follow_redirects=False) as http:
            return run(http)
    except httpx.HTTPError as exc:
        print(f"[FALHOU] não foi possível contactar {BASE}: {exc.__class__.__name__}")
        return 2


def run(http: httpx.Client) -> int:
    good = True
    ready = http.get("/ready").json()
    good &= say(ready.get("email") == "ok", f"/ready: email={ready.get('email')}")
    if not headers_have_cookie(http):
        email, password = os.environ.get("SMOKE_ADMIN_EMAIL"), os.environ.get("SMOKE_ADMIN_PASSWORD")
        if not (email and password):
            print("[FALHOU] define SMOKE_COOKIE ou SMOKE_ADMIN_EMAIL e SMOKE_ADMIN_PASSWORD")
            return 2
        login = http.post("/auth/login", json={"email": email, "password": password})
        if login.status_code != 200:
            print(f"[FALHOU] login HTTP {login.status_code} ({login.json().get('code')}); em produção usa SMOKE_COOKIE")
            return 2
    summary = http.get("/users/emails/summary")
    if summary.status_code != 200:
        print(f"[FALHOU] resumo HTTP {summary.status_code}")
        return 2
    s = summary.json()
    tracking = s["delivery_tracking"]
    print(f"     fornecedor={s['provider_configured']} webhook={s['webhook_configured']} acompanhamento={tracking}")
    print(f"     24 h: {s['last_24h']['total']} envios, taxa de sucesso={s['success_rate_24h_pct']}%")
    alerts = set(s["alerts"])
    good &= say(not alerts & CRITICAL, f"alertas críticos: {sorted(alerts & CRITICAL) or 'nenhum'}")
    if alerts - CRITICAL:
        print(f"     avisos: {sorted(alerts - CRITICAL)}")
    dns = http.get("/users/emails/health").json()
    for check in dns.get("checks", []):
        good &= say(check["status"] in {"ok", "warn"}, f"DNS {check['key']}: {check['status']} {check['hint']}".strip())
    sent = http.post("/users/emails/test")
    if sent.status_code != 200:
        good &= say(False, f"email de teste HTTP {sent.status_code} ({sent.json().get('code')})")
        return 1
    delivery = sent.json()
    good &= say(delivery["status"] != "failed", f"email de teste: {delivery['status']} {delivery['error_code'] or ''}")
    want = {"delivered"} if tracking != "provider_accepted_only" else {"sent", "delivered"}
    deadline = time.monotonic() + WAIT_S
    while delivery["status"] not in want | {"failed", "bounced", "complained"} and time.monotonic() < deadline:
        time.sleep(3)
        delivery = http.get(f"/users/emails/{delivery['id']}").json()
    good &= say(delivery["status"] in want, f"estado final: {delivery['status']} (esperado {sorted(want)})")
    return 0 if good else 1


def headers_have_cookie(http: httpx.Client) -> bool:
    return "cookie" in {k.lower() for k in http.headers}


if __name__ == "__main__":
    sys.exit(main())
