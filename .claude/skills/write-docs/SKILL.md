---
name: write-docs
description: Escrever e rever documentação do Novelo em pt-PT: estrutura de docs/, tom, nomes de ficheiros, números com fonte. Usar ao criar ou alterar qualquer ficheiro em docs/ ou README.
---

# Documentação

- Só Markdown (`.md`), sem PDFs. Estrutura: `docs/projeto/` (visão, pitch, júri, proposta), `docs/engenharia/` (arquitetura, features, dados e modelo, deploy, backlog, demo, workflow de IA, ambiente), `docs/dados/` (análise dos dados recebidos), `docs/marca/`. Imagens em `docs/img/`. Índice em `docs/README.md`.
- Ficheiros: português, minúsculas, hífens, sem prefixos numéricos.
- pt-PT com acentos corretos; frases curtas, concretas, sem adjetivos vazios nem "revolucionário", "seamless", "potente".
- Todo o número tem fonte (dados da Vitrus, plano municipal, diretiva) ou a palavra "estimativa". Os números reais do ponto de partida estão na skill `novelo-context`.
- Diagramas em Mermaid (renderiza no GitHub); fórmulas em LaTeX (`$$`).
- Links relativos que funcionam; depois de mover ficheiros, verificar com `grep -rn "](" docs README.md`.
- Atualizar o doc no mesmo commit em que o comportamento muda.
