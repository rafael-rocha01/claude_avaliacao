# Publicar a versão online (Render)

Tempo: ~15 minutos. Custo: plano **Starter do Render (US$ 7/mês)** + disco de 5 GB (~US$ 1,25/mês) — valores de referência, confira no site do Render.
O disco é o que guarda os alunos, as fotos e os PDFs entre reinícios (o plano gratuito apaga tudo).

## Antes de começar
1. **Deixe o repositório privado**: GitHub → `claude_avaliacao` → *Settings* → *General* → *Danger Zone* →
   *Change visibility* → **Private**. Os dados dos alunos nunca vão para o GitHub, mas o código fica protegido.
2. Escolha uma **senha forte** (mínimo 10 caracteres; ideal: 4 palavras aleatórias, ex.: `prega-cintura-azul-74`).
3. (Opcional) Para os botões **Gerar feedback agora** e **Converter PDF agora**, crie uma chave da API em
   console.anthropic.com → *API Keys*. O uso é cobrado por chamada, à parte da assinatura do Claude.

## Passo a passo
1. Crie a conta em **render.com** com *Sign in with GitHub*.
2. Clique em **New → Blueprint** e escolha o repositório `claude_avaliacao`.
   O Render lê o arquivo `render.yaml` e já configura: Docker, disco em `/data`, verificação de saúde e região Virginia (EUA).
3. Ele vai pedir os valores:
   | Variável | O que colocar |
   |---|---|
   | `AVALIACAO_USUARIO` | seu usuário de login (ex.: `rafael`) |
   | `AVALIACAO_SENHA` | sua senha forte |
   | `ANTHROPIC_API_KEY` | a chave da API (ou deixe vazio) |
   O `AVALIACAO_SEGREDO` é gerado sozinho.
4. Clique em **Apply** e aguarde o build (3–5 min). Quando aparecer **Live**, abra o endereço
   `https://avaliacao-fisica-xxxx.onrender.com`.
5. Entre com usuário e senha. O **Exemplo João Silva** aparece para você testar; exclua-o quando quiser.

No celular: abra o mesmo endereço e use *Adicionar à tela inicial* para virar um ícone de app.
A câmera guiada funciona direto, porque o Render já fornece HTTPS válido.

## Atualizações
Cada `git push` na branch publicada faz o Render atualizar o sistema sozinho, e os dados no disco **são mantidos**.

## Online × local: como usar os dois
| | Online (Render) | Local (seu computador) |
|---|---|---|
| Acesso | qualquer lugar, com login | computador + celular no mesmo Wi‑Fi |
| Feedback e PDF | botões pela API | `/feedback` e `/importar` no Claude Code (sem custo de API) |
| Dados | disco do Render | pasta `clientes/` |

**Levar dados do online para o Claude Code no computador:**
1. Online → aluno → **Baixar pasta (.zip)** (ou **⭳ Baixar backup** para todos).
2. Local → barra lateral → **⭱ Importar backup** → escolha o .zip.
3. No Claude Code: `/feedback nome-do-aluno`.
4. Para mandar o feedback de volta: local → **⭳ Baixar backup** → online → **⭱ Importar backup**.

A importação **mescla**: arquivos novos entram, os existentes só são trocados se o do backup for mais recente,
e nada é apagado.

## Segurança e LGPD
- Login obrigatório: o servidor nem inicia online sem senha. Sessão de 30 dias com cookie protegido
  (`HttpOnly`, `Secure`, `SameSite`). Bloqueio após 10 senhas erradas em 15 minutos e proteção contra requisições de outros sites.
- **Faça backup semanal** (⭳ Baixar backup) e guarde num lugar seguro. O disco do Render tem snapshots diários,
  mas o backup é a sua garantia.
- Os dados ficam em servidores nos EUA (Render, região Virginia). Inclua no termo de consentimento do aluno que os
  dados de avaliação são armazenados em serviço de nuvem, no exterior, para fins de acompanhamento.
- Com a chave da API, os dados enviados para gerar feedback ou converter PDF passam pela Anthropic.
- Para trocar a senha: Render → serviço → *Environment* → edite `AVALIACAO_SENHA` → *Save* (reinicia sozinho).
  Para derrubar todas as sessões abertas, troque também o `AVALIACAO_SEGREDO`.
