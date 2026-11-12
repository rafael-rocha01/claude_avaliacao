# Avaliação Física Antropométrica

Interface local para avaliação física e acompanhamento de alunos, integrada ao Claude Code
pela pasta de cada aluno.

## O que tem

| Aba | Conteúdo |
|---|---|
| **Painel** | Últimos indicadores com variação em relação à avaliação anterior, gráficos, alertas (PAR-Q, PA, SpO₂, dor, reavaliação atrasada) |
| **Anamnese inicial** | Histórico de saúde, medicamentos, lesões, hábitos, objetivos e PAR-Q |
| **Avaliações** | Peso/estatura · 18 circunferências · 10 dobras · protocolos JP7, JP3, Durnin-Womersley e Faulkner · PA (3 leituras + média) · FC · **oxímetro (SpO₂, FC, PI)** · 4 fotos + extras com **câmera guiada** (silhueta da posição, linha de prumo, nível do celular, foto anterior em transparência, timer) · **checklist postural** (anterior, lateral, posterior, com graus) |
| **Importar PDF** | Anexa o PDF de avaliação do **Nutrio** (ou outro sistema). O Claude converte para o formato do sistema; a avaliação entra no histórico marcada “revisar”, com os valores do Nutrio guardados para comparação |
| **Acompanhamento** | Anamnese de acompanhamento a cada encontro: escalas 0–10 (energia, sono, estresse, dor EVA, fome, recuperação), adesão a treino/dieta, sinais rápidos, relato e metas |
| **Evolução** | Tabela comparativa de todas as avaliações com Δ, e gráficos |
| **Fotos** | Antes × depois lado a lado com **grade postural e linha de prumo** (clique move o prumo; Shift+clique cria uma linha horizontal) |
| **Feedback Claude** | Pede feedback, mostra os feedbacks escritos pelo Claude, copia o texto para mandar ao aluno |

Cálculos automáticos: IMC, % de gordura (densidade + Siri), massa gorda/magra, RCQ, cintura/estatura,
PA média e classificação (Diretriz Brasileira 2020), PAM, FC máx. estimada (Tanaka), classificação de SpO₂.
“Imprimir relatório” gera o PDF do painel pelo navegador.

## Instalar no notebook (5 minutos)

1. **Python**: instale em python.org/downloads. No Windows, marque **“Add Python to PATH”**.
2. **Git for Windows** (git-scm.com), só no Windows: necessário para usar o celular com a câmera guiada.
3. **Baixe o projeto**: GitHub → `claude_avaliacao` → **Code → Download ZIP** → descompacte em `Documentos\avaliacao`
   (ou `git clone`).
4. **Dois cliques** em `iniciar-windows.bat` (Windows) ou `iniciar-mac.command` (Mac; na 1ª vez: botão direito → Abrir).
   Escolha **1** (só notebook) ou **2** (notebook + celular). O navegador abre sozinho.
5. **Claude Code**: instale o app do Claude (claude.ai/download), abra a aba **Code** e selecione a pasta do projeto.
   Pronto: `/feedback nome-do-aluno` e `/importar nome-do-aluno` funcionam.

Os dados ficam em `clientes/` dentro dessa pasta. **Faça backup** (⭳ Baixar backup) toda semana num pendrive ou drive.

## Duas formas de usar

- **Local** (seu computador, grátis, integração direta com o Claude Code) — veja abaixo.
- **Online** (qualquer lugar, com login e HTTPS) — passo a passo em **[PUBLICAR.md](PUBLICAR.md)**.
- Os dois conversam por **backup .zip** (barra lateral: ⭳ Baixar / ⭱ Importar).

## Como rodar

Requisito: Python 3.9+ (sem bibliotecas extras).

```bash
python3 servidor.py                  # só no computador: http://localhost:8080
python3 servidor.py --rede --https   # celular/tablet no mesmo Wi-Fi: abra o https://IP:8080 que aparece no terminal
python3 servidor.py --rede --https --senha minha-senha-forte   # idem, exigindo login
```

