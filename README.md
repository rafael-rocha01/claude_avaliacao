# Avaliação Física Antropométrica

Interface local para avaliação física e acompanhamento de alunos, integrada ao Claude Code
pela pasta de cada aluno.

## O que tem

| Aba | Conteúdo |
|---|---|
| **Painel** | Últimos indicadores com variação em relação à avaliação anterior, gráficos, alertas (PAR-Q, PA, SpO₂, dor, reavaliação atrasada) |
| **Anamnese inicial** | Histórico de saúde, medicamentos, lesões, hábitos, objetivos e PAR-Q |
| **Avaliações** | Peso/estatura · 18 circunferências · 10 dobras · protocolos JP7, JP3, Durnin-Womersley e Faulkner · PA (3 leituras + média) · FC · **oxímetro (SpO₂, FC, PI)** · 4 fotos + extras (câmera do celular) · **checklist postural** (anterior, lateral, posterior, com graus) |
| **Acompanhamento** | Anamnese de acompanhamento a cada encontro: escalas 0–10 (energia, sono, estresse, dor EVA, fome, recuperação), adesão a treino/dieta, sinais rápidos, relato e metas |
| **Evolução** | Tabela comparativa de todas as avaliações com Δ, e gráficos |
| **Fotos** | Antes × depois lado a lado com **grade postural e linha de prumo** (clique move o prumo; Shift+clique cria uma linha horizontal) |
| **Feedback Claude** | Pede feedback, mostra os feedbacks escritos pelo Claude, copia o texto para mandar ao aluno |

Cálculos automáticos: IMC, % de gordura (densidade + Siri), massa gorda/magra, RCQ, cintura/estatura,
PA média e classificação (Diretriz Brasileira 2020), PAM, FC máx. estimada (Tanaka), classificação de SpO₂.
“Imprimir relatório” gera o PDF do painel pelo navegador.

## Como rodar

Requisito: Python 3.9+ (sem bibliotecas extras).

```bash
python3 servidor.py            # abre em http://localhost:8080
python3 servidor.py --rede     # libera na rede local: abra no celular http://IP-DO-PC:8080 para tirar as fotos
```

## Como conversa com o Claude

Tudo fica em `clientes/<aluno>/` (JSON, fotos JPG e um `RESUMO.md` que a interface gera
sozinha). O `CLAUDE.md` deste repositório ensina o Claude a ler essa pasta.

**Opção 1: Claude Code (recomendado, sem custo extra de API)**
1. Na aba *Feedback Claude* (ou com “Salvar e pedir feedback”), escreva o que quer e clique em **Enviar pedido**.
2. No Claude Code aberto nesta pasta, digite `/feedback nome-do-aluno` (ou só `/feedback` para atender todos os pendentes).
3. O Claude lê os dados e as fotos e grava `clientes/<aluno>/feedback/AAAA-MM-DD-<tipo>.md`.
   Ao voltar para a janela da interface, o feedback aparece sozinho.

Também dá para conversar livremente: *“compare as fotos de lateral do João de agosto e novembro”*.

**Opção 2: botão “Gerar agora” (API)**
```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python3 servidor.py
```
O botão aparece na aba de feedback; usa o modelo `claude-opus-5-5` e envia o resumo e as fotos da última avaliação.

## Privacidade (LGPD)

Dados de alunos são dados de saúde. O `.gitignore` mantém `clientes/` **fora do Git**
(exceto o aluno fictício `exemplo-joao-silva`). Alunos excluídos vão para `.lixeira/`.
Na API, o resumo e as fotos são enviados à Anthropic; com o Claude Code, ele lê os arquivos locais.

## Estrutura

```
servidor.py              servidor HTTP + gravação em disco + RESUMO.md + chamada opcional à API
web/                     interface (HTML/CSS/JS puro)
  calculos.js            fórmulas e classificações
CLAUDE.md                instruções para o Claude (estrutura, formato do feedback, limites)
.claude/commands/feedback.md   comando /feedback
clientes/<slug>/         cliente.json, anamnese.json, avaliacoes/, acompanhamentos/, fotos/, pedidos/, feedback/, RESUMO.md
```
