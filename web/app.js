/* Interface da avaliação física — JavaScript puro, sem dependências. */
(() => {
'use strict';

// ------------------------------------------------------------ constantes
const CIRC = [
  ['pescoco', 'Pescoço'], ['ombro', 'Ombro'], ['torax', 'Tórax'], ['cintura', 'Cintura'],
  ['abdomen', 'Abdômen'], ['quadril', 'Quadril'],
  ['braco_rel_d', 'Braço relaxado D'], ['braco_rel_e', 'Braço relaxado E'],
  ['braco_con_d', 'Braço contraído D'], ['braco_con_e', 'Braço contraído E'],
  ['antebraco_d', 'Antebraço D'], ['antebraco_e', 'Antebraço E'],
  ['coxa_prox_d', 'Coxa proximal D'], ['coxa_prox_e', 'Coxa proximal E'],
  ['coxa_med_d', 'Coxa medial D'], ['coxa_med_e', 'Coxa medial E'],
  ['panturrilha_d', 'Panturrilha D'], ['panturrilha_e', 'Panturrilha E'],
];
const DOBRAS = [
  ['triceps', 'Tríceps'], ['biceps', 'Bíceps'], ['subescapular', 'Subescapular'], ['peitoral', 'Peitoral'],
  ['axilar_media', 'Axilar média'], ['suprailiaca', 'Suprailíaca'], ['supraespinal', 'Supraespinal'],
  ['abdominal', 'Abdominal'], ['coxa', 'Coxa'], ['panturrilha', 'Panturrilha'],
];
const POSICOES_FOTO = [['frente', 'Frente'], ['costas', 'Costas'], ['lateral-direita', 'Lateral direita'], ['lateral-esquerda', 'Lateral esquerda']];
const POSTURAL = {
  'Vista anterior': ['Inclinação/rotação da cabeça', 'Assimetria de ombros (elevação)', 'Assimetria do triângulo de Tales',
    'Desnível de EIAS (pelve)', 'Joelho valgo', 'Joelho varo', 'Patelas convergentes/divergentes',
    'Pés abduzidos/aduzidos', 'Hálux valgo'],
  'Vista lateral': ['Cabeça anteriorizada', 'Ombros protrusos', 'Hipercifose torácica', 'Retificação torácica',
    'Hiperlordose lombar', 'Retificação lombar', 'Anteversão pélvica', 'Retroversão pélvica',
    'Joelho recurvato (hiperextensão)', 'Joelho flexo', 'Abdome protuso'],
  'Vista posterior': ['Escápula alada', 'Escápulas abduzidas', 'Escoliose (desvio lateral)', 'Gibosidade (teste de Adams)',
    'Assimetria de pregas glúteas/poplíteas', 'Calcâneo valgo', 'Calcâneo varo', 'Pé plano', 'Pé cavo'],
};
const GRAUS = ['normal', 'leve', 'moderado', 'acentuado'];
const PARQ = [
  'Algum médico já disse que você tem problema de coração e que só deve fazer atividade física recomendada por médico?',
  'Você sente dor no peito quando pratica atividade física?',
  'No último mês, você teve dor no peito sem estar fazendo atividade física?',
  'Você perde o equilíbrio por tontura ou já perdeu a consciência?',
  'Você tem algum problema ósseo ou articular que poderia piorar com atividade física?',
  'Você toma remédio para pressão arterial ou para o coração?',
  'Existe alguma outra razão pela qual você não deveria praticar atividade física?',
];
// métricas da evolução: [rótulo, getter, unidade, direção: -1 menor é melhor, 1 maior é melhor, 0 neutro]
const METRICAS = [
  ['Peso', a => a.peso, 'kg', 0],
  ['% Gordura', a => a.resultados?.percentual_gordura, '%', -1],
  ['Massa magra', a => a.resultados?.massa_magra, 'kg', 1],
  ['Massa gorda', a => a.resultados?.massa_gorda, 'kg', -1],
  ['Σ dobras', a => a.resultados?.soma_dobras ?? a.resultados?.soma_todas_dobras, 'mm', -1],
  ['IMC', a => a.resultados?.imc, '', 0],
  ['Cintura', a => a.circunferencias?.cintura, 'cm', -1],
  ['Abdômen', a => a.circunferencias?.abdomen, 'cm', -1],
  ['Quadril', a => a.circunferencias?.quadril, 'cm', 0],
  ['Braço contraído D', a => a.circunferencias?.braco_con_d, 'cm', 1],
  ['Coxa medial D', a => a.circunferencias?.coxa_med_d, 'cm', 0],
  ['RCQ', a => a.resultados?.rcq, '', -1],
  ['PA sistólica', a => a.resultados?.pa_sis, 'mmHg', -1],
  ['PA diastólica', a => a.resultados?.pa_dia, 'mmHg', -1],
  ['FC repouso', a => a.sinais?.fc_repouso, 'bpm', -1],
  ['SpO₂', a => a.sinais?.spo2, '%', 1],
];

// ------------------------------------------------------------ estado
const S = { alunos: [], slug: null, d: null, aba: 'painel', rascunho: null, acomp: null, status: {} };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fmtData = s => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
const n = Calc.num;
const fmt = (v, c = 1) => v === null || v === undefined || v === '' ? '—' : (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: c }) : esc(v));
const clone = o => JSON.parse(JSON.stringify(o ?? {}));

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('ver');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('ver'), ms);
}

async function api(metodo, caminho, corpo) {
  const r = await fetch('/api/' + caminho, {
    method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || r.statusText);
  return j;
}

const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setP(o, p, v) {
  const ks = p.split('.'); let a = o;
  ks.slice(0, -1).forEach(k => { if (typeof a[k] !== 'object' || a[k] === null) a[k] = /^\d+$/.test(k) ? [] : {}; a = a[k]; });
  a[ks.at(-1)] = v;
}
/* liga inputs [data-k] de um container a um objeto */
function ligar(cont, obj, aoMudar) {
  $$('[data-k]', cont).forEach(i => {
    const v = getP(obj, i.dataset.k);
    if (i.type === 'checkbox') i.checked = !!v;
    else if (i.type === 'radio') i.checked = v === i.value;
    else if (v !== undefined && v !== null) i.value = v;
    i.addEventListener(i.tagName === 'SELECT' || i.type === 'radio' || i.type === 'checkbox' ? 'change' : 'input', () => {
      let val = i.type === 'checkbox' ? i.checked : i.value;
      if (i.type === 'number') val = i.value === '' ? null : +i.value;
      setP(obj, i.dataset.k, val);
      aoMudar && aoMudar(i);
    });
  });
}
function escala(k, valor) {
  return `<div class="escala" data-escala="${k}">${[...Array(11).keys()].map(i =>
    `<button type="button" data-v="${i}" class="${valor === i ? 'sel' : ''}">${i}</button>`).join('')}</div>`;
}
function ligarEscalas(cont, obj) {
  $$('[data-escala]', cont).forEach(e => e.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const v = +b.dataset.v, k = e.dataset.escala;
    const novo = getP(obj, k) === v ? null : v;
    setP(obj, k, novo);
    $$('button', e).forEach(x => x.classList.toggle('sel', +x.dataset.v === novo));
  }));
}
const campoNum = (k, rot, ex = '') => `<label>${rot}<input type="number" step="0.1" inputmode="decimal" data-k="${k}" ${ex}></label>`;