### Câmera guiada (fotos sempre iguais)
Na avaliação, **📷 Sessão guiada** abre a câmera com a silhueta da posição e faz as 4 fotos em sequência:
frente → lateral direita → costas → lateral esquerda.
- **Silhueta + linhas amarelas**: cabeça abaixo da linha de cima, pés sobre a linha de baixo. Assim a distância e o enquadramento ficam iguais.
- **Linha vermelha (prumo)**: no meio do corpo na frente/costas; sobre o tornozelo nas laterais.
- **Foto anterior** do aluno em transparência: alinhe o aluno sobre ela para comparar antes e depois sem distorção.
- **Nível** (no celular): a bolinha fica verde quando o aparelho está reto. **Timer** de 3/5/10 s para usar com tripé.
- Dicas: tripé na altura do umbigo do aluno, a ~3 m, fundo liso e mesma luz.

No celular, o navegador só libera a câmera ao vivo em **HTTPS**, por isso o `--https`. Na primeira vez ele avisa que o
certificado não é confiável (é um certificado gerado no seu computador): toque em *Avançado → Continuar*.
O `--https` usa o `openssl` (no Windows, vem com o Git for Windows). Sem HTTPS, a câmera guiada oferece a câmera
comum do celular, sem a silhueta.

## Como conversa com o Claude

Tudo fica em `clientes/<aluno>/` (JSON, fotos JPG e um `RESUMO.md` que a interface gera
sozinha). O `CLAUDE.md` deste repositório ensina o Claude a ler essa pasta.

**Opção 1: Claude Code (recomendado, sem custo extra de API)**
1. Na aba *Feedback Claude* (ou com “Salvar e pedir feedback”), escreva o que quer e clique em **Enviar pedido**.
2. No Claude Code aberto nesta pasta, digite `/feedback nome-do-aluno` (ou só `/feedback` para atender todos os pendentes).
3. O Claude lê os dados e as fotos e grava `clientes/<aluno>/feedback/AAAA-MM-DD-<tipo>.md`.
   Ao voltar para a janela da interface, o feedback aparece sozinho.

Também dá para conversar livremente: *“compare as fotos de lateral do João de agosto e novembro”*.

**Importar PDF do Nutrio**
1. Aba *Importar PDF* → arraste o(s) PDF(s) (pode ser avaliação antiga: vira uma data no histórico).
2. No Claude Code: `/importar nome-do-aluno` (ou `/importar` para todos os pendentes).
3. A avaliação aparece em *Avaliações* com o selo **revisar**. Abra, confira com o PDF (o link fica no topo) e clique em **Salvar avaliação**.
   O sistema recalcula %G, IMC, RCQ etc. e mostra ao lado o que o Nutrio havia calculado. Medidas sem campo no sistema
   (ex.: diâmetros ósseos, bioimpedância) ficam listadas em “Itens do PDF sem campo no sistema”.

**Opção 2: botão “Gerar agora” / “Converter agora” (API)**
```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python3 servidor.py
```
Os botões aparecem nas abas de feedback e de importação; usa o modelo `claude-opus-5-5` e envia o resumo e as fotos da última avaliação.

## Privacidade (LGPD)

Dados de alunos são dados de saúde. O `.gitignore` mantém `clientes/` **fora do Git**
(exceto o aluno fictício `exemplo-joao-silva`). Alunos excluídos vão para `.lixeira/`.
Na API, o resumo e as fotos são enviados à Anthropic; com o Claude Code, ele lê os arquivos locais.

## Estrutura

```
servidor.py              servidor HTTP + login + backup + gravação em disco + RESUMO.md + API opcional
Dockerfile, render.yaml  publicação online (ver PUBLICAR.md)
web/                     interface (HTML/CSS/JS puro)
  calculos.js            fórmulas e classificações
CLAUDE.md                instruções para o Claude (estrutura, formato do feedback, limites)
.claude/commands/        comandos /feedback e /importar
clientes/<slug>/         cliente.json, anamnese.json, avaliacoes/, importacoes/, acompanhamentos/, fotos/, pedidos/, feedback/, RESUMO.md
```
