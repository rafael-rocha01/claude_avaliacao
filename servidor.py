#!/usr/bin/env python3
"""
Servidor local da Avaliação Física Antropométrica.

Uso:
    python3 servidor.py                 # http://localhost:8080 (só neste computador)
    python3 servidor.py --rede          # libera na rede local (tirar fotos pelo celular)
    python3 servidor.py --porta 9000

Tudo é salvo em ./clientes/<slug-do-aluno>/ em arquivos JSON, Markdown e JPG,
para que o Claude Code (aberto nesta pasta) leia os dados e escreva feedbacks.
Só usa a biblioteca padrão do Python. O pacote `anthropic` é opcional e só é
necessário para o botão "Gerar feedback agora" dentro da interface.
"""
import argparse
import base64
import datetime as dt
import json
import mimetypes
import os
import re
import shutil
import sys
import unicodedata
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

RAIZ = Path(__file__).resolve().parent
WEB = RAIZ / "web"
CLIENTES = RAIZ / "clientes"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
ID_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]{1,3})?$")
FOTO_RE = re.compile(r"^(frente|costas|lateral-direita|lateral-esquerda|extra-[0-9]{1,2})$")
MODELO_CLAUDE = "claude-opus-5-5"


# ----------------------------------------------------------------- utilidades
def slugify(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t[:60] or "aluno"


def ler_json(p: Path, padrao=None):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return padrao


def gravar_json(p: Path, dados):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(p)


def agora():
    return dt.datetime.now().isoformat(timespec="seconds")


def pasta_cliente(slug: str) -> Path:
    if not SLUG_RE.match(slug or ""):
        raise ValueError("slug inválido")
    return CLIENTES / slug


def listar_json(pasta: Path):
    if not pasta.exists():
        return []
    itens = [ler_json(f) for f in sorted(pasta.glob("*.json"))]
    return [i for i in itens if i]


def listar_feedbacks(pasta: Path):
    fb = pasta / "feedback"
    if not fb.exists():
        return []
    out = []
    for f in sorted(fb.glob("*.md"), reverse=True):
        out.append({"arquivo": f.name, "conteudo": f.read_text(encoding="utf-8"),
                    "modificado": dt.datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="minutes")})
    return out


def listar_pedidos(pasta: Path):
    pd = pasta / "pedidos"
    if not pd.exists():
        return []
    return [{"arquivo": f.name, "conteudo": f.read_text(encoding="utf-8")} for f in sorted(pd.glob("*.md"))]


def listar_importacoes(pasta: Path):
    imp = pasta / "importacoes"
    if not imp.exists():
        return []
    convertidos = {}
    for a in listar_json(pasta / "avaliacoes"):
        arq = (a.get("origem") or {}).get("arquivo")
        if arq:
            convertidos[arq] = a.get("id")
    pendentes = " ".join(f.read_text(encoding="utf-8") for f in (pasta / "pedidos").glob("*.md")) if (pasta / "pedidos").exists() else ""
    out = []
    for f in sorted(imp.glob("*.pdf"), reverse=True):
        rel = f"importacoes/{f.name}"
        out.append({"arquivo": f.name, "caminho": rel, "tamanho_kb": round(f.stat().st_size / 1024),
                    "enviado": dt.datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="minutes"),
                    "avaliacao": convertidos.get(rel), "pendente": f.name in pendentes})
    return out


def dados_completos(slug: str):
    p = pasta_cliente(slug)
    if not (p / "cliente.json").exists():
        return None
    return {
        "cliente": ler_json(p / "cliente.json", {}),
        "anamnese": ler_json(p / "anamnese.json", {}),
        "avaliacoes": listar_json(p / "avaliacoes"),
        "acompanhamentos": listar_json(p / "acompanhamentos"),
        "feedbacks": listar_feedbacks(p),
        "pedidos": listar_pedidos(p),
        "importacoes": listar_importacoes(p),
    }