// ------------------------------------------------------------ alunos
async function carregarAlunos() {
  S.alunos = await api('GET', 'clientes');
  renderLista();
}
function renderLista() {
  const q = $('#busca').value.trim().toLowerCase();
  $('#listaAlunos').innerHTML = S.alunos.filter(a => a.nome.toLowerCase().includes(q)).map(a => `
    <li data-slug="${a.slug}" class="${a.slug === S.slug ? 'ativo' : ''}">
      <span class="nome">${esc(a.nome)}</span>
      <span class="meta">${a.n_avaliacoes} avaliação(ões) · última ${fmtData(a.ultima_avaliacao)}
        ${a.pedidos_pendentes ? '<span class="selo">feedback pendente</span>' : ''}</span>
    </li>`).join('') || '<li class="meta">Nenhum aluno ainda.</li>';
}
async function abrirAluno(slug, aba) {
  S.slug = slug; S.rascunho = null; S.acomp = null;
  S.d = await api('GET', 'clientes/' + slug);
  await completarResultados();
  if (aba) S.aba = aba;
  history.replaceState(null, '', '#' + slug + '/' + S.aba);
  renderLista(); renderAluno();
  $('#lateral').classList.remove('aberta');
}
async function recarregar() {
  S.d = await api('GET', 'clientes/' + S.slug);
  await completarResultados();
  carregarAlunos();
}
/* avaliações escritas pelo Claude (importadas de PDF) chegam sem "resultados": calcula e grava */
async function completarResultados() {
  for (const a of S.d.avaliacoes.filter(a => !a.resultados)) {
    a.resultados = Calc.resultados(a, S.d.cliente);
    try { await api('PUT', `clientes/${S.slug}/avaliacoes/${a.id}`, a); } catch { /* segue */ }
  }
}
function dlgAluno(c) {
  const dlg = $('#dlgAluno'), f = $('#formAluno');
  f.reset();
  $('#dlgAlunoTitulo').textContent = c ? 'Editar cadastro' : 'Novo aluno';
  if (c) Object.entries(c).forEach(([k, v]) => { if (f.elements[k]) f.elements[k].value = v ?? ''; });
  dlg.returnValue = '';
  dlg.showModal();
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'ok') return;
    const dados = Object.fromEntries(new FormData(f));
    try {
      if (c) { await api('PUT', `clientes/${c.slug}/cliente`, dados); await abrirAluno(c.slug); toast('Cadastro atualizado'); }
      else { const novo = await api('POST', 'clientes', dados); await carregarAlunos(); await abrirAluno(novo.slug, 'anamnese'); toast('Aluno criado — preencha a anamnese inicial'); }
      carregarAlunos();
    } catch (e) { toast('Erro: ' + e.message); }
  };
}

// ------------------------------------------------------------ tela do aluno
const ABAS = [['painel', 'Painel'], ['anamnese', 'Anamnese inicial'], ['avaliacoes', 'Avaliações'],
  ['importar', 'Importar PDF'], ['acompanhamento', 'Acompanhamento'], ['evolucao', 'Evolução'], ['fotos', 'Fotos'], ['feedback', 'Feedback Claude']];

function avaliacoesOrd() { return [...S.d.avaliacoes].sort((a, b) => a.id.localeCompare(b.id)); }
function acompOrd() { return [...S.d.acompanhamentos].sort((a, b) => a.id.localeCompare(b.id)); }

