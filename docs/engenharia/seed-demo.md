# Seed de demonstração

Dados de demonstração que se repetem com um só comando, pela API real (todas as validações valem) e com o modelo de visão a sério. Servem a demo, os ensaios e o júri: nada aqui é inventado por baixo da mesa, e tudo o que é pressuposto está dito.

Script: `scripts/seed/demo_seed.py`. Corre **dentro do contentor da API** (usa o código da aplicação para criar o token de um administrador; nenhum segredo sai do contentor) e faz dry-run por omissão.

## O que cria

- **6 lotes, 24 peças**, cada peça com a sua fotografia real (miniatura de 640 px, sem metadados) e o crédito do autor e da licença:

  | Lote | Freguesia | Estado | Peças |
  | --- | --- | --- | --- |
  | Camisas e polos de algodão | Creixomil | entregue | 5 |
  | Lã e malhas | Azurém | reservado | 5 |
  | Denim e calças | Ponte | triado | 4 |
  | Roupa de casa | Polvoreira | entregue | 4 |
  | Hoodies, lã e cachecóis | São Torcato | reservado | 4 |
  | Lote em curso (etiquetas lidas pelo modelo) | Ronfe | recolhido | 2 |

  Cobrem os quatro estados, quatro reservas de recicladores claramente de demonstração (`demo@example.org`), peças para reutilização e para reciclagem (sem rejeito: nenhuma peça o justifica).
- **7 cenários `Demo · …`**: por freguesia (40 000 €/ano; 90 000 €/ano como filho do primeiro; custo mínimo para 350 t) e por locais reais (50 000 €/ano; raio 500 m como filho; escolas; custo mínimo para 250 t). Todos calculados com as rotas por estrada ([Rotas por estrada](rotas-reais.md)).
- **Histórico espalhado por dias**: lote aberto de manhã, peças ao longo de minutos, triado no dia seguinte, reservado dois dias depois da abertura, entregue dois dias a seguir (nunca no futuro). É a única parte escrita por SQL, e só mexe em datas.

## Honestidade dos dados

- A **triagem é real** (modelo de visão, prompt versionado), e a composição vem da etiqueta quando a foto a mostra (o cachecol Ralph Lauren, a etiqueta DIM e a da Muji foram lidas pelo modelo). Nas restantes peças a composição é a que **o operador confirma** no formulário, que é o passo real do produto: no seed está fixada por tipo de peça (por exemplo, t-shirt de algodão a 100%) e é um pressuposto de demonstração, não uma leitura. Por isso só estas fibras entram na bolsa e nas marcas como dados de demonstração.
- Os **pesos** são os da tabela de pesos médios por tipo de peça, como em todo o produto (estimativa).
- As **fotografias** são da Wikimedia Commons (CC0, domínio público, CC BY e CC BY-SA). Autor e licença vão no crédito de cada miniatura, no lote e no passaporte, e a página de créditos explica as licenças. Escolheram-se só peças inteiras sem pessoas. Não se guardam originais: o script descarrega uma versão de 1 024 px, a API reduz para 640 px e remove os metadados.
- As miniaturas expiram ao fim da retenção (90 dias por omissão; [Privacidade das fotografias](privacidade-fotografias.md)): depois dessa data o seed tem de se repetir para as voltar a ter.

## Como se corre

```bash
# Plano e lista de fotografias, sem criar nada
ssh root@<vps> 'docker exec -i $(docker ps --format "{{.Names}}" | grep ^api-) python -' < scripts/seed/demo_seed.py

# Cria tudo (usa o modelo de visão: uns cêntimos de OpenRouter; precisa de OPENROUTER_API_KEY na API)
ssh root@<vps> 'docker exec -i $(docker ps --format "{{.Names}}" | grep ^api-) python - --yes' < scripts/seed/demo_seed.py

# Em desenvolvimento, sem chave de IA (composição toda do operador); NOVELO_API_BASE e DATABASE_URL apontam para a stack local
cd apps/api && NOVELO_API_BASE=http://127.0.0.1:8190/api/v1 uv run python ../../scripts/seed/demo_seed.py --yes --offline-triage
```

Opções: `--skip-lots`, `--skip-scenarios`, `--offline-triage` (só desenvolvimento) e `--cleanup MANIFESTO.json --yes`, que apaga exatamente o que um manifesto anterior criou (os lotes por código; os cenários `Demo · ` filhos antes dos pais). Cada execução escreve o manifesto em `/tmp/demo_seed_manifest.json` dentro do contentor e imprime-o no fim: guarda-o para poderes limpar.

Não é idempotente: correr duas vezes cria dois conjuntos. Para refazer, limpa primeiro com o manifesto.

## Em produção (23 out 2026)

Lotes criados: `NOV-37CSZT`, `NOV-6EYRXN`, `NOV-4GRERY`, `NOV-JXTU3J`, `NOV-GB2UGN` e `NOV-BXS4UW` (o lote em curso). O passaporte público de cada um está em `/pt/passport/<código>`; a página interna (precisa de sessão) em `/pt/lots/<código>`.

Substituíram os dados de teste da primeira ronda (7 lotes e 9 cenários `[Teste]` sem fotografias e com fibra desconhecida), que foram apagados por código e por identificador exatos.
