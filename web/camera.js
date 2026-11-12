/* Câmera guiada para fotos posturais: silhueta, linha de prumo, nível do celular,
   "fantasma" da foto anterior e timer. Sem dependências.

   Camera.abrir({
     posicoes: ['frente', 'lateral-direita', ...],   // sequência da sessão
     inicio: 'frente',                                // posição inicial (opcional)
     fantasmas: { frente: '/clientes/.../frente.jpg' },// foto anterior por posição (opcional)
     aoCapturar: async (pos, dataURL) => {},          // grava a foto
   })
*/
const Camera = (() => {
  'use strict';
  const NOMES = { frente: 'Frente', costas: 'Costas', 'lateral-direita': 'Lateral direita', 'lateral-esquerda': 'Lateral esquerda' };
  const DICAS = {
    frente: 'De frente para a câmera · pés paralelos na largura do quadril · braços soltos, levemente afastados do corpo · olhar no horizonte',
    costas: 'De costas · pés paralelos na largura do quadril · braços soltos, levemente afastados · cabelo preso acima da nuca',
    'lateral-direita': 'Lado DIREITO voltado para a câmera · olhar para a frente · braços soltos ao lado do corpo · maléolo (tornozelo) sobre a linha vermelha',
    'lateral-esquerda': 'Lado ESQUERDO voltado para a câmera · olhar para a frente · braços soltos ao lado do corpo · maléolo (tornozelo) sobre a linha vermelha',
  };
  const W = 300, H = 400; // quadro 3:4 (retrato)
  const TOPO = 22, CHAO = 374;

  // ---------- silhuetas (pontos do lado direito da imagem; o esquerdo é espelhado)
  const ANTERIOR = [[162, 80], [165, 92], [198, 99], [211, 111], [217, 160], [222, 205], [227, 233], [230, 251],
    [222, 254], [215, 236], [208, 192], [203, 152], [197, 130], [193, 160], [187, 182], [195, 212], [194, 252],
    [184, 292], [186, 322], [177, 354], [188, 371], [162, 372], [161, 354], [165, 322], [163, 292], [159, 252], [150, 234]];
  function pathAnterior() {
    const dir = ANTERIOR, esq = [...ANTERIOR].reverse().map(([x, y]) => [W - x, y]);
    return 'M' + [...dir, ...esq.slice(1)].map(p => p.join(',')).join(' L') + ' Z';
  }
  const PERFIL = [[158, 79], [161, 92], [168, 104], [173, 126], [169, 150], [172, 178], [168, 204], [170, 240],
    [167, 290], [163, 330], [159, 357], [186, 372], [143, 373], [144, 357], [141, 322], [144, 292], [139, 252],
    [130, 216], [136, 182], [132, 142], [134, 106], [143, 81]];
  const BRACO = [[146, 100], [141, 160], [146, 214], [155, 232], [163, 221], [159, 160], [159, 102]];
  const pp = pts => 'M' + pts.map(p => p.join(',')).join(' L') + ' Z';

  function svgGuia(pos, mostrarSilhueta) {
    const lateral = pos.startsWith('lateral');
    const espelhar = pos === 'lateral-esquerda';
    const corpo = lateral
      ? `<g ${espelhar ? `transform="translate(${W},0) scale(-1,1)"` : ''}>
           <ellipse cx="148" cy="52" rx="21" ry="27"/><path d="${pp(PERFIL)}"/><path d="${pp(BRACO)}"/>
           <circle cx="158" cy="52" r="2.5" class="ponto-ref"/></g>`
      : `<ellipse cx="150" cy="51" rx="22" ry="28"/><path d="${pathAnterior()}"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="cam-svg" aria-hidden="true">
      <g class="cam-grade">${[...Array(9).keys()].map(i => `<line x1="${(i + 1) * 30}" x2="${(i + 1) * 30}" y1="0" y2="${H}"/>`).join('')}
        ${[...Array(19).keys()].map(i => `<line y1="${(i + 1) * 20}" y2="${(i + 1) * 20}" x1="0" x2="${W}"/>`).join('')}</g>
      <line class="cam-limite" x1="0" x2="${W}" y1="${TOPO}" y2="${TOPO}"/><text x="6" y="${TOPO - 5}" class="cam-txt">cabeça abaixo desta linha</text>
      <line class="cam-limite" x1="0" x2="${W}" y1="${CHAO}" y2="${CHAO}"/><text x="6" y="${CHAO + 14}" class="cam-txt">pés sobre esta linha</text>
      <line class="cam-prumo" x1="150" x2="150" y1="0" y2="${H}"/>
      ${mostrarSilhueta ? `<g class="cam-silhueta">${corpo}</g>` : ''}
    </svg>`;
  }

  // ---------- estado
  let el, stream, op, idx, facing = 'environment', timer = 0, contando = false, nivelOn = false;
  const pref = (k, d) => { try { return JSON.parse(localStorage.getItem('cam.' + k)) ?? d; } catch { return d; } };
  const salvarPref = (k, v) => { try { localStorage.setItem('cam.' + k, JSON.stringify(v)); } catch { /* sem storage */ } };

  function montar() {
    el = document.createElement('div');
    el.className = 'cam';
    el.innerHTML = `
      <div class="cam-topo">
        <button class="cam-btn" data-a="fechar" aria-label="Fechar">✕</button>
        <div class="cam-titulo"><b data-r="titulo"></b><small data-r="passo"></small></div>
        <button class="cam-btn" data-a="trocar" title="Trocar câmera">⟲</button>
      </div>
      <div class="cam-area">
        <div class="cam-quadro" data-r="quadro">
          <video playsinline muted autoplay data-r="video"></video>
          <img data-r="fantasma" class="cam-fantasma" alt="">
          <div data-r="guia" class="cam-guia"></div>
          <div data-r="nivel" class="cam-nivel"><span></span><b></b></div>
          <div data-r="contagem" class="cam-contagem"></div>
          <img data-r="previa" class="cam-previa" alt="">
          <div data-r="erro" class="cam-erro"></div>
        </div>
      </div>
      <div class="cam-dica" data-r="dica"></div>
      <div class="cam-controles" data-r="ctrl">
        <label><input type="checkbox" data-o="silhueta"> Silhueta</label>
        <label><input type="checkbox" data-o="grade"> Grade</label>
        <label data-r="lblFantasma"><input type="checkbox" data-o="fantasma"> Foto anterior
          <input type="range" min="10" max="80" data-o="opac" aria-label="Transparência da foto anterior"></label>
        <label>Timer <select data-o="timer"><option value="0">off</option><option value="3">3 s</option><option value="5">5 s</option><option value="10">10 s</option></select></label>
      </div>
      <div class="cam-base">
        <button class="cam-btn" data-a="anterior">◀</button>
        <button class="cam-disparo" data-a="disparar" aria-label="Tirar foto"></button>
        <button class="cam-btn" data-a="proxima">▶</button>
      </div>
      <div class="cam-base cam-confirma" data-r="confirma">
        <button class="cam-btn largo" data-a="refazer">Refazer</button>
        <button class="cam-btn largo primario" data-a="usar">Usar foto</button>
      </div>`;
    document.body.append(el);
    const r = k => el.querySelector(`[data-r="${k}"]`);
    el.r = r;
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'fechar') fechar();
      else if (a === 'trocar') { facing = facing === 'environment' ? 'user' : 'environment'; iniciarVideo(); }
      else if (a === 'anterior') ir(-1);
      else if (a === 'proxima') ir(1);
      else if (a === 'disparar') disparar();
      else if (a === 'refazer') limparPrevia();
      else if (a === 'usar') usar();
    });
    // opções
    const opt = k => el.querySelector(`[data-o="${k}"]`);
    opt('silhueta').checked = pref('silhueta', true);
    opt('grade').checked = pref('grade', false);
    opt('fantasma').checked = pref('fantasma', true);
    opt('opac').value = pref('opac', 35);
    opt('timer').value = String(pref('timer', 0));
    el.querySelectorAll('[data-o]').forEach(i => i.addEventListener('input', () => {
      salvarPref(i.dataset.o, i.type === 'checkbox' ? i.checked : +i.value); atualizarGuia();
    }));
    el.opt = opt;
    document.addEventListener('keydown', teclas);
  }
  function teclas(e) {
    if (!el?.isConnected) return;
    if (e.key === 'Escape') fechar();
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); el.r('confirma').classList.contains('ver') ? usar() : disparar(); }
  }

  async function iniciarVideo() {
    pararVideo();
    const erro = el.r('erro'); erro.textContent = '';
    if (!navigator.mediaDevices?.getUserMedia) {
      erro.innerHTML = `A câmera ao vivo só funciona em <b>https</b> ou em <b>localhost</b>.<br><br>
        No computador, inicie com:<br><code>python3 servidor.py --rede --https</code><br>
        e abra no celular o endereço <b>https://…</b> que aparece no terminal.<br><br>
        <button class="cam-btn largo" data-a="nativa">Usar a câmera do celular sem guia</button>`;
      erro.querySelector('[data-a="nativa"]').onclick = cameraNativa;
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1920 } },
      });
      const v = el.r('video'); v.srcObject = stream; await v.play().catch(() => {});
      v.classList.toggle('espelho', facing === 'user');
    } catch (e) {
      erro.innerHTML = `Não foi possível abrir a câmera (${e.name}).<br>Permita o acesso à câmera no navegador.<br><br>
        <button class="cam-btn largo" data-a="nativa">Usar a câmera do celular sem guia</button>`;
      erro.querySelector('[data-a="nativa"]').onclick = cameraNativa;
    }
  }
  function pararVideo() { stream?.getTracks().forEach(t => t.stop()); stream = null; }

  function cameraNativa() {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment';
    i.onchange = async () => {
      if (!i.files[0]) return;
      const img = new Image(); img.src = URL.createObjectURL(i.files[0]); await img.decode();
      mostrarPrevia(recortar(img, img.naturalWidth, img.naturalHeight, false));
    };
    i.click();
  }

  function atualizarGuia() {
    const pos = op.posicoes[idx], o = el.opt;
    el.r('titulo').textContent = NOMES[pos] || pos;
    el.r('passo').textContent = op.posicoes.length > 1 ? `Foto ${idx + 1} de ${op.posicoes.length}` : '';
    el.r('dica').textContent = DICAS[pos] || '';
    el.r('guia').innerHTML = svgGuia(pos, o('silhueta').checked);
    el.r('guia').classList.toggle('com-grade', o('grade').checked);
    const f = op.fantasmas?.[pos], img = el.r('fantasma');
    el.r('lblFantasma').style.display = f ? '' : 'none';
    img.style.display = f && o('fantasma').checked ? '' : 'none';
    if (f && img.dataset.src !== f) { img.src = f; img.dataset.src = f; }
    img.style.opacity = o('opac').value / 100;
    el.querySelector('[data-a="anterior"]').style.visibility = idx > 0 ? '' : 'hidden';
    el.querySelector('[data-a="proxima"]').style.visibility = idx < op.posicoes.length - 1 ? '' : 'hidden';
  }
  function ir(d) { idx = Math.max(0, Math.min(op.posicoes.length - 1, idx + d)); limparPrevia(); atualizarGuia(); }

  // ---------- nível (acelerômetro do celular)
  function aoOrientar(e) {
    if (e.beta === null || !el?.isConnected) return;
    const nv = el.r('nivel'); nv.style.display = 'flex';
    // celular em pé: beta ≈ 90, gamma ≈ 0
    const incl = Math.round(e.beta - 90), giro = Math.round(e.gamma || 0);
    const ok = Math.abs(incl) <= 3 && Math.abs(giro) <= 2;
    nv.classList.toggle('ok', ok);
    nv.querySelector('span').style.transform = `translate(${Math.max(-26, Math.min(26, giro * 3))}px, ${Math.max(-26, Math.min(26, incl * 3))}px)`;
    nv.querySelector('b').textContent = ok ? 'nivelado' : `${giro > 0 ? '↺' : '↻'}${Math.abs(giro)}° · ${incl > 0 ? 'incline p/ trás' : 'incline p/ frente'} ${Math.abs(incl)}°`;
  }
  async function ligarNivel() {
    if (nivelOn || typeof DeviceOrientationEvent === 'undefined') return;
    try { if (DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch { return; }
    window.addEventListener('deviceorientation', aoOrientar); nivelOn = true;
  }

  // ---------- captura
  function recortar(fonte, sw, sh, espelhar) {
    // recorta o centro em 3:4 retrato — exatamente o que aparece no quadro
    const alvo = 3 / 4; let cw = sw, ch = sh;
    if (sw / sh > alvo) cw = sh * alvo; else ch = sw / alvo;
    const sx = (sw - cw) / 2, sy = (sh - ch) / 2;
    const esc = Math.min(1, 1600 / ch);
    const c = document.createElement('canvas'); c.width = Math.round(cw * esc); c.height = Math.round(ch * esc);
    const g = c.getContext('2d');
    if (espelhar) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(fonte, sx, sy, cw, ch, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }
  function bip(freq = 880, ms = 120) {
    try {
      const ac = bip.ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
      g.gain.value = 0.15; o.start(); o.stop(ac.currentTime + ms / 1000);
    } catch { /* sem áudio */ }
  }
  async function disparar() {
    const v = el.r('video');
    if (contando || !stream || !v.videoWidth) return;
    timer = +el.opt('timer').value;
    if (timer) {
      contando = true; const c = el.r('contagem');
      for (let s = timer; s > 0; s--) { c.textContent = s; c.classList.add('ver'); bip(660, 90); await new Promise(r => setTimeout(r, 1000)); }
      c.classList.remove('ver'); contando = false;
      if (!el?.isConnected) return;
    }
    bip(1200, 160);
    el.r('quadro').classList.add('flash'); setTimeout(() => el.r('quadro').classList.remove('flash'), 180);
    // câmera frontal: a prévia é espelhada, mas a foto é gravada sem espelho (direita/esquerda reais)
    mostrarPrevia(recortar(v, v.videoWidth, v.videoHeight, false));
  }
  function mostrarPrevia(url) {
    const p = el.r('previa'); p.src = url; p.classList.add('ver'); el.dataURL = url;
    el.r('confirma').classList.add('ver');
  }
  function limparPrevia() { el.r('previa').classList.remove('ver'); el.r('confirma').classList.remove('ver'); el.dataURL = null; }
  async function usar() {
    if (!el.dataURL) return;
    const pos = op.posicoes[idx], b = el.querySelector('[data-a="usar"]');
    b.disabled = true; b.textContent = 'Salvando…';
    try {
      await op.aoCapturar(pos, el.dataURL);
      op.fantasmas = op.fantasmas || {};
      limparPrevia();
      if (idx < op.posicoes.length - 1) { idx++; atualizarGuia(); } else fechar();
    } finally { b.disabled = false; b.textContent = 'Usar foto'; }
  }

  function abrir(opcoes) {
    op = { ...opcoes };
    idx = Math.max(0, op.posicoes.indexOf(op.inicio));
    if (!el?.isConnected) montar();
    document.documentElement.classList.add('cam-aberta');
    limparPrevia(); atualizarGuia(); iniciarVideo(); ligarNivel();
  }
  function fechar() {
    pararVideo();
    window.removeEventListener('deviceorientation', aoOrientar); nivelOn = false;
    document.removeEventListener('keydown', teclas);
    el?.remove(); el = null;
    document.documentElement.classList.remove('cam-aberta');
    op?.aoFechar?.();
  }
  return { abrir, fechar, svgGuia };
})();