# ------------------------------------------------- RESUMO.md (para o Claude)
ROTULOS_CIRC = {
    "pescoco": "Pescoço", "ombro": "Ombro", "torax": "Tórax", "cintura": "Cintura",
    "abdomen": "Abdômen", "quadril": "Quadril",
    "braco_rel_d": "Braço relaxado D", "braco_rel_e": "Braço relaxado E",
    "braco_con_d": "Braço contraído D", "braco_con_e": "Braço contraído E",
    "antebraco_d": "Antebraço D", "antebraco_e": "Antebraço E",
    "coxa_prox_d": "Coxa proximal D", "coxa_prox_e": "Coxa proximal E",
    "coxa_med_d": "Coxa medial D", "coxa_med_e": "Coxa medial E",
    "panturrilha_d": "Panturrilha D", "panturrilha_e": "Panturrilha E",
}
ROTULOS_DOBRAS = {
    "triceps": "Tríceps", "biceps": "Bíceps", "subescapular": "Subescapular",
    "peitoral": "Peitoral", "axilar_media": "Axilar média", "suprailiaca": "Suprailíaca",
    "supraespinal": "Supraespinal", "abdominal": "Abdominal", "coxa": "Coxa", "panturrilha": "Panturrilha",
}


def _v(x, suf=""):
    if isinstance(x, float):
        x = round(x, 2)
    return "—" if x in (None, "", []) else f"{x}{suf}"


def gerar_resumo(slug: str):
    d = dados_completos(slug)
    if not d:
        return
    c, a = d["cliente"], d["anamnese"] or {}
    av = sorted(d["avaliacoes"], key=lambda x: x.get("id", ""))
    ac = sorted(d["acompanhamentos"], key=lambda x: x.get("id", ""))
    L = [f"# {c.get('nome', slug)} — resumo para análise",
         "",
         "> Arquivo gerado automaticamente pela interface a cada salvamento. Não edite à mão.",
         f"> Atualizado em {agora()}.",
         "",
         "## Cadastro",
         f"- Sexo: {_v(c.get('sexo'))} · Nascimento: {_v(c.get('nascimento'))} · Altura: {_v(c.get('altura'), ' cm')}",
         f"- Objetivo: {_v(c.get('objetivo'))}",
         f"- Observações: {_v(c.get('observacoes'))}",
         ""]
    if a:
        L += ["## Anamnese inicial", ""]
        for k, rot in [("queixa", "Queixa principal / motivo"), ("historico", "Histórico de saúde"),
                       ("doencas", "Doenças / condições"), ("medicamentos", "Medicamentos"),
                       ("cirurgias", "Cirurgias"), ("lesoes", "Lesões / dores"),
                       ("atividade", "Atividade física atual"), ("sono", "Sono"),
                       ("alimentacao", "Alimentação"), ("habitos", "Tabagismo / álcool"),
                       ("restricoes", "Restrições médicas"), ("observacoes", "Observações")]:
            if a.get(k):
                L.append(f"- **{rot}:** {a[k]}")
        parq = a.get("parq") or {}
        sim = [k for k, v in parq.items() if v == "sim"]
        L.append(f"- **PAR-Q:** {'respostas SIM em ' + ', '.join(sim) + ' → exigir liberação médica' if sim else 'todas NÃO' if parq else '—'}")
        L.append("")
    if av:
        L += ["## Evolução das avaliações", ""]
        cab = ["Indicador"] + [x["id"] for x in av]
        L.append("| " + " | ".join(cab) + " |")
        L.append("|" + "---|" * len(cab))

        def linha(rot, fn):
            L.append("| " + " | ".join([rot] + [_v(fn(x)) for x in av]) + " |")

        linha("Peso (kg)", lambda x: x.get("peso"))
        r = lambda x, k: (x.get("resultados") or {}).get(k)
        linha("IMC", lambda x: r(x, "imc"))
        linha("% Gordura", lambda x: r(x, "percentual_gordura"))
        linha("Protocolo", lambda x: r(x, "protocolo_nome"))
        linha("Massa gorda (kg)", lambda x: r(x, "massa_gorda"))
        linha("Massa magra (kg)", lambda x: r(x, "massa_magra"))
        linha("Σ dobras (mm)", lambda x: r(x, "soma_dobras"))
        linha("RCQ", lambda x: r(x, "rcq"))
        linha("RCEst", lambda x: r(x, "rce"))
        for k, rot in ROTULOS_CIRC.items():
            if any((x.get("circunferencias") or {}).get(k) for x in av):
                linha(f"{rot} (cm)", lambda x, k=k: (x.get("circunferencias") or {}).get(k))
        for k, rot in ROTULOS_DOBRAS.items():
            if any((x.get("dobras") or {}).get(k) for x in av):
                linha(f"Dobra {rot} (mm)", lambda x, k=k: (x.get("dobras") or {}).get(k))
        linha("PA média (mmHg)", lambda x: r(x, "pa_media"))
        linha("Classificação PA", lambda x: r(x, "pa_classe"))
        linha("FC repouso (bpm)", lambda x: (x.get("sinais") or {}).get("fc_repouso"))
        linha("SpO₂ (%)", lambda x: (x.get("sinais") or {}).get("spo2"))
        L.append("")
        for x in av:
            L.append(f"### Avaliação {x['id']}")
            if x.get("origem"):
                o = x["origem"]
                L.append(f"- Importada de {o.get('tipo', 'PDF')}: {o.get('arquivo', '')}"
                         + (" — **aguardando revisão do avaliador**" if x.get("revisar") else " — revisada"))
            if x.get("nutrio"):
                L.append("- Valores informados no PDF: " + ", ".join(f"{k}={v}" for k, v in x["nutrio"].items()))
            s = x.get("sinais") or {}
            if s.get("obs"):
                L.append(f"- Sinais vitais — obs: {s['obs']}")
            post = x.get("postural") or {}
            alter = [f"{k} ({v})" for k, v in (post.get("itens") or {}).items() if v and v != "normal"]
            L.append(f"- Postural: {', '.join(alter) if alter else 'sem alterações marcadas'}")
            if post.get("obs"):
                L.append(f"- Postural — obs: {post['obs']}")
            fotos = x.get("fotos") or {}
            if fotos:
                L.append("- Fotos: " + ", ".join(f"[{k}]({v})" for k, v in fotos.items()))
            if x.get("observacoes"):
                L.append(f"- Observações: {x['observacoes']}")
            L.append("")
    if ac:
        L += ["## Anamneses de acompanhamento", ""]
        for x in ac:
            L.append(f"### {x['id']}")
            for k, rot in [("energia", "Energia (0-10)"), ("sono_qualidade", "Sono (0-10)"),
                           ("sono_horas", "Horas de sono"), ("estresse", "Estresse (0-10)"),
                           ("dor_eva", "Dor EVA (0-10)"), ("dor_local", "Local da dor"),
                           ("adesao_treino", "Adesão ao treino (%)"), ("adesao_dieta", "Adesão à dieta (%)"),
                           ("treinos_semana", "Treinos/semana"), ("agua", "Água (L/dia)"),
                           ("intestino", "Intestino"), ("ciclo", "Ciclo menstrual"),
                           ("medicamentos", "Mudança em medicamentos"), ("intercorrencias", "Lesões/intercorrências"),
                           ("percepcao", "Percepção do aluno"), ("dificuldades", "Dificuldades"),
                           ("metas", "Metas até o próximo encontro"), ("observacoes", "Observações do avaliador")]:
                if x.get(k) not in (None, ""):
                    L.append(f"- **{rot}:** {x[k]}")
            L.append("")
    if d["feedbacks"]:
        L += ["## Feedbacks já escritos", ""] + [f"- feedback/{f['arquivo']}" for f in d["feedbacks"]] + [""]
    if d["pedidos"]:
        L += ["## ⚠️ Pedidos pendentes (feedback / importação de PDF)", ""] + [f"- pedidos/{f['arquivo']}" for f in d["pedidos"]] + [""]
    (pasta_cliente(slug) / "RESUMO.md").write_text("\n".join(L), encoding="utf-8")


