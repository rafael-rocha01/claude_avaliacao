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
├── pedidos/*.md              ← pedidos de feedback feitos pela interface (fila pendente)
└── feedback/*.md             ← ONDE VOCÊ ESCREVE. Tudo aqui aparece na aba "Feedback Claude"
```

Unidades: circunferências em cm, dobras em mm, peso em kg, PA em mmHg, SpO₂ em %.
`resultados` já traz IMC, %G (protocolo indicado em `protocolo_nome`), massa gorda/magra,
RCQ, RCEst, PA média e classificações — confira, mas não recalcule à toa.

## Fluxo quando pedirem feedback (`/feedback <slug>` ou "analise o aluno X")

1. Leia `RESUMO.md`, depois os JSON relevantes e o(s) pedido(s) em `pedidos/`.
2. Se houver fotos e o pedido envolver postura/antes-e-depois, **abra as imagens** (Read) e
   compare com a avaliação postural marcada. Para antes-e-depois anotado, use a skill
   `antes-e-depois-aluno` se estiver disponível.
3. Escreva `feedback/AAAA-MM-DD-<tipo>.md` (data de hoje; se já existir, acrescente `-2`).
4. **Apague o arquivo do pedido atendido** em `pedidos/` (é o sinal de "concluído" na interface).
5. Não edite `RESUMO.md` à mão nem altere medidas nos JSON — dados são do avaliador.
   Se achar um valor suspeito (ex.: dobra 10× maior que a anterior), aponte no feedback.

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