function renderAluno() {
  const c = S.d.cliente, id = Calc.idade(c.nascimento);
  const pend = S.d.pedidos.length;
  $('#principal').innerHTML = `
    <div class="cab-aluno">
      <div><h2>${esc(c.nome)}</h2>
        <div class="dados">${c.sexo === 'M' ? 'Masculino' : c.sexo === 'F' ? 'Feminino' : '—'} · ${id ?? '—'} anos · ${c.altura ? c.altura + ' cm' : 'altura —'}
        ${c.objetivo ? ' · Objetivo: ' + esc(c.objetivo) : ''}</div>
        <div class="dica">Pasta: <code>clientes/${esc(c.slug)}/</code></div>
      </div>
      <div class="acoes">
        <button id="btnEditarAluno">Editar cadastro</button>
        <button id="btnImprimir">Imprimir relatório</button>
        <button id="btnExcluirAluno" class="perigo">Excluir</button>
      </div>
    </div>
    <nav class="abas">${ABAS.map(([k, r]) => `<button data-aba="${k}" class="${S.aba === k ? 'ativa' : ''}">${r}${k === 'feedback' && pend ? ` <span class="selo">${pend}</span>` : ''}${k === 'avaliacoes' && S.d.avaliacoes.some(a => a.revisar) ? ' <span class="selo">revisar</span>' : ''}${k === 'importar' && (S.d.importacoes || []).some(i => i.pendente && !i.avaliacao) ? ' <span class="selo">na fila</span>' : ''}</button>`).join('')}</nav>
    <div id="conteudo"></div>`;
  $('#btnEditarAluno').onclick = () => dlgAluno(c);
  $('#btnImprimir').onclick = () => { S.aba = 'painel'; renderAluno(); setTimeout(() => window.print(), 200); };
  $('#btnExcluirAluno').onclick = async () => {
    if (!confirm(`Excluir ${c.nome}? A pasta vai para .lixeira/ (pode ser recuperada).`)) return;
    await api('DELETE', 'clientes/' + c.slug); S.slug = null; S.d = null;
    $('#principal').innerHTML = '<section class="vazio"><h2>Aluno excluído</h2></section>'; carregarAlunos();
  };
  $$('.abas button').forEach(b => b.onclick = () => {
    if ((S.rascunho?._sujo || S.acomp?._sujo) && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    S.rascunho = null; S.acomp = null; S.aba = b.dataset.aba;
    history.replaceState(null, '', '#' + S.slug + '/' + S.aba); renderAluno();
  });
  ({ painel: abaPainel, anamnese: abaAnamnese, avaliacoes: abaAvaliacoes, acompanhamento: abaAcomp, importar: abaImportar,
     evolucao: abaEvolucao, fotos: abaFotos, feedback: abaFeedback })[S.aba]($('#conteudo'));
}

// ------------------------------------------------------------ alertas
function alertas() {
  const out = [], an = S.d.anamnese || {}, avs = avaliacoesOrd(), ult = avs.at(-1), acs = acompOrd(), ua = acs.at(-1);
  if (!an.atualizado_em) out.push(['', 'Anamnese inicial ainda não preenchida.']);
  const rev = avs.filter(a => a.revisar).map(a => fmtData(a.data));
  if (rev.length) out.push(['', `Avaliação importada de PDF aguardando sua revisão: ${rev.join(', ')} (aba Avaliações).`]);
  const sim = Object.values(an.parq || {}).filter(v => v === 'sim').length;
  if (sim) out.push(['perigo', `PAR-Q com ${sim} resposta(s) SIM — solicitar liberação médica antes de esforço intenso.`]);
  if (ult?.resultados?.pa_sis >= 140 || ult?.resultados?.pa_dia >= 90) out.push(['perigo', `PA média ${ult.resultados.pa_media} mmHg na última avaliação (${ult.resultados.pa_classe}). Reavaliar e orientar acompanhamento médico.`]);
  if (n(ult?.sinais?.spo2) !== null && n(ult.sinais.spo2) < 95) out.push([n(ult.sinais.spo2) <= 90 ? 'perigo' : '', `SpO₂ ${ult.sinais.spo2}% na última avaliação.`]);
  if (ua && n(ua.dor_eva) >= 5) out.push(['', `Dor EVA ${ua.dor_eva}/10 no último acompanhamento${ua.dor_local ? ' (' + esc(ua.dor_local) + ')' : ''}.`]);
  if (ult) {
    const dias = Math.round((new Date() - new Date(ult.data + 'T00:00')) / 864e5);
    if (dias > 35) out.push(['', `Última avaliação há ${dias} dias — hora de reavaliar.`]);
  }
  return out.map(([c, t]) => `<div class="aviso ${c}">${t}</div>`).join('');
}

// ------------------------------------------------------------ painel
function variacao(atual, ant, dir, un) {
  if (n(atual) === null || n(ant) === null) return '<div class="var neutra">&nbsp;</div>';
  const d = Math.round((atual - ant) * 10) / 10;
  if (d === 0) return '<div class="var neutra">= sem variação</div>';
  const bom = dir === 0 ? null : (d < 0) === (dir < 0);
  return `<div class="var ${bom === null ? 'neutra' : bom ? 'desce' : 'sobe'}">${d > 0 ? '▲ +' : '▼ '}${fmt(d)} ${un} vs anterior</div>`;
}
function abaPainel(el) {
  const avs = avaliacoesOrd(), ult = avs.at(-1), ant = avs.at(-2), R = ult?.resultados || {};
  const kpi = (rot, v, un, cls, va = '') => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${fmt(v)} <small>${un}</small></div>${va}${cls ? `<div class="cls">${esc(cls)}</div>` : ''}</div>`;
  const ua = acompOrd().at(-1);
  el.innerHTML = `
    ${alertas()}
    ${!ult ? `<div class="card"><h3>Sem avaliações ainda</h3><p>Comece pela <b>anamnese inicial</b> e depois registre a primeira avaliação.</p>
      <button class="primario" id="irNova">+ Nova avaliação</button></div>` : `
    <h3>Última avaliação — ${fmtData(ult.data)} ${ant ? `<small class="dica">comparada a ${fmtData(ant.data)}</small>` : ''}</h3>
    <div class="kpis">
      ${kpi('Peso', ult.peso, 'kg', '', variacao(ult.peso, ant?.peso, 0, 'kg'))}
      ${kpi('% Gordura', R.percentual_gordura, '%', R.gordura_classe, variacao(R.percentual_gordura, ant?.resultados?.percentual_gordura, -1, 'pp'))}
      ${kpi('Massa magra', R.massa_magra, 'kg', '', variacao(R.massa_magra, ant?.resultados?.massa_magra, 1, 'kg'))}
      ${kpi('Massa gorda', R.massa_gorda, 'kg', '', variacao(R.massa_gorda, ant?.resultados?.massa_gorda, -1, 'kg'))}
      ${kpi('IMC', R.imc, 'kg/m²', R.imc_classe)}
      ${kpi('Cintura', ult.circunferencias?.cintura, 'cm', R.rce_risco ? 'RCEst ' + fmt(R.rce, 2) + ' · ' + R.rce_risco : '', variacao(ult.circunferencias?.cintura, ant?.circunferencias?.cintura, -1, 'cm'))}
      ${kpi('RCQ', R.rcq, '', R.rcq_risco)}
      ${kpi('Pressão arterial', R.pa_media, 'mmHg', R.pa_classe)}
      ${kpi('FC repouso', ult.sinais?.fc_repouso, 'bpm', R.fc_classe)}
      ${kpi('SpO₂', ult.sinais?.spo2, '%', R.spo2_classe)}
    </div>`}
    ${avs.length ? `<div class="graficos">${['Peso', '% Gordura', 'Cintura', 'Massa magra', 'Σ dobras', 'PA sistólica'].map(m => grafico(m, avs)).join('')}</div>` : ''}
    ${ua ? `<div class="card" style="margin-top:16px"><h3>Último acompanhamento — ${fmtData(ua.data)}</h3>
      <div class="resultados">
        ${[['Energia', ua.energia, '/10'], ['Sono', ua.sono_qualidade, '/10'], ['Estresse', ua.estresse, '/10'], ['Dor (EVA)', ua.dor_eva, '/10'],
           ['Adesão treino', ua.adesao_treino, '%'], ['Adesão dieta', ua.adesao_dieta, '%']].map(([r, v, u]) => `<div><span>${r}</span><b>${fmt(v)}${v !== null && v !== undefined && v !== '' ? u : ''}</b></div>`).join('')}
      </div>${ua.percepcao ? `<p><b>Percepção do aluno:</b> ${esc(ua.percepcao)}</p>` : ''}</div>` : ''}
    ${S.d.feedbacks[0] ? `<div class="card"><h3>Último feedback do Claude <small>${esc(S.d.feedbacks[0].arquivo)}</small></h3>
      <div class="feedback-md">${md(S.d.feedbacks[0].conteudo)}</div></div>` : ''}`;
  $('#irNova') && ($('#irNova').onclick = () => { S.aba = 'avaliacoes'; renderAluno(); novaAvaliacao(); });
}

// ------------------------------------------------------------ gráfico SVG
function grafico(nome, avs) {
  const m = METRICAS.find(x => x[0] === nome);
  const pts = avs.map(a => [a.data || a.id, n(m[1](a))]).filter(p => p[1] !== null);
  if (!pts.length) return '';
  const W = 300, H = 150, pl = 34, pr = 10, pt = 18, pb = 22;
  const vs = pts.map(p => p[1]); let mn = Math.min(...vs), mx = Math.max(...vs);
  if (mn === mx) { mn -= 1; mx += 1; } const pad = (mx - mn) * .15; mn -= pad; mx += pad;
  const x = i => pts.length === 1 ? (W + pl - pr) / 2 : pl + i * (W - pl - pr) / (pts.length - 1);
  const y = v => pt + (mx - v) / (mx - mn) * (H - pt - pb);
  const linha = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const passo = Math.ceil(pts.length / 6);
  return `<div class="grafico"><h4>${nome}${m[2] ? ' (' + m[2] + ')' : ''}</h4>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${nome}">
      <line class="eixo" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
      <text x="${pl - 4}" y="${y(mx - pad) + 3}" text-anchor="end">${fmt(mx - pad)}</text>
      <text x="${pl - 4}" y="${y(mn + pad) + 3}" text-anchor="end">${fmt(mn + pad)}</text>
      <path class="linha" d="${linha}"/>
      ${pts.map((p, i) => `<circle class="ponto" cx="${x(i)}" cy="${y(p[1])}" r="3.5"><title>${fmtData(p[0])}: ${fmt(p[1])} ${m[2]}</title></circle>
        ${i === pts.length - 1 || i === 0 ? `<text class="rotval" x="${x(i)}" y="${y(p[1]) - 7}" text-anchor="middle">${fmt(p[1])}</text>` : ''}
        ${i % passo === 0 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtData(p[0]).slice(0, 5)}</text>` : ''}`).join('')}
    </svg></div>`;
}

// ------------------------------------------------------------ anamnese inicial
function abaAnamnese(el) {
  const a = clone(S.d.anamnese); a.parq ||= {};
  const ta = (k, r, ph = '') => `<label class="col2">${r}<textarea rows="2" data-k="${k}" placeholder="${ph}"></textarea></label>`;
  el.innerHTML = `
    <div class="card"><h3>Anamnese inicial <small>${a.atualizado_em ? 'atualizada em ' + fmtData(a.atualizado_em) : 'não preenchida'}</small></h3>
      <div class="grade g2">
        <label>Data<input type="date" data-k="data"></label>
        <label>Profissão / rotina<input data-k="profissao" placeholder="Ex.: escritório 8h sentado"></label>
        ${ta('queixa', 'Motivo da procura / queixa principal')}
        ${ta('historico', 'Histórico de saúde (familiar e pessoal)', 'Hipertensão, diabetes, cardiopatias na família…')}
        ${ta('doencas', 'Doenças / condições atuais')}
        ${ta('medicamentos', 'Medicamentos e suplementos em uso')}
        ${ta('cirurgias', 'Cirurgias')}
        ${ta('lesoes', 'Lesões, dores e limitações articulares')}
        ${ta('atividade', 'Atividade física atual e histórico de treino', 'Modalidade, frequência, há quanto tempo…')}
        ${ta('sono', 'Sono', 'Horas por noite, qualidade, acorda descansado?')}
        ${ta('alimentacao', 'Alimentação / acompanhamento nutricional')}
        ${ta('habitos', 'Tabagismo, álcool, outros hábitos')}
        ${ta('restricoes', 'Restrições ou recomendações médicas')}
        ${ta('objetivo_detalhado', 'Objetivos (curto, médio e longo prazo)')}
        ${ta('observacoes', 'Observações do avaliador')}
      </div>
    </div>
    <div class="card"><h3>PAR-Q <small>Questionário de prontidão para atividade física</small></h3>
      ${PARQ.map((q, i) => `<div class="item-post"><span>${i + 1}. ${q}</span>
        <span><label class="inline"><input type="radio" name="pq${i}" value="nao" data-k="parq.q${i + 1}"> Não</label>
        <label class="inline"><input type="radio" name="pq${i}" value="sim" data-k="parq.q${i + 1}"> Sim</label></span></div>`).join('')}
      <p class="dica">Qualquer “Sim” → solicitar liberação médica antes de iniciar ou intensificar o treino.</p>
    </div>
    <div class="barra-acoes fixa"><button class="primario" id="salvarAn">Salvar anamnese</button></div>`;
  if (!a.data) a.data = hoje();
  ligar(el, a);
  $('#salvarAn').onclick = async () => {
    try { await api('PUT', `clientes/${S.slug}/anamnese`, a); await recarregar(); toast('Anamnese salva'); renderAluno(); }
    catch (e) { toast('Erro: ' + e.message); }
  };
}

// ------------------------------------------------------------ avaliações
function abaAvaliacoes(el) {
  if (S.rascunho) return editorAvaliacao(el);
  const avs = avaliacoesOrd().reverse();
  el.innerHTML = `
    <div class="barra-acoes" style="justify-content:flex-start;margin:0 0 14px"><button class="primario" id="btnNovaAv">+ Nova avaliação</button>
      ${avs.length ? '<button id="btnDuplicar">Nova a partir da última (copiar protocolo)</button>' : ''}</div>
    <div class="lista-reg">${avs.map(a => `
      <div class="item"><div class="info"><b>${fmtData(a.data)}</b>
        ${a.origem ? `<span class="selo ${a.revisar ? '' : 'neutro'}">${a.revisar ? 'importada do PDF — revisar' : 'importada do PDF'}</span>` : ''}
        <small>Peso ${fmt(a.peso)} kg · %G ${fmt(a.resultados?.percentual_gordura)} · PA ${fmt(a.resultados?.pa_media)} · SpO₂ ${fmt(a.sinais?.spo2)}% · ${Object.keys(a.fotos || {}).length} foto(s)</small></div>
        <button data-ed="${a.id}">Abrir / editar</button><button class="perigo" data-del="${a.id}">Excluir</button></div>`).join('')
      || '<p class="dica">Nenhuma avaliação registrada.</p>'}</div>`;
  $('#btnNovaAv').onclick = () => novaAvaliacao();
  $('#btnDuplicar') && ($('#btnDuplicar').onclick = () => novaAvaliacao(avs[0]));
  $$('[data-ed]', el).forEach(b => b.onclick = () => { S.rascunho = clone(S.d.avaliacoes.find(a => a.id === b.dataset.ed)); renderAluno(); });
  $$('[data-del]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Excluir esta avaliação e suas fotos?')) return;
    await api('DELETE', `clientes/${S.slug}/avaliacoes/${b.dataset.del}`); await recarregar(); renderAluno(); toast('Avaliação excluída');
  });
}
function novoId(lista, data) {
  let id = data, i = 2; const ids = new Set(lista.map(x => x.id));
  while (ids.has(id)) id = `${data}-${i++}`;
  return id;
}
function novaAvaliacao(base) {
  const d = hoje();
  S.rascunho = {
    id: novoId(S.d.avaliacoes, d), data: d, _novo: true,
    altura: S.d.cliente.altura ? +S.d.cliente.altura : null,
    protocolo: base?.protocolo || 'jp7',
    circunferencias: {}, dobras: {}, sinais: { pa: [{}, {}, {}], braco: base?.sinais?.braco || 'esquerdo', posicao: base?.sinais?.posicao || 'sentado' },
    postural: { itens: {} }, fotos: {},
  };
  S.aba = 'avaliacoes'; renderAluno();
}

