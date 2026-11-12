/* Cálculos antropométricos e classificações.
   Referências:
   - Jackson & Pollock (1978) / Jackson, Pollock & Ward (1980): 7 e 3 dobras
   - Durnin & Womersley (1974): 4 dobras
   - Faulkner (1968): 4 dobras
   - Siri (1961): densidade → % gordura
   - OMS: IMC e RCQ · Ashwell: relação cintura/estatura
   - Diretrizes Brasileiras de Hipertensão Arterial (2020): PA
*/
const Calc = (() => {
  const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;
  const r = (v, c = 1) => v === null || !isFinite(v) ? null : Math.round(v * 10 ** c) / 10 ** c;

  function idade(nasc, dataRef) {
    if (!nasc) return null;
    const n = new Date(nasc + 'T00:00'), d = dataRef ? new Date(dataRef + 'T00:00') : new Date();
    let i = d.getFullYear() - n.getFullYear();
    if (d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) i--;
    return i;
  }

  const siri = D => (4.95 / D - 4.50) * 100;

  const PROTOCOLOS = {
    jp7: {
      nome: 'Jackson & Pollock 7 dobras',
      dobras: ['peitoral', 'axilar_media', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
      calc(S, id, sexo) {
        const D = sexo === 'M'
          ? 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * id
          : 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * id;
        return { D, G: siri(D) };
      }
    },
    jp3: {
      nome: 'Jackson & Pollock 3 dobras',
      dobras: sexo => sexo === 'M' ? ['peitoral', 'abdominal', 'coxa'] : ['triceps', 'suprailiaca', 'coxa'],
      calc(S, id, sexo) {
        const D = sexo === 'M'
          ? 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * id
          : 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * id;
        return { D, G: siri(D) };
      }
    },
    durnin: {
      nome: 'Durnin & Womersley 4 dobras',
      dobras: ['biceps', 'triceps', 'subescapular', 'suprailiaca'],
      calc(S, id, sexo) {
        const T = sexo === 'M'
          ? [[19, 1.1620, 0.0630], [29, 1.1631, 0.0632], [39, 1.1422, 0.0544], [49, 1.1620, 0.0700], [200, 1.1715, 0.0779]]
          : [[19, 1.1549, 0.0678], [29, 1.1599, 0.0717], [39, 1.1423, 0.0632], [49, 1.1333, 0.0612], [200, 1.1339, 0.0645]];
        const [, c, m] = T.find(t => id <= t[0]);
        const D = c - m * Math.log10(S);
        return { D, G: siri(D) };
      }
    },
    faulkner: {
      nome: 'Faulkner 4 dobras',
      dobras: ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
      calc(S) { return { D: null, G: 0.153 * S + 5.783 }; }
    }
  };

  function dobrasDoProtocolo(p, sexo) {
    const d = PROTOCOLOS[p]?.dobras;
    return typeof d === 'function' ? d(sexo) : (d || []);
  }

  function classeIMC(imc) {
    if (imc === null) return null;
    if (imc < 18.5) return 'Abaixo do peso';
    if (imc < 25) return 'Eutrófico';
    if (imc < 30) return 'Sobrepeso';
    if (imc < 35) return 'Obesidade grau I';
    if (imc < 40) return 'Obesidade grau II';
    return 'Obesidade grau III';
  }

  function classeGordura(g, sexo) {
    if (g === null) return null;
    const t = sexo === 'M' ? [5, 13, 17, 24] : [13, 20, 24, 31];
    if (g <= t[0]) return 'Essencial';
    if (g <= t[1]) return 'Atleta';
    if (g <= t[2]) return 'Boa forma';
    if (g <= t[3]) return 'Média';
    return 'Acima da média';
  }

  function classePA(s, d) {
    if (s === null || d === null) return null;
    const cat = (v, lim) => lim.findIndex(l => v < l);
    const ns = [120, 130, 140, 160, 180, Infinity], nd = [80, 85, 90, 100, 110, Infinity];
    const idx = Math.max(cat(s, ns), cat(d, nd));
    return ['Ótima', 'Normal', 'Pré-hipertensão', 'Hipertensão estágio 1', 'Hipertensão estágio 2', 'Hipertensão estágio 3'][idx];
  }

  function classeSpO2(v) {
    if (v === null) return null;
    if (v >= 95) return 'Normal';
    if (v >= 91) return 'Atenção (91–94%)';
    return 'Baixa (≤90%) — encaminhar';
  }

  function classeFC(v) {
    if (v === null) return null;
    if (v < 60) return 'Bradicardia (<60)';
    if (v <= 100) return 'Normal';
    return 'Taquicardia (>100)';
  }

  function resultados(av, cliente) {
    const sexo = cliente.sexo, id = idade(cliente.nascimento, av.data);
    const peso = num(av.peso), alt = num(av.altura) || num(cliente.altura);
    const c = av.circunferencias || {}, dob = av.dobras || {};
    const out = { idade: id };
    if (peso && alt) { out.imc = r(peso / (alt / 100) ** 2); out.imc_classe = classeIMC(out.imc); }
    const cint = num(c.cintura), quad = num(c.quadril);
    if (cint && quad) {
      out.rcq = r(cint / quad, 2);
      out.rcq_risco = out.rcq >= (sexo === 'M' ? 0.90 : 0.85) ? 'Risco elevado' : 'Adequado';
    }
    if (cint && alt) { out.rce = r(cint / alt, 2); out.rce_risco = out.rce >= 0.5 ? 'Risco elevado (≥0,50)' : 'Adequado'; }
    // dobras
    const todas = Object.values(dob).map(num).filter(v => v !== null);
    if (todas.length) out.soma_todas_dobras = r(todas.reduce((a, b) => a + b, 0));
    const p = av.protocolo;
    if (p && PROTOCOLOS[p] && sexo && id !== null) {
      const lista = dobrasDoProtocolo(p, sexo);
      const vals = lista.map(k => num(dob[k]));
      if (vals.every(v => v !== null && v > 0)) {
        const S = vals.reduce((a, b) => a + b, 0);
        const { D, G } = PROTOCOLOS[p].calc(S, id, sexo);
        out.protocolo_nome = PROTOCOLOS[p].nome;
        out.soma_dobras = r(S);
        if (D) out.densidade = r(D, 4);
        out.percentual_gordura = r(G);
        out.gordura_classe = classeGordura(out.percentual_gordura, sexo);
        if (peso) {
          out.massa_gorda = r(peso * G / 100);
          out.massa_magra = r(peso - out.massa_gorda);
        }
      } else {
        out.faltam_dobras = lista.filter(k => num(dob[k]) === null);
      }
    }
    // pressão arterial
    const s = av.sinais || {};
    const leituras = (s.pa || []).map(x => [num(x.sis), num(x.dia)]).filter(([a, b]) => a && b);
    if (leituras.length) {
      const ms = Math.round(leituras.reduce((a, x) => a + x[0], 0) / leituras.length);
      const md = Math.round(leituras.reduce((a, x) => a + x[1], 0) / leituras.length);
      out.pa_sis = ms; out.pa_dia = md;
      out.pa_media = `${ms}/${md}`;
      out.pa_classe = classePA(ms, md);
      out.pam = Math.round(md + (ms - md) / 3);
    }
    if (num(s.spo2) !== null) out.spo2 = num(s.spo2);
    if (num(s.spo2) !== null) out.spo2_classe = classeSpO2(num(s.spo2));
    if (num(s.fc_repouso) !== null) out.fc_classe = classeFC(num(s.fc_repouso));
    if (id !== null) out.fc_max_estimada = Math.round(208 - 0.7 * id); // Tanaka
    return out;
  }

  return { idade, resultados, PROTOCOLOS, dobrasDoProtocolo, num, classePA, classeSpO2, classeFC };
})();