# ------------------------------------------------------ chamadas à API (opcionais)
def _chamar_claude(conteudo):
    """Envia o conteúdo ao Claude com o CLAUDE.md como instrução. Retorna (texto, erro)."""
    try:
        import anthropic
    except ImportError:
        return None, ("Pacote 'anthropic' não instalado. Rode: pip install anthropic  "
                      "— ou use o Claude Code pela pasta do aluno (sem custo de API).")
    guia = (RAIZ / "CLAUDE.md").read_text(encoding="utf-8") if (RAIZ / "CLAUDE.md").exists() else ""
    try:
        client = anthropic.Anthropic()
        with client.beta.messages.stream(
            model=MODELO_CLAUDE,
            max_tokens=32000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            system=("Você é o assistente técnico de um profissional de educação física que faz avaliação "
                    "física antropométrica. Siga estas instruções do projeto:\n\n" + guia),
            messages=[{"role": "user", "content": conteudo}],
        ) as stream:
            msg = stream.get_final_message()
    except anthropic.AuthenticationError:
        return None, "Chave da API inválida ou ausente (defina ANTHROPIC_API_KEY)."
    except anthropic.RateLimitError:
        return None, "Limite de uso da API atingido. Tente de novo em instantes."
    except anthropic.APIStatusError as e:
        return None, f"Erro da API ({e.status_code}): {e.message}"
    except anthropic.APIConnectionError:
        return None, "Sem conexão com a API da Anthropic."
    if msg.stop_reason == "refusal":
        return None, "O modelo recusou o pedido."
    texto = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
    return (texto, None) if texto else (None, "Resposta vazia.")


