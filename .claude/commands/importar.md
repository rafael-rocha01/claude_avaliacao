---
description: Converte o PDF de avaliação (Nutrio) anexado na interface para o formato do sistema
argument-hint: <slug-do-aluno>
---

Aluno(s): $ARGUMENTS

Siga a seção **"Importar PDF do Nutrio"** do `CLAUDE.md`:

1. Se não vier slug, procure em `clientes/*/pedidos/*.md` todos os pedidos com `Tipo: importar-pdf`.
2. Para cada pedido: leia o PDF indicado em `Arquivo:`, além de `cliente.json` (sexo e nascimento,
   para conferir o protocolo) e a observação do avaliador, se houver.
3. Grave `clientes/<slug>/avaliacoes/<data-do-pdf>.json` no formato exato do CLAUDE.md, com
   `revisar: true`, `origem` e os valores calculados pelo Nutrio em `nutrio`.
4. Apague o pedido atendido.
5. Me mostre um resumo curto: data, campos importados, protocolo usado, %G do Nutrio e o que não
   tinha campo no sistema. Depois disso, a interface calcula os resultados sozinha ao abrir o aluno.
