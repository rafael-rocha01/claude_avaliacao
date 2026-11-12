# Avaliação Física — instruções para o Claude

Este repositório é a interface de avaliação física antropométrica de um profissional de
educação física. A interface (`servidor.py` + `web/`) grava tudo em `clientes/<slug>/`.
Seu papel aqui é **ler a pasta do aluno e escrever feedbacks técnicos** que voltam para a
interface automaticamente.

## Estrutura da pasta de cada aluno

```
clientes/<slug>/
├── RESUMO.md                 ← COMECE POR AQUI: tabela de evolução + anamneses (gerado pela interface)
├── cliente.json              ← cadastro (nome, sexo M/F, nascimento, altura, objetivo)
├── anamnese.json             ← anamnese inicial + PAR-Q (parq.q1..q7 = "sim"/"nao")
├── avaliacoes/AAAA-MM-DD.json← peso, circunferencias{}, dobras{}, protocolo, sinais{pa[], spo2, fc_repouso…},
│                               postural{itens{}, obs}, fotos{}, resultados{} (já calculados)
├── acompanhamentos/AAAA-MM-DD.json ← anamnese de acompanhamento (escalas 0-10, adesão %, relato)
├── fotos/<id-avaliacao>/{frente,costas,lateral-direita,lateral-esquerda}.jpg
├── importacoes/*.pdf         ← PDFs de avaliação anexados (Nutrio etc.) para converter
├── pedidos/*.md              ← fila de pedidos da interface (feedback ou importar-pdf)
└── feedback/*.md             ← ONDE VOCÊ ESCREVE. Tudo aqui aparece na aba "Feedback Claude"
```

Unidades: circunferências em cm, dobras em mm, peso em kg, PA em mmHg, SpO₂ em %.
`resultados` já traz IMC, %G (protocolo indicado em `protocolo_nome`), massa gorda/magra,
RCQ, RCEst, PA média e classificações — confira, mas não recalcule à toa.

## Fluxo quando pedirem feedback (`/feedback <slug>` ou "analise o aluno X")

1. Leia `RESUMO.md`, depois os JSON relevantes e o(s) pedido(s) em `pedidos/`.
   Pedidos com `Tipo: importar-pdf` seguem a seção “Importar PDF do Nutrio” (faça-os antes do feedback).
2. Se houver fotos e o pedido envolver postura/antes-e-depois, **abra as imagens** (Read) e
   compare com a avaliação postural marcada. Para antes-e-depois anotado, use a skill
   `antes-e-depois-aluno` se estiver disponível.
3. Escreva `feedback/AAAA-MM-DD-<tipo>.md` (data de hoje; se já existir, acrescente `-2`).
4. **Apague o arquivo do pedido atendido** em `pedidos/` (é o sinal de "concluído" na interface).
5. Não edite `RESUMO.md` à mão nem altere medidas nos JSON — dados são do avaliador.
   Se achar um valor suspeito (ex.: dobra 10× maior que a anterior), aponte no feedback.

## Importar PDF do Nutrio (`/importar <slug>` ou pedido com `Tipo: importar-pdf`)

O avaliador anexa na aba **Importar PDF** a avaliação exportada do Nutrio (ou de outro
sistema). O PDF fica em `importacoes/` e um pedido é criado em `pedidos/`. Para cada PDF:

1. Leia o PDF inteiro (Read com `pages` se tiver mais de 10 páginas). Se o PDF tiver várias
   avaliações (relatório de evolução), crie **um JSON por data**.
2. Grave `avaliacoes/<AAAA-MM-DD>.json` com a data **da avaliação no PDF** (não a de hoje).
   Se já existir uma avaliação nessa data: se ela tiver o mesmo `origem.arquivo`, sobrescreva;
   se não, use `<data>-2`. Nunca apague nem altere avaliações feitas na interface.
3. Use exatamente este formato (só inclua campos que existem no PDF; números com ponto decimal,
   sem unidade; não invente valores):

```json
{
  "id": "2026-10-03", "data": "2026-10-03",
  "peso": 82.4, "altura": 175,
  "protocolo": "jp7",
  "circunferencias": { "cintura": 84.0, "braco_con_d": 36.5 },
  "dobras": { "triceps": 12.0, "peitoral": 9.0 },
  "sinais": { "pa": [{ "sis": 120, "dia": 80 }], "fc_repouso": 68, "spo2": 98, "obs": "" },
  "postural": { "itens": { "Cabeça anteriorizada": "leve" }, "obs": "" },
  "fotos": {},
  "observacoes": "texto livre do PDF que não tem campo próprio",
  "nutrio": { "protocolo": "Pollock 7 dobras", "percentual_gordura": 14.2, "massa_magra": 70.7,
              "massa_gorda": 11.7, "densidade": 1.0663, "imc": 26.9, "tmb": 1820 },
  "campos_nao_mapeados": "Ex.: bioimpedância água corporal 55%, diâmetro de fêmur 9,8 cm",
  "origem": { "tipo": "nutrio-pdf", "arquivo": "importacoes/<nome>.pdf", "via": "claude-code" },
  "revisar": true
}
```