def gerar_feedback_api(slug: str, instrucao: str):
    p = pasta_cliente(slug)
    gerar_resumo(slug)
    resumo = (p / "RESUMO.md").read_text(encoding="utf-8")
    conteudo = []
    # fotos da última avaliação, para leitura postural
    av = sorted(listar_json(p / "avaliacoes"), key=lambda x: x.get("id", ""))
    if av:
        for pos, rel in (av[-1].get("fotos") or {}).items():
            f = (p / rel).resolve()
            if f.is_file() and str(f).startswith(str(p.resolve())):
                conteudo.append({"type": "text", "text": f"Foto da última avaliação — {pos}:"})
                conteudo.append({"type": "image", "source": {
                    "type": "base64", "media_type": "image/jpeg",
                    "data": base64.standard_b64encode(f.read_bytes()).decode()}})
    conteudo.append({"type": "text", "text":
                     f"{resumo}\n\n---\nPedido do avaliador: {instrucao or 'Feedback completo do momento atual.'}\n\n"
                     "Escreva o feedback em Markdown seguindo o formato definido nas instruções."})
    texto, erro = _chamar_claude(conteudo)
    if erro:
        return None, erro
    nome = f"{dt.date.today().isoformat()}-api-{dt.datetime.now().strftime('%H%M%S')}.md"
    (p / "feedback").mkdir(exist_ok=True)
    (p / "feedback" / nome).write_text(texto + "\n", encoding="utf-8")
    gerar_resumo(slug)
    return nome, None


def _extrair_json(texto: str):
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", texto, re.S) or re.search(r"(\{.*\})", texto, re.S)
    if not m:
        raise ValueError("a resposta não trouxe JSON")
    return json.loads(m.group(1))


def converter_pdf_api(slug: str, arquivo: str):
    """Converte um PDF do Nutrio em avaliacoes/<id>.json usando a API."""
    p = pasta_cliente(slug)
    pdf = p / "importacoes" / arquivo
    if not pdf.is_file():
        return None, "PDF não encontrado"
    cliente = ler_json(p / "cliente.json", {})
    conteudo = [
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                        "data": base64.standard_b64encode(pdf.read_bytes()).decode()}},
        {"type": "text", "text": (
            f"Cadastro do aluno: {json.dumps(cliente, ensure_ascii=False)}\n"
            f"Arquivo: importacoes/{arquivo}\n\n"
            "Converta este PDF de avaliação do Nutrio para o formato do sistema, seguindo a seção "
            "'Importar PDF do Nutrio' das instruções. Responda APENAS com o objeto JSON da avaliação "
            "dentro de um bloco ```json```.")},
    ]
    texto, erro = _chamar_claude(conteudo)
    if erro:
        return None, erro
    try:
        av = _extrair_json(texto)
    except (ValueError, json.JSONDecodeError) as e:
        return None, f"Não consegui ler o JSON da resposta: {e}"
    data = str(av.get("data") or dt.date.today().isoformat())[:10]
    if not ID_RE.match(data):
        data = dt.date.today().isoformat()
    ident, i = data, 2
    while (p / "avaliacoes" / f"{ident}.json").exists():
        ident, i = f"{data}-{i}", i + 1
    av.update({"id": ident, "data": data, "revisar": True,
               "origem": {"tipo": "nutrio-pdf", "arquivo": f"importacoes/{arquivo}", "via": "api",
                          "convertido_em": agora()}})
    av.pop("resultados", None)
    gravar_json(p / "avaliacoes" / f"{ident}.json", av)
    for ped in (p / "pedidos").glob("*.md"):
        if arquivo in ped.read_text(encoding="utf-8"):
            ped.unlink()
    gerar_resumo(slug)
    return ident, None