function editorAvaliacao(el) {
  const A = S.rascunho; A.sinais ||= {}; A.sinais.pa ||= [{}, {}, {}]; A.postural ||= { itens: {} }; A.fotos ||= {};
  const sexo = S.d.cliente.sexo;
  el.innerHTML = `
    <div class="card"><h3>${A._novo ? 'Nova avaliação' : 'Avaliação'} <small>ID ${A.id} · pasta fotos/${A.id}/</small></h3>
      <div class="grade g4">
        <label>Data<input type="date" data-k="data"></label>
        ${campoNum('peso', 'Peso (kg)')}${campoNum('altura', 'Estatura (cm)')}
        <label>Protocolo de dobras<select data-k="protocolo">
          ${Object.entries(Calc.PROTOCOLOS).map(([k, p]) => `<option value="${k}">${p.nome}</option>`).join('')}<option value="">Sem protocolo (só registrar)</option></select></label>
      </div>
    </div>
    ${A.origem ? `<div class="aviso">Importada de <a href="/clientes/${S.slug}/${esc(A.origem.arquivo)}" target="_blank">${esc(A.origem.arquivo)}</a>.
      Confira os campos com o PDF aberto ao lado e clique em <b>Salvar avaliação</b> para marcar como revisada.
      ${A.campos_nao_mapeados ? `<br><b>Itens do PDF sem campo no sistema:</b> ${esc(A.campos_nao_mapeados)}` : ''}</div>` : ''}
    ${A.nutrio && Object.keys(A.nutrio).length ? `<div class="card"><h3>Valores calculados pelo Nutrio <small>para comparar com o cálculo do sistema</small></h3>
      <div class="resultados">${Object.entries(A.nutrio).map(([k, v]) => `<div><span>${esc(k.replace(/_/g, ' '))}</span><b>${fmt(v, k === 'densidade' ? 4 : 2)}</b></div>`).join('')}</div></div>` : ''}
    <div class="card"><h3>Resultados <small>calculados em tempo real</small></h3><div id="resultadosAv"></div></div>
    <div class="card"><h3>Circunferências <small>cm · fita inextensível</small></h3>
      <div class="grade g6">${CIRC.map(([k, r]) => campoNum('circunferencias.' + k, r)).join('')}</div></div>
    <div class="card"><h3>Dobras cutâneas <small>mm · lado direito · use a mediana de 3 medidas</small></h3>
      <div class="grade g5 auto" id="gradeDobras">${DOBRAS.map(([k, r]) => campoNum('dobras.' + k, `<span data-dobra="${k}">${r}</span>`)).join('')}</div>
      <p class="dica" id="dicaProt"></p></div>
    <div class="card"><h3>Sinais vitais <small>esfigmomanômetro + oxímetro de dedo</small></h3>
      <div class="grade g6">
        ${[0, 1, 2].map(i => `${campoNum(`sinais.pa.${i}.sis`, `PA ${i + 1}ª sistólica`, 'step="1"')}${campoNum(`sinais.pa.${i}.dia`, `PA ${i + 1}ª diastólica`, 'step="1"')}`).join('')}
        <label>Braço<select data-k="sinais.braco"><option value="esquerdo">Esquerdo</option><option value="direito">Direito</option></select></label>
        <label>Posição<select data-k="sinais.posicao"><option value="sentado">Sentado</option><option value="deitado">Deitado</option><option value="em pé">Em pé</option></select></label>
        ${campoNum('sinais.fc_repouso', 'FC repouso (bpm)', 'step="1"')}
        ${campoNum('sinais.spo2', 'SpO₂ oxímetro (%)', 'step="1" min="50" max="100"')}
        ${campoNum('sinais.fc_oximetro', 'FC no oxímetro (bpm)', 'step="1"')}
        ${campoNum('sinais.pi', 'Índice de perfusão (PI %)')}
        <label class="col-todas">Observações (repouso de 5 min? café/fumo/exercício antes? dedo/mão usados no oxímetro, esmalte, mãos frias…)
          <textarea rows="2" data-k="sinais.obs"></textarea></label>
      </div>
      <p class="dica">Diretriz: 2–3 leituras com 1–2 min de intervalo, após 5 min sentado, costas apoiadas, braço na altura do coração. A média é usada na classificação.</p>
    </div>
    <div class="card"><h3>Fotos <small>fundo neutro, mesma distância e altura da câmera, roupa de banho/top</small></h3>
      <div class="fotos-grade" id="gradeFotos"></div>
      <p class="dica">No celular, “Câmera” abre a câmera direto. Clique na foto para ver com grade postural e linha de prumo.</p></div>
    <div class="card"><h3>Avaliação postural <small>marque apenas o que estiver alterado</small></h3>
      <div class="postural">${Object.entries(POSTURAL).map(([vista, itens]) => `<fieldset><legend>${vista}</legend>
        ${itens.map(it => `<div class="item-post"><span>${it}</span><select data-k="postural.itens.${it.replace(/\./g, '')}">${GRAUS.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div>`).join('')}
        </fieldset>`).join('')}</div>
      <label style="margin-top:12px">Observações posturais (lado, testes realizados, encurtamentos, compensações)<textarea rows="3" data-k="postural.obs"></textarea></label>
    </div>
    <div class="card"><h3>Observações gerais da avaliação</h3><textarea rows="3" data-k="observacoes"></textarea></div>
    <div class="barra-acoes fixa">
      <button id="cancAv">Voltar</button>
      <button id="salvarFb">Salvar e pedir feedback ao Claude</button>
      <button class="primario" id="salvarAv">Salvar avaliação</button>
    </div>`;
  const atualizar = () => {
    A.resultados = Calc.resultados(A, S.d.cliente);
    $('#resultadosAv').innerHTML = painelResultados(A.resultados);
    const req = Calc.dobrasDoProtocolo(A.protocolo, sexo);
    $$('[data-dobra]').forEach(s => { s.style.color = req.includes(s.dataset.dobra) ? 'var(--pri)' : ''; s.style.fontWeight = req.includes(s.dataset.dobra) ? '700' : ''; });
    $('#dicaProt').textContent = A.protocolo ? (sexo ? `Dobras do protocolo em destaque: ${req.map(k => DOBRAS.find(d => d[0] === k)[1]).join(', ')}.` : 'Defina o sexo no cadastro para calcular.') : '';
    $$('.item-post select').forEach(s => s.className = s.value);
  };
  ligar(el, A, () => { A._sujo = true; atualizar(); });
  atualizar();
  renderSlotsFoto();
  $('#cancAv').onclick = () => { if (A._sujo && !confirm('Descartar alterações?')) return; S.rascunho = null; renderAluno(); };
  $('#salvarAv').onclick = () => { A.revisar = false; salvarAvaliacao(); };
  $('#salvarFb').onclick = async () => { A.revisar = false; if (await salvarAvaliacao(true)) { S.aba = 'feedback'; renderAluno(); $('#tipoPedido').value = 'avaliacao'; $('#refPedido').value = A.id; } };
}
function painelResultados(R) {
  const it = (r, v, sub = '') => `<div><span>${r}</span><b>${fmt(v, /Densidade/.test(r) ? 4 : 2)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  let h = `<div class="resultados">
    ${it('Idade na avaliação', R.idade)}${it('IMC (kg/m²)', R.imc, R.imc_classe)}
    ${it('% Gordura', R.percentual_gordura, R.gordura_classe)}${it('Densidade corporal', R.densidade)}
    ${it('Massa gorda (kg)', R.massa_gorda)}${it('Massa magra (kg)', R.massa_magra)}
    ${it('Σ dobras protocolo (mm)', R.soma_dobras)}${it('Σ todas as dobras (mm)', R.soma_todas_dobras)}
    ${it('RCQ', R.rcq, R.rcq_risco)}${it('Cintura/estatura', R.rce, R.rce_risco)}
    ${it('PA média (mmHg)', R.pa_media, R.pa_classe)}${it('PAM (mmHg)', R.pam)}
    ${it('FC máx. estimada (Tanaka)', R.fc_max_estimada)}${it('SpO₂ (%)', R.spo2, R.spo2_classe)}
  </div>`;
  if (R.faltam_dobras?.length) h += `<div class="aviso">Para o % de gordura faltam: ${R.faltam_dobras.map(k => DOBRAS.find(d => d[0] === k)[1]).join(', ')}.</div>`;
  if (R.pa_sis >= 180 || R.pa_dia >= 110) h += '<div class="aviso perigo">PA ≥ 180/110: não realizar esforço. Orientar procura de atendimento médico.</div>';
  return h;
}
async function salvarAvaliacao(silencioso) {
  const A = S.rascunho;
  A.resultados = Calc.resultados(A, S.d.cliente);
  const { _novo, _sujo, ...dados } = A;
  try {
    await api('PUT', `clientes/${S.slug}/avaliacoes/${A.id}`, dados);
    A._novo = false; A._sujo = false;
    await recarregar();
    if (!silencioso) { S.rascunho = null; renderAluno(); }
    toast('Avaliação salva em clientes/' + S.slug + '/avaliacoes/' + A.id + '.json');
    return true;
  } catch (e) { toast('Erro ao salvar: ' + e.message); return false; }
}

// ------------------------------------------------------------ fotos
function renderSlotsFoto() {
  const A = S.rascunho, g = $('#gradeFotos');
  const extras = Object.keys(A.fotos).filter(k => k.startsWith('extra-'));
  const slots = [...POSICOES_FOTO, ...extras.map((k, i) => [k, 'Extra ' + (i + 1)])];
  g.innerHTML = slots.map(([k, r]) => {
    const src = A.fotos[k] ? `/clientes/${S.slug}/${A.fotos[k]}?t=${A._t || ''}` : '';
    return `<div class="slot-foto ${src ? 'tem-foto' : ''}" data-pos="${k}">
      <span class="rot">${r}</span>
      ${src ? `<img src="${src}" alt="${r}" data-ver="${k}">` : '<span class="dica">sem foto</span>'}
      <div class="acoes-foto">
        <button type="button" data-cam="${k}">📷 Câmera</button><button type="button" data-arq="${k}">Arquivo</button>
        ${src ? `<button type="button" data-rm="${k}">✕</button>` : ''}
      </div></div>`;
  }).join('') + `<div class="slot-foto"><button type="button" id="addExtra">+ Foto extra</button></div>`;
  const escolher = (pos, cam) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (cam) i.capture = 'environment';
    i.onchange = () => i.files[0] && enviarFoto(pos, i.files[0]); i.click();
  };
  $$('[data-cam]', g).forEach(b => b.onclick = () => escolher(b.dataset.cam, true));
  $$('[data-arq]', g).forEach(b => b.onclick = () => escolher(b.dataset.arq, false));
  $$('[data-rm]', g).forEach(b => b.onclick = async () => {
    if (!confirm('Remover esta foto?')) return;
    await api('DELETE', `clientes/${S.slug}/fotos/${A.id}/${b.dataset.rm}/imagem`);
    delete A.fotos[b.dataset.rm]; await salvarAvaliacao(true); renderSlotsFoto();
  });
  $$('[data-ver]', g).forEach(img => img.onclick = () => verFotos([{ src: img.src, legenda: fmtData(A.data) }], img.alt));
  $('#addExtra').onclick = () => { let i = 1; while (A.fotos['extra-' + i]) i++; escolher('extra-' + i, false); };
}
function redimensionar(arquivo, max = 1600) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = erro; img.src = URL.createObjectURL(arquivo);
  });
}
async function enviarFoto(pos, arquivo) {
  const A = S.rascunho;
  try {
    toast('Enviando foto…');
    const b64 = await redimensionar(arquivo);
    const r = await api('POST', `clientes/${S.slug}/fotos/${A.id}/${pos}/imagem`, { base64: b64 });
    A.fotos[pos] = r.caminho; A._t = Date.now();
    await salvarAvaliacao(true);
    renderSlotsFoto();
  } catch (e) { toast('Erro na foto: ' + e.message); }
}
function verFotos(lista, titulo) {
  const dlg = $('#dlgFoto');
  $('#dlgFotoTitulo').textContent = titulo;
  $('#fotoComparacao').innerHTML = lista.map(f => `<figure class="foto-cmp" style="margin:0">
    <div class="foto-moldura"><img src="${f.src}" alt=""><div class="grade-postural"></div><div class="prumo"></div></div>
    <figcaption>${esc(f.legenda)}</figcaption></figure>`).join('');
  const aplicar = () => {
    $$('.grade-postural', dlg).forEach(g => g.style.display = $('#chkGrade').checked ? '' : 'none');
    $$('.prumo', dlg).forEach(g => g.style.display = $('#chkPrumo').checked ? '' : 'none');
  };
  $('#chkGrade').onchange = aplicar; $('#chkPrumo').onchange = aplicar; aplicar();
  // clique na foto move a linha de prumo / horizontal
  $$('.foto-moldura', dlg).forEach(m => m.onclick = ev => {
    const r = m.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * 100, py = (ev.clientY - r.top) / r.height * 100;
    if (ev.shiftKey) { let h = $('.prumo-h', m); if (!h) { h = document.createElement('div'); h.className = 'prumo-h'; m.append(h); } h.style.top = py + '%'; }
    else $('.prumo', m).style.left = px + '%';
  });
  $('#btnFecharFoto').onclick = () => dlg.close();
  dlg.showModal();
}
function abaFotos(el) {
  const avs = avaliacoesOrd().filter(a => Object.keys(a.fotos || {}).length);
  if (!avs.length) { el.innerHTML = '<p class="dica">Nenhuma foto ainda. As fotos são tiradas dentro de cada avaliação.</p>'; return; }
  el.innerHTML = `<div class="card nao-imprimir"><h3>Comparar fotos (antes × depois)</h3>
      <div class="grade g3">
        <label>Posição<select id="cmpPos">${POSICOES_FOTO.map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></label>
        <label>Antes<select id="cmpA">${avs.map(a => `<option value="${a.id}">${fmtData(a.data)}</option>`).join('')}</select></label>
        <label>Depois<select id="cmpB">${avs.map((a, i) => `<option value="${a.id}" ${i === avs.length - 1 ? 'selected' : ''}>${fmtData(a.data)}</option>`).join('')}</select></label>
      </div>
      <div class="barra-acoes"><button class="primario" id="btnCmp">Comparar com grade postural</button></div>
      <p class="dica">No visualizador: clique para mover a linha de prumo; Shift+clique cria uma linha horizontal de referência (ombros, pelve).</p></div>
    ${avs.slice().reverse().map(a => `<div class="card"><h3>${fmtData(a.data)}</h3><div class="fotos-grade">
      ${Object.entries(a.fotos).map(([k, p]) => `<div class="slot-foto tem-foto"><span class="rot">${(POSICOES_FOTO.find(x => x[0] === k) || [, k])[1]}</span>
        <img src="/clientes/${S.slug}/${p}" data-src="/clientes/${S.slug}/${p}" data-leg="${fmtData(a.data)} — ${k}" alt="${k}"></div>`).join('')}
    </div></div>`).join('')}`;
  $('#btnCmp').onclick = () => {
    const pos = $('#cmpPos').value, fa = avs.find(a => a.id === $('#cmpA').value), fb = avs.find(a => a.id === $('#cmpB').value);
    const lista = [fa, fb].filter((a, i, arr) => a && arr.indexOf(a) === i && a.fotos[pos]).map(a => ({ src: `/clientes/${S.slug}/${a.fotos[pos]}`, legenda: fmtData(a.data) }));
    if (!lista.length) return toast('Não há foto dessa posição nas datas escolhidas');
    verFotos(lista, (POSICOES_FOTO.find(x => x[0] === pos) || [])[1]);
  };
  $$('img[data-src]', el).forEach(i => i.onclick = () => verFotos([{ src: i.dataset.src, legenda: i.dataset.leg }], i.dataset.leg));
}

// ------------------------------------------------------------ importar PDF
function abaImportar(el) {
  const st = S.status, apiOk = st.sdk && st.chave, imps = S.d.importacoes || [];
  const cmd = `/importar ${S.slug}`;
  el.innerHTML = `
    <div class="card"><h3>Importar avaliação em PDF <small>Nutrio ou outro sistema</small></h3>
      <div id="zonaPdf" class="zona-pdf">
        <b>Arraste o PDF aqui</b> ou <button type="button" id="btnEscolherPdf" class="primario">Escolher PDF</button>
        <div class="dica">Pode enviar vários de uma vez (avaliações antigas também — cada uma vira uma data no histórico).</div>
      </div>
      <label style="margin-top:10px">Observação para o Claude (opcional)<input id="obsPdf" placeholder="Ex.: o Nutrio usou Pollock 7; a data correta é 03/10"></label>
      <p class="dica">O PDF fica em <code>clientes/${esc(S.slug)}/importacoes/</code> e entra na fila. No Claude Code, digite:</p>
      <div class="comando"><span>${esc(cmd)}</span><button id="btnCopiarImp">Copiar</button></div>
      <p class="dica">O Claude lê o PDF e grava a avaliação no formato do sistema (medidas, dobras, protocolo, sinais vitais, postura, observações).
        Ela aparece em <b>Avaliações</b> marcada “revisar”, e os valores calculados pelo Nutrio ficam guardados para comparar.</p>
    </div>
    <div class="barra-acoes" style="justify-content:flex-start"><button id="btnAtualizarImp">↻ Atualizar</button></div>
    <div class="lista-reg">${imps.map(i => `<div class="item"><div class="info">
        <b>${esc(i.arquivo)}</b>
        <small>${fmtData(i.enviado)} · ${i.tamanho_kb} KB ·
          ${i.avaliacao ? `<span class="selo ok">convertido → avaliação ${fmtData(i.avaliacao)}</span>` : i.pendente ? '<span class="selo">aguardando o Claude</span>' : '<span class="selo neutro">sem pedido</span>'}</small></div>
        <a href="/clientes/${S.slug}/${esc(i.caminho)}" target="_blank"><button type="button">Ver PDF</button></a>
        ${i.avaliacao ? `<button data-abrir="${esc(i.avaliacao)}">Abrir avaliação</button>` : apiOk ? `<button data-conv="${esc(i.arquivo)}">Converter agora (API)</button>` : ''}
        <button class="perigo" data-delimp="${esc(i.arquivo)}">Excluir</button></div>`).join('') || '<p class="dica">Nenhum PDF importado.</p>'}</div>`;
  const enviar = async arquivos => {
    const pdfs = [...arquivos].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return toast('Selecione um arquivo PDF');
    for (const f of pdfs) {
      if (f.size > 30 * 1024 * 1024) { toast(f.name + ' passa de 30 MB'); continue; }
      try {
        toast('Enviando ' + f.name + '…');
        const b64 = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(f); });
        await api('POST', `clientes/${S.slug}/importacoes`, { nome: f.name, base64: b64, instrucao: $('#obsPdf').value.trim() });
      } catch (e) { toast('Erro: ' + e.message); }
    }
    await recarregar(); renderAluno(); toast(`PDF na fila. No Claude Code: ${cmd}`, 5000);
  };
  $('#btnEscolherPdf').onclick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf,.pdf'; i.multiple = true;
    i.onchange = () => enviar(i.files); i.click();
  };
  const z = $('#zonaPdf');
  z.ondragover = e => { e.preventDefault(); z.classList.add('sobre'); };
  z.ondragleave = () => z.classList.remove('sobre');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('sobre'); enviar(e.dataTransfer.files); };
  $('#btnCopiarImp').onclick = () => navigator.clipboard?.writeText(cmd).then(() => toast('Comando copiado'));
  $('#btnAtualizarImp').onclick = async () => { await recarregar(); renderAluno(); };
  $$('[data-abrir]', el).forEach(b => b.onclick = () => { S.rascunho = clone(S.d.avaliacoes.find(a => a.id === b.dataset.abrir)); S.aba = 'avaliacoes'; renderAluno(); });
  $$('[data-delimp]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este PDF? (a avaliação já convertida, se houver, continua)')) return;
    await api('DELETE', `clientes/${S.slug}/importacoes/${b.dataset.delimp}`); await recarregar(); renderAluno();
  });
  $$('[data-conv]', el).forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'Claude lendo o PDF…';
    try {
      const r = await api('POST', `clientes/${S.slug}/importacoes/${b.dataset.conv}/converter`); await recarregar();
      S.rascunho = clone(S.d.avaliacoes.find(a => a.id === r.avaliacao)); S.aba = 'avaliacoes'; renderAluno(); toast('Convertido — revise os campos');
    } catch (e) { toast('Erro: ' + e.message, 6000); b.disabled = false; b.textContent = 'Converter agora (API)'; }
  });
}

// ------------------------------------------------------------ acompanhamento
function abaAcomp(el) {
  if (S.acomp) return editorAcomp(el);
  const acs = acompOrd().reverse();
  el.innerHTML = `
    <p class="dica">Anamnese de acompanhamento: faça a cada encontro/semana. Fica salva em <code>acompanhamentos/</code> e entra no resumo que o Claude lê.</p>
    <div class="barra-acoes" style="justify-content:flex-start;margin:0 0 14px"><button class="primario" id="btnNovoAc">+ Novo acompanhamento</button></div>
    <div class="lista-reg">${acs.map(a => `<div class="item"><div class="info"><b>${fmtData(a.data)}</b>
      <small>Energia ${fmt(a.energia)} · Sono ${fmt(a.sono_qualidade)} · Estresse ${fmt(a.estresse)} · Dor ${fmt(a.dor_eva)} · Treino ${fmt(a.adesao_treino)}% · Dieta ${fmt(a.adesao_dieta)}%</small></div>
      <button data-ed="${a.id}">Abrir / editar</button><button class="perigo" data-del="${a.id}">Excluir</button></div>`).join('') || '<p class="dica">Nenhum acompanhamento registrado.</p>'}</div>
    ${acs.length > 1 ? `<div class="card" style="margin-top:16px"><h3>Tendência</h3><div class="rolagem"><table class="tabela"><thead><tr><th>Data</th><th>Energia</th><th>Sono</th><th>Horas sono</th><th>Estresse</th><th>Dor</th><th>Treino %</th><th>Dieta %</th><th>Treinos/sem</th><th>PA</th><th>SpO₂</th></tr></thead>
      <tbody>${acs.map(a => `<tr><td>${fmtData(a.data)}</td><td>${fmt(a.energia)}</td><td>${fmt(a.sono_qualidade)}</td><td>${fmt(a.sono_horas)}</td><td>${fmt(a.estresse)}</td><td>${fmt(a.dor_eva)}</td><td>${fmt(a.adesao_treino)}</td><td>${fmt(a.adesao_dieta)}</td><td>${fmt(a.treinos_semana)}</td><td>${fmt(a.pa)}</td><td>${fmt(a.spo2)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  $('#btnNovoAc').onclick = () => { const d = hoje(); S.acomp = { id: novoId(S.d.acompanhamentos, d), data: d, _novo: true }; renderAluno(); };
  $$('[data-ed]', el).forEach(b => b.onclick = () => { S.acomp = clone(S.d.acompanhamentos.find(a => a.id === b.dataset.ed)); renderAluno(); });
  $$('[data-del]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este acompanhamento?')) return;
    await api('DELETE', `clientes/${S.slug}/acompanhamentos/${b.dataset.del}`); await recarregar(); renderAluno();
  });
}
function editorAcomp(el) {
  const A = S.acomp, F = S.d.cliente.sexo === 'F';
  const ta = (k, r, ph = '') => `<label class="col-todas">${r}<textarea rows="2" data-k="${k}" placeholder="${ph}"></textarea></label>`;
  el.innerHTML = `
    <div class="card"><h3>Anamnese de acompanhamento <small>ID ${A.id}</small></h3>
      <div class="grade g4">
        <label>Data<input type="date" data-k="data"></label>
        ${campoNum('peso', 'Peso (kg) — opcional')}
        <label>PA (ex.: 120/80)<input data-k="pa" placeholder="sis/dia"></label>
        ${campoNum('spo2', 'SpO₂ (%)', 'step="1"')}
        ${campoNum('fc', 'FC repouso (bpm)', 'step="1"')}
        ${campoNum('sono_horas', 'Horas de sono/noite')}
        ${campoNum('treinos_semana', 'Treinos na semana', 'step="1"')}
        ${campoNum('agua', 'Água (L/dia)')}
        ${campoNum('adesao_treino', 'Adesão ao treino (%)', 'step="5" min="0" max="100"')}
        ${campoNum('adesao_dieta', 'Adesão à dieta (%)', 'step="5" min="0" max="100"')}
        <label>Intestino<select data-k="intestino"><option value="">—</option><option>Regular</option><option>Preso</option><option>Solto</option><option>Irregular</option></select></label>
        ${F ? `<label>Ciclo menstrual<select data-k="ciclo"><option value="">—</option><option>Folicular</option><option>Ovulatória</option><option>Lútea / TPM</option><option>Menstruada</option><option>Anticoncepcional contínuo</option><option>Menopausa</option></select></label>` : ''}
      </div>
    </div>
    <div class="card"><h3>Escalas 0–10</h3>
      <div class="grade g2">
        <div><label>Nível de energia / disposição</label>${escala('energia', A.energia)}</div>
        <div><label>Qualidade do sono</label>${escala('sono_qualidade', A.sono_qualidade)}</div>
        <div><label>Estresse</label>${escala('estresse', A.estresse)}</div>
        <div><label>Dor (EVA)</label>${escala('dor_eva', A.dor_eva)}</div>
        <div><label>Fome / saciedade (0 sem fome · 10 muita fome)</label>${escala('fome', A.fome)}</div>
        <div><label>Recuperação muscular / disposição p/ treinar</label>${escala('recuperacao', A.recuperacao)}</div>
      </div>
    </div>
    <div class="card"><h3>Relato</h3><div class="grade g2">
      <label class="col2">Local da dor (se houver)<input data-k="dor_local"></label>
      ${ta('medicamentos', 'Mudanças em medicamentos / suplementos / saúde')}
      ${ta('intercorrencias', 'Lesões, doenças ou intercorrências desde o último encontro')}
      ${ta('percepcao', 'Percepção do aluno (como se sente, roupas, força, autoestima)')}
      ${ta('dificuldades', 'Dificuldades (rotina, alimentação, treino)')}
      ${ta('metas', 'Metas combinadas até o próximo encontro')}
      ${ta('observacoes', 'Observações do avaliador')}
    </div></div>
    <div class="barra-acoes fixa"><button id="cancAc">Voltar</button>
      <button id="salvarAcFb">Salvar e pedir feedback ao Claude</button>
      <button class="primario" id="salvarAc">Salvar acompanhamento</button></div>`;
  ligar(el, A, () => A._sujo = true);
  ligarEscalas(el, A);
  const salvar = async () => {
    const { _novo, _sujo, ...dados } = A;
    try { await api('PUT', `clientes/${S.slug}/acompanhamentos/${A.id}`, dados); await recarregar(); toast('Acompanhamento salvo'); return true; }
    catch (e) { toast('Erro: ' + e.message); return false; }
  };
  $('#cancAc').onclick = () => { if (A._sujo && !confirm('Descartar alterações?')) return; S.acomp = null; renderAluno(); };
  $('#salvarAc').onclick = async () => { if (await salvar()) { S.acomp = null; renderAluno(); } };
  $('#salvarAcFb').onclick = async () => { if (await salvar()) { S.acomp = null; S.aba = 'feedback'; renderAluno(); $('#tipoPedido').value = 'acompanhamento'; $('#refPedido').value = A.id; } };
}

