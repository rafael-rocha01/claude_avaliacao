---
description: Lê a pasta do aluno e escreve o feedback da avaliação/acompanhamento
argument-hint: <slug-do-aluno> [instrução extra]
---

Aluno(s): $ARGUMENTS

Siga o fluxo de feedback descrito no `CLAUDE.md` do projeto:

0. Se houver pedidos `Tipo: importar-pdf` pendentes para o aluno, converta-os primeiro (seção
   "Importar PDF do Nutrio" do CLAUDE.md), para o feedback já considerar essas avaliações.
1. Se não vier slug, liste `clientes/*/pedidos/*.md` e atenda **todos** os pedidos pendentes.
2. Para cada aluno: leia `clientes/<slug>/RESUMO.md`, os pedidos em `pedidos/`, os JSON das
   avaliações/acompanhamentos referenciados e, se o pedido envolver postura ou fotos, abra as
   imagens em `fotos/`.
3. Escreva o feedback em `clientes/<slug>/feedback/AAAA-MM-DD-<tipo>.md` no formato do CLAUDE.md.
4. Apague o pedido atendido em `pedidos/`.
5. No final, me diga em 2–3 linhas o que encontrou de mais importante em cada aluno.