# ------------------------------------------------------------------- HTTP
class Handler(SimpleHTTPRequestHandler):
    server_version = "AvaliacaoFisica/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    # ---- respostas
    def _json(self, dados, status=200):
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def _erro(self, msg, status=400):
        self._json({"erro": msg}, status)

    def _arquivo(self, caminho: Path):
        if not caminho.is_file():
            return self._erro("não encontrado", 404)
        tipo = mimetypes.guess_type(str(caminho))[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo in ("application/javascript", "application/json"):
            tipo += "; charset=utf-8"
        dados = caminho.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dados)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(dados)

    def _corpo(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 40 * 1024 * 1024:
            raise ValueError("corpo grande demais")
        return json.loads(self.rfile.read(n) or b"{}")

    # ---- rotas
    def do_GET(self):
        url = urlparse(self.path)
        partes = [unquote(x) for x in url.path.strip("/").split("/") if x]
        try:
            if not partes:
                return self._arquivo(WEB / "index.html")
            if partes[0] == "api":
                return self._api_get(partes[1:])
            if partes[0] == "clientes" and len(partes) >= 2:
                base = pasta_cliente(partes[1]).resolve()
                alvo = (base / "/".join(partes[2:])).resolve()
                if not str(alvo).startswith(str(base)):
                    return self._erro("proibido", 403)
                return self._arquivo(alvo)
            alvo = (WEB / "/".join(partes)).resolve()
            if not str(alvo).startswith(str(WEB.resolve())):
                return self._erro("proibido", 403)
            return self._arquivo(alvo)
        except ValueError as e:
            return self._erro(str(e))

    def _api_get(self, p):
        if p == ["clientes"]:
            out = []
            for d in sorted(CLIENTES.glob("*/cliente.json")):
                c = ler_json(d) or {}
                pasta = d.parent
                avs = sorted(f.stem for f in (pasta / "avaliacoes").glob("*.json")) if (pasta / "avaliacoes").exists() else []
                out.append({**c, "ultima_avaliacao": avs[-1] if avs else None,
                            "n_avaliacoes": len(avs),
                            "n_feedbacks": len(list((pasta / "feedback").glob("*.md"))) if (pasta / "feedback").exists() else 0,
                            "pedidos_pendentes": len(list((pasta / "pedidos").glob("*.md"))) if (pasta / "pedidos").exists() else 0})
            out.sort(key=lambda x: x.get("nome", "").lower())
            return self._json(out)
        if len(p) == 2 and p[0] == "clientes":
            d = dados_completos(p[1])
            return self._json(d) if d else self._erro("aluno não encontrado", 404)
        if p == ["status"]:
            try:
                import anthropic  # noqa: F401
                sdk = True
            except ImportError:
                sdk = False
            return self._json({"sdk": sdk, "chave": bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")),
                               "pasta": str(CLIENTES)})
        return self._erro("rota desconhecida", 404)

    def do_POST(self):
        self._mutacao("POST")

    def do_PUT(self):
        self._mutacao("PUT")

    def do_DELETE(self):
        self._mutacao("DELETE")

    def _mutacao(self, metodo):
        partes = [unquote(x) for x in urlparse(self.path).path.strip("/").split("/") if x]
        try:
            corpo = self._corpo() if metodo != "DELETE" else {}
            if partes[:1] != ["api"]:
                return self._erro("rota desconhecida", 404)
            p = partes[1:]
            # criar aluno
            if metodo == "POST" and p == ["clientes"]:
                nome = (corpo.get("nome") or "").strip()
                if not nome:
                    return self._erro("informe o nome")
                base = slug = slugify(nome)
                i = 2
                while (CLIENTES / slug).exists():
                    slug, i = f"{base}-{i}", i + 1
                c = {**corpo, "nome": nome, "slug": slug, "criado_em": agora()}
                gravar_json(CLIENTES / slug / "cliente.json", c)
                for sub in ("avaliacoes", "acompanhamentos", "fotos", "feedback", "pedidos", "importacoes"):
                    (CLIENTES / slug / sub).mkdir(parents=True, exist_ok=True)
                gerar_resumo(slug)
                return self._json(c, 201)
            if len(p) < 2 or p[0] != "clientes":
                return self._erro("rota desconhecida", 404)
            slug = p[1]
            pasta = pasta_cliente(slug)
            if not (pasta / "cliente.json").exists():
                return self._erro("aluno não encontrado", 404)
            resto = p[2:]

            if resto == [] and metodo == "DELETE":
                lixeira = RAIZ / ".lixeira"
                lixeira.mkdir(exist_ok=True)
                shutil.move(str(pasta), str(lixeira / f"{slug}-{dt.datetime.now():%Y%m%d%H%M%S}"))
                return self._json({"ok": True})
            if resto == ["cliente"] and metodo == "PUT":
                atual = ler_json(pasta / "cliente.json", {})
                gravar_json(pasta / "cliente.json", {**atual, **corpo, "slug": slug, "atualizado_em": agora()})
            elif resto == ["anamnese"] and metodo == "PUT":
                gravar_json(pasta / "anamnese.json", {**corpo, "atualizado_em": agora()})
            elif len(resto) == 2 and resto[0] in ("avaliacoes", "acompanhamentos"):
                ident = resto[1]
                if not ID_RE.match(ident):
                    return self._erro("id inválido (use AAAA-MM-DD)")
                arq = pasta / resto[0] / f"{ident}.json"
                if metodo == "DELETE":
                    arq.unlink(missing_ok=True)
                    if resto[0] == "avaliacoes":
                        shutil.rmtree(pasta / "fotos" / ident, ignore_errors=True)
                else:
                    gravar_json(arq, {**corpo, "id": ident, "atualizado_em": agora()})
            elif len(resto) == 4 and resto[0] == "fotos" and metodo in ("POST", "DELETE"):
                ident, pos = resto[1], resto[2]
                if not ID_RE.match(ident) or not FOTO_RE.match(pos) or resto[3] != "imagem":
                    return self._erro("foto inválida")
                arq = pasta / "fotos" / ident / f"{pos}.jpg"
                if metodo == "DELETE":
                    arq.unlink(missing_ok=True)
                    return self._json({"ok": True})
                b64 = (corpo.get("base64") or "").split(",")[-1]
                arq.parent.mkdir(parents=True, exist_ok=True)
                arq.write_bytes(base64.b64decode(b64))
                return self._json({"caminho": f"fotos/{ident}/{pos}.jpg"})
            elif resto == ["importacoes"] and metodo == "POST":
                nome_orig = Path(corpo.get("nome") or "avaliacao.pdf").stem
                b64 = (corpo.get("base64") or "").split(",")[-1]
                dados = base64.b64decode(b64)
                if not dados.startswith(b"%PDF"):
                    return self._erro("o arquivo não é um PDF")
                ts = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
                nome = f"{ts}-{slugify(nome_orig)[:40]}.pdf"
                (pasta / "importacoes").mkdir(exist_ok=True)
                (pasta / "importacoes" / nome).write_bytes(dados)
                txt = (f"# Pedido de importação — {ts}\n\n"
                       f"- Aluno: {slug}\n- Tipo: importar-pdf\n- Arquivo: importacoes/{nome}\n"
                       f"- Origem: {corpo.get('origem') or 'Nutrio'}\n\n"
                       f"## O que fazer\n\nConverter o PDF em avaliacoes/<data>.json conforme a seção "
                       f"'Importar PDF do Nutrio' do CLAUDE.md.\n"
                       + (f"\nObservação do avaliador: {corpo['instrucao']}\n" if corpo.get("instrucao") else ""))
                (pasta / "pedidos").mkdir(exist_ok=True)
                (pasta / "pedidos" / f"{ts}.md").write_text(txt, encoding="utf-8")
                gerar_resumo(slug)
                return self._json({"arquivo": nome}, 201)
            elif len(resto) == 2 and resto[0] == "importacoes" and metodo == "DELETE":
                if not re.match(r"^[A-Za-z0-9_.-]+\.pdf$", resto[1]):
                    return self._erro("arquivo inválido")
                (pasta / "importacoes" / resto[1]).unlink(missing_ok=True)
                for ped in (pasta / "pedidos").glob("*.md"):
                    if resto[1] in ped.read_text(encoding="utf-8"):
                        ped.unlink()
            elif len(resto) == 3 and resto[0] == "importacoes" and resto[2] == "converter" and metodo == "POST":
                if not re.match(r"^[A-Za-z0-9_.-]+\.pdf$", resto[1]):
                    return self._erro("arquivo inválido")
                ident, erro = converter_pdf_api(slug, resto[1])
                if erro:
                    return self._erro(erro, 502)
                return self._json({"avaliacao": ident})
            elif resto == ["pedidos"] and metodo == "POST":
                ts = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
                txt = (f"# Pedido de feedback — {ts}\n\n"
                       f"- Aluno: {slug}\n- Tipo: {corpo.get('tipo') or 'completo'}\n"
                       f"- Referência: {corpo.get('referencia') or 'última avaliação/acompanhamento'}\n\n"
                       f"## O que o avaliador quer\n\n{corpo.get('instrucao') or 'Feedback completo do momento atual.'}\n")
                (pasta / "pedidos").mkdir(exist_ok=True)
                (pasta / "pedidos" / f"{ts}.md").write_text(txt, encoding="utf-8")
            elif len(resto) == 2 and resto[0] == "pedidos" and metodo == "DELETE":
                if not re.match(r"^[0-9-]+\.md$", resto[1]):
                    return self._erro("arquivo inválido")
                (pasta / "pedidos" / resto[1]).unlink(missing_ok=True)
            elif len(resto) == 2 and resto[0] == "feedback" and metodo in ("PUT", "DELETE"):
                if not re.match(r"^[A-Za-z0-9_.-]+\.md$", resto[1]):
                    return self._erro("arquivo inválido")
                arq = pasta / "feedback" / resto[1]
                if metodo == "DELETE":
                    arq.unlink(missing_ok=True)
                else:
                    arq.write_text(corpo.get("conteudo", ""), encoding="utf-8")
            elif resto == ["feedback", "gerar"] and metodo == "POST":
                nome, erro = gerar_feedback_api(slug, corpo.get("instrucao", ""))
                if erro:
                    return self._erro(erro, 502)
                return self._json({"arquivo": nome})
            else:
                return self._erro("rota desconhecida", 404)
            gerar_resumo(slug)
            return self._json({"ok": True})
        except (ValueError, json.JSONDecodeError) as e:
            return self._erro(str(e))


def ip_local():
    """IP deste computador na rede local (para abrir no celular)."""
    import socket
    sk = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sk.connect(("10.255.255.255", 1))
        return sk.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sk.close()


def preparar_certificado(ip: str):
    """Certificado autoassinado em .certificado/ (o celular só libera a câmera ao vivo em HTTPS)."""
    import subprocess
    pasta = RAIZ / ".certificado"
    cert, chave = pasta / "cert.pem", pasta / "chave.pem"
    marca = pasta / "ip.txt"
    if cert.exists() and chave.exists() and marca.exists() and marca.read_text().strip() == ip:
        return cert, chave
    if not shutil.which("openssl"):
        sys.exit("Para --https é preciso o 'openssl' instalado (no Windows ele vem com o Git for Windows),\n"
                 f"ou coloque um certificado próprio em {cert} e {chave}.")
    pasta.mkdir(exist_ok=True)
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "825",
                    "-keyout", str(chave), "-out", str(cert), "-subj", "/CN=avaliacao-fisica-local",
                    "-addext", f"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{ip}"],
                   check=True, capture_output=True)
    marca.write_text(ip)
    return cert, chave