// ------------------------------------------------------------ evolução
function abaEvolucao(el) {
  const avs = avaliacoesOrd();
  if (!avs.length) { el.innerHTML = '<p class="dica">Sem avaliações para comparar.</p>'; return; }
  const linha = (rot, fn, un = '', dir = 0) => {
    const vs = avs.map(fn);
    if (vs.every(v => n(v) === null && !v)) return '';
    const p = vs.find(v => n(v) !== null), u = [...vs].reverse().find(v => n(v) !== null);
    const dif = n(p) !== null && n(u) !== null && vs.filter(v => n(v) !== null).length > 1 ? Math.round((u - p) * 10) / 10 : null;
    const cls = dif === null || dif === 0 || dir === 0 ? 'neutra' : (dif < 0) === (dir < 0) ? 'desce' : 'sobe';
    return `<tr><td>${rot}${un ? ` <span class="dica">${un}</span>` : ''}</td>${vs.map(v => `<td>${fmt(v, 2)}</td>`).join('')}<td class="var ${cls}">${dif === null ? '—' : (dif > 0 ? '+' : '') + fmt(dif)}</td></tr>`;
  };
  const grupo = t => `<tr class="grupo"><td colspan="${avs.length + 2}">${t}</td></tr>`;
  el.innerHTML = `
    <div class="graficos" style="margin-bottom:16px">${METRICAS.map(m => grafico(m[0], avs)).join('')}</div>
    <div class="card"><h3>Tabela comparativa <small>diferença = última − primeira</small></h3><div class="rolagem"><table class="tabela">
      <thead><tr><th>Medida</th>${avs.map(a => `<th>${fmtData(a.data)}</th>`).join('')}<th>Δ</th></tr></thead><tbody>
      ${grupo('Composição corporal')}
      ${METRICAS.slice(0, 6).map(m => linha(m[0], m[1], m[2], m[3])).join('')}
      ${linha('Protocolo', a => a.resultados?.protocolo_nome)}
      ${linha('RCQ', a => a.resultados?.rcq, '', -1)}${linha('Cintura/estatura', a => a.resultados?.rce, '', -1)}
      ${grupo('Circunferências (cm)')}
      ${CIRC.map(([k, r]) => linha(r, a => a.circunferencias?.[k], '', ['cintura', 'abdomen'].includes(k) ? -1 : 0)).join('')}
      ${grupo('Dobras cutâneas (mm)')}
      ${DOBRAS.map(([k, r]) => linha(r, a => a.dobras?.[k], '', -1)).join('')}
      ${grupo('Sinais vitais')}
      ${linha('PA média', a => a.resultados?.pa_media)}${linha('Classificação PA', a => a.resultados?.pa_classe)}
      ${linha('FC repouso', a => a.sinais?.fc_repouso, 'bpm', -1)}${linha('SpO₂', a => a.sinais?.spo2, '%', 1)}
      ${grupo('Postural')}
      ${linha('Alterações marcadas', a => Object.values(a.postural?.itens || {}).filter(v => v && v !== 'normal').length || '0', '', -1)}
    </tbody></table></div></div>`;
}