- **Não escreva `resultados`**: a interface recalcula ao abrir o aluno. Os números que o Nutrio
  calculou vão em `nutrio` (chaves livres em snake_case), para comparação.
- `protocolo`: `jp7` (Pollock/Jackson-Pollock 7 dobras), `jp3` (Pollock 3 dobras), `durnin`
  (Durnin & Womersley), `faulkner`. Se o Nutrio usou outro (Petroski, Guedes, Pollock 9,
  bioimpedância…), escolha um dos quatro para o qual **todas** as dobras existam no PDF; se nenhum
  fechar, use `""` e diga em `observacoes` qual foi o protocolo original.
- Chaves de **circunferências** (cm): `pescoco, ombro, torax, cintura, abdomen, quadril,
  braco_rel_d/e, braco_con_d/e, antebraco_d/e, coxa_prox_d/e, coxa_med_d/e, panturrilha_d/e`.
  Equivalências comuns: “braço relaxado/contraído direito” → `braco_rel_d`/`braco_con_d`;
  “coxa superior/proximal” → `coxa_prox_*`; “coxa medial/média” → `coxa_med_*`; “tórax/peitoral”
  → `torax`; “abdominal/umbilical” → `abdomen`. Lado não informado → considere direito (`_d`).
  Coxa distal ou outras medidas sem campo → `campos_nao_mapeados`.
- Chaves de **dobras** (mm): `triceps, biceps, subescapular, peitoral` (= torácica/peitoral),
  `axilar_media, suprailiaca, supraespinal, abdominal, coxa, panturrilha` (= panturrilha medial).
  Atenção: no Nutrio “suprailíaca” e “supraespinal” são dobras diferentes. Se o PDF trouxer 2–3
  medidas da mesma dobra, use a média (ou a mediana, se forem 3) e anote em `observacoes`.
- **Pressão**: `"120x80"` → `{"sis":120,"dia":80}`. Anamnese/questionário que vier no PDF: se
  `anamnese.json` estiver vazio, preencha-o; se já existir, **não sobrescreva**; ponha o resumo
  em `observacoes` da avaliação.
- Se o peso ou a altura do cadastro estiverem vazios e o PDF trouxer, pode completar `cliente.json`
  (só campos vazios).
4. Apague o pedido atendido em `pedidos/`.
5. Responda ao avaliador com uma tabela curta: campos importados, protocolo usado, diferença entre o
   %G do Nutrio e o do sistema (se o protocolo for o mesmo devem bater ±0,5 pp; se não baterem,
   avise) e o que ficou em `campos_nao_mapeados`. A interface mostra a avaliação com o selo
   **revisar** até ele conferir e salvar.

## Formato do feedback

```markdown
# Feedback — <Nome> — <data>
> Tipo: <completo|avaliação|acompanhamento|fotos|aluno|treino> · Referência: <id>

## Resumo em 3 linhas
## O que evoluiu        (números: valor anterior → atual, Δ e período)
## Pontos de atenção    (PA, SpO₂, dor, PAR-Q, adesão, dados inconsistentes)
## Postura              (achados das fotos × checklist, se houver)
## Sugestões para o avaliador   (ajustes de treino, reavaliações, encaminhamentos)
## Mensagem para o aluno        (tom motivador, linguagem simples, pronta para WhatsApp)
```

Para o tipo `aluno`, entregue só a mensagem. Seja direto e use os números reais.

## Limites técnicos e de segurança

- Você apoia um profissional; **não faça diagnóstico médico**. Encaminhe quando:
  PA ≥ 140/90 repetida (≥ 180/110 = não treinar e procurar atendimento), SpO₂ ≤ 92% em
  repouso, dor EVA ≥ 7 ou dor que piora, qualquer "sim" no PAR-Q sem liberação médica.
- Lembre a margem de erro: dobras cutâneas ±3–4 pp de %G; compare sempre o mesmo protocolo
  e o mesmo avaliador. Variações < 1 cm em circunferência podem ser erro de medida.
- Dados de saúde são sensíveis (LGPD). Não envie conteúdo da pasta para serviços externos.
- Escreva em português do Brasil.