def main():
    ap = argparse.ArgumentParser(description="Servidor da avaliação física")
    ap.add_argument("--porta", type=int, default=8080)
    ap.add_argument("--rede", action="store_true", help="aceitar conexões da rede local (celular/tablet)")
    ap.add_argument("--https", action="store_true",
                    help="HTTPS com certificado local (necessário para a câmera guiada no celular)")
    a = ap.parse_args()
    CLIENTES.mkdir(exist_ok=True)
    for d in CLIENTES.glob("*/cliente.json"):
        gerar_resumo(d.parent.name)
    host = "0.0.0.0" if a.rede else "127.0.0.1"
    srv = ThreadingHTTPServer((host, a.porta), Handler)
    esquema = "http"
    ip = ip_local()
    if a.https:
        import ssl
        cert, chave = preparar_certificado(ip)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(cert), str(chave))
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        esquema = "https"
    print(f"Avaliação Física rodando em {esquema}://localhost:{a.porta}")
    if a.rede:
        print(f"No celular/tablet (mesmo Wi-Fi): {esquema}://{ip}:{a.porta}")
        if a.https:
            print("  O navegador vai avisar que o certificado não é confiável: toque em 'Avançado' > 'Continuar'.")
        else:
            print("  Dica: use também --https para liberar a câmera guiada (silhueta) no celular.")
    print(f"Dados em: {CLIENTES}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")


if __name__ == "__main__":
    main()