// ------------------------------------------------------------ feedback
function md(t) {
  const base = `/clientes/${S.slug}/`;
  const inl = s => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, u) => `<img alt="${a}" src="${/^(https?:|\/)/.test(u) ? u : base + u.replace(/^\.\.\//, '')}">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, a, u) => `<a href="${/^(https?:|\/)/.test(u) ? u : base + u.replace(/^\.\.\//, '')}" target="_blank">${a}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const L = t.split('\n'); let h = '', lista = null, tab = null;
  const fecha = () => { if (lista) { h += `</${lista}>`; lista = null; } if (tab) { h += '</table>'; tab = null; } };
  for (const l of L) {
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { fecha(); h += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; }
    else if (/^\s*\|.*\|\s*$/.test(l)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
      if (!tab) { fecha(); h += '<table>'; tab = 1; }
      h += '<tr>' + l.trim().slice(1, -1).split('|').map(c => `<td>${inl(c.trim())}</td>`).join('') + '</tr>';
    }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (lista !== 'ul') { fecha(); h += '<ul>'; lista = 'ul'; } h += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== 'ol') { fecha(); h += '<ol>'; lista = 'ol'; } h += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^>\s?(.*)/))) { fecha(); h += `<blockquote>${inl(m[1])}</blockquote>`; }
    else if (/^\s*(---|\*\*\*)\s*$/.test(l)) { fecha(); h += '<hr>'; }
    else if (!l.trim()) fecha();
    else { fecha(); h += `<p>${inl(l)}</p>`; }
  }
  fecha(); return h;
}
function abaFeedback(el) {
  const st = S.status, apiOk = st.sdk && st.chave;
  const cmd = `/feedback ${S.slug}`;
  el.innerHTML = `
    <div class="card"><h3>Pedir feedback ao Claude</h3>
      <div class="grade g3">
        <label>Tipo<select id="tipoPedido">
          <option value="completo">Completo (tudo até agora)</option><option value="avaliacao">Sobre uma avaliação</option>
          <option value="acompanhamento">Sobre um acompanhamento</option><option value="fotos">Antes e depois das fotos</option>
          <option value="aluno">Mensagem para enviar ao aluno</option><option value="treino">Sugestões de ajuste no treino</option></select></label>
        <label class="col2">Referência (ID da avaliação/acompanhamento)<input id="refPedido" placeholder="vazio = mais recente"></label>
        <label class="col-todas">O que você quer saber / observar<textarea id="instrPedido" rows="3" placeholder="Ex.: compare com a avaliação de setembro, foque em cintura e PA, escreva uma mensagem curta de WhatsApp para o aluno…"></textarea></label>
      </div>
      <div class="barra-acoes">
        ${apiOk ? '<button id="btnGerarApi">Gerar agora (API Claude)</button>' : ''}
        <button class="primario" id="btnPedir">Enviar pedido para a pasta do aluno</button>
      </div>
      <p class="dica">O pedido é salvo em <code>clientes/${esc(S.slug)}/pedidos/</code>. Depois, no Claude Code aberto nesta pasta, digite:</p>
      <div class="comando"><span>${esc(cmd)}</span><button id="btnCopiar">Copiar</button></div>
      <p class="dica">O Claude lê <code>RESUMO.md</code>, os JSON e as fotos, escreve o feedback em <code>feedback/</code> e ele aparece aqui (botão Atualizar). ${apiOk ? '' : 'Para gerar direto pela interface, instale <code>pip install anthropic</code> e defina <code>ANTHROPIC_API_KEY</code>.'}</p>
    </div>
    ${S.d.pedidos.length ? `<div class="card"><h3>Pedidos pendentes <span class="selo">${S.d.pedidos.length}</span></h3>
      <div class="lista-reg">${S.d.pedidos.map(p => `<div class="item"><div class="info"><b>${esc(p.arquivo)}</b><small>${esc(p.conteudo.split('\n').slice(2, 5).join(' · '))}</small></div>
      <button class="perigo" data-delp="${esc(p.arquivo)}">Cancelar</button></div>`).join('')}</div></div>` : ''}
    <div class="barra-acoes" style="justify-content:flex-start"><button id="btnAtualizarFb">↻ Atualizar feedbacks</button></div>
    ${S.d.feedbacks.map(f => `<div class="card"><h3>${esc(f.arquivo)} <small>${fmtData(f.modificado)} ${f.modificado.slice(11)}</small></h3>
      <div class="feedback-md">${md(f.conteudo)}</div>
      <div class="barra-acoes nao-imprimir"><button data-copfb="${esc(f.arquivo)}">Copiar texto</button><button class="perigo" data-delfb="${esc(f.arquivo)}">Excluir</button></div></div>`).join('')
      || '<p class="dica">Nenhum feedback ainda.</p>'}`;
  const corpo = () => ({ tipo: $('#tipoPedido').value, referencia: $('#refPedido').value.trim(), instrucao: $('#instrPedido').value.trim() });
  $('#btnPedir').onclick = async () => {
    try { await api('POST', `clientes/${S.slug}/pedidos`, corpo()); await recarregar(); renderAluno(); toast('Pedido salvo. No Claude Code: ' + cmd, 5000); }
    catch (e) { toast('Erro: ' + e.message); }
  };
  $('#btnCopiar').onclick = () => navigator.clipboard?.writeText(cmd).then(() => toast('Comando copiado'));
  $('#btnAtualizarFb').onclick = async () => { await recarregar(); renderAluno(); toast('Atualizado'); };
  $('#btnGerarApi') && ($('#btnGerarApi').onclick = async ev => {
    const b = ev.target; b.disabled = true; b.textContent = 'Claude analisando… (pode levar 1–2 min)';
    const c = corpo();
    try { await api('POST', `clientes/${S.slug}/feedback/gerar`, { instrucao: `[${c.tipo}${c.referencia ? ' · ref ' + c.referencia : ''}] ${c.instrucao}` }); await recarregar(); renderAluno(); toast('Feedback gerado'); }
    catch (e) { toast('Erro: ' + e.message, 6000); b.disabled = false; b.textContent = 'Gerar agora (API Claude)'; }
  });
  $$('[data-delp]', el).forEach(b => b.onclick = async () => { await api('DELETE', `clientes/${S.slug}/pedidos/${b.dataset.delp}`); await recarregar(); renderAluno(); });
  $$('[data-delfb]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este feedback?')) return;
    await api('DELETE', `clientes/${S.slug}/feedback/${b.dataset.delfb}`); await recarregar(); renderAluno();
  });
  $$('[data-copfb]', el).forEach(b => b.onclick = () => navigator.clipboard?.writeText(S.d.feedbacks.find(f => f.arquivo === b.dataset.copfb).conteudo).then(() => toast('Texto copiado')));
}

// ------------------------------------------------------------ início
$('#btnNovoAluno').onclick = () => dlgAluno();
$('#busca').oninput = renderLista;
$('#btnMenu').onclick = () => $('#lateral').classList.toggle('aberta');
$('#listaAlunos').onclick = e => {
  const li = e.target.closest('li[data-slug]'); if (!li) return;
  if ((S.rascunho?._sujo || S.acomp?._sujo) && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
  abrirAluno(li.dataset.slug, 'painel');
};
window.addEventListener('beforeunload', e => { if (S.rascunho?._sujo || S.acomp?._sujo) { e.preventDefault(); e.returnValue = ''; } });
// recarrega feedbacks quando a janela volta ao foco (o Claude pode ter escrito algo)
window.addEventListener('focus', async () => {
  if (!S.slug || S.rascunho || S.acomp) return;
  const sig = () => S.d.feedbacks.length + ':' + S.d.pedidos.length + ':' + S.d.avaliacoes.length;
  const antes = sig();
  await recarregar();
  if (sig() !== antes) { renderAluno(); toast('O Claude atualizou a pasta do aluno'); }
});

(async () => {
  try { S.status = await api('GET', 'status'); } catch { S.status = {}; }
  $('#statusClaude').textContent = S.status.sdk && S.status.chave ? '● Claude API conectada' : '● Claude Code via pasta do aluno';
  await carregarAlunos();
  const [slug, aba] = location.hash.slice(1).split('/');
  if (slug && S.alunos.some(a => a.slug === slug)) abrirAluno(slug, ABAS.some(x => x[0] === aba) ? aba : 'painel');
})();
})();
