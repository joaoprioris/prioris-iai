// Teste com referência por pares de controle: erro tipo I em mundos com precedência de calendário, e poder. Uso: node fase3_ref.mjs <sims> <modo: fp|poder>
import { simulate, PAIR } from './nucleo.mjs';
import { gen, rng } from './gerador2.mjs';
import { escoresV3, rejeita, pReferencia } from './estimador2.mjs';
const sims = +process.argv[2] || 200, modo = process.argv[3] || 'fp', R = 199;
const rw = rng(2468), fases = () => Array.from({ length: 10 }, () => 2 * Math.PI * rw()), atrasos = () => Array.from({ length: 10 }, () => Math.floor(rw() * 4));
if (modo === 'fp') {
  const G = 20, T = 18, b = 3, W = 12;
  const cen = [['base', () => ({}), 1], ['transitorio_tau2', () => ({ transient: { sd: 1, tau: 2 } }), 1], ['ciclo_grupo_periodo6', () => ({ gCycle: { amp: .6, period: 6, theta: fases() } }), W], ['ciclo_grupo_periodo4', () => ({ gCycle: { amp: .6, period: 4, theta: fases() } }), W], ['cc_atraso', () => ({ fatores: [{ L: new Array(10).fill(1), rho: .8, sd: 1, delay: atrasos() }] }), W], ['causa_comum_forte', () => ({ fatores: [{ L: [1, 1, 1, 1, -1, -1, -1, -1, 1, 1], rho: .8, sd: 1 }] }), 1]];
  console.log('FP % (G=20, T de teste=18, descarte 3): sem referência (t) | com referência de controles');
  for (const [nm, mk, mundos] of cen) {
    let kt = 0, kr = 0, n = 0, maxt = 0, maxr = 0;
    for (let w = 0; w < mundos; w++) { const o = { G, T: T + b, lam: 8, ...mk() }, r = rng(300 + w * 13 + nm.length), rr = rng(1 + w); let a = 0, c = 0; const ns = mundos > 1 ? Math.round(sims / 2) : sims;
      for (let s = 0; s < ns; s++) { const D = gen(o, r); if (rejeita(escoresV3(D, G, T + b, { burn: b }).S)) a++; if (pReferencia(D, G, T + b, { burn: b }, rr, R).p <= 0.05) c++; }
      kt += a / ns; kr += c / ns; maxt = Math.max(maxt, a / ns); maxr = Math.max(maxr, c / ns); n++; }
    console.log([nm, `t=${(100 * kt / n).toFixed(1)} (max ${(100 * maxt).toFixed(0)})`, `ref=${(100 * kr / n).toFixed(1)} (max ${(100 * maxr).toFixed(0)})`].join('\t'));
  }
} else {
  const lam = 8, b = 3;
  console.log('poder %: t | referência de controles; descarte 3 meses; lam 8');
  for (const [nm, mk] of [['rampa_RR2', (G, T, r) => simulate({ G, T, lam, RR: 2, driver: 'A', sizeSd: .0867 }, r)], ['rampa_RR3', (G, T, r) => simulate({ G, T, lam, RR: 3, driver: 'A', sizeSd: .0867 }, r)], ['degrau_RR2', (G, T, r) => simulate({ G, T, lam, RR: 2, driver: 'A', mode: 'step', sizeSd: .0867 }, r)]])
    for (const [G, T] of [[20, 12], [40, 12], [60, 12], [40, 18], [60, 18]]) { const r = rng(5 + G + T), rr = rng(9); let a = 0, c = 0; for (let s = 0; s < sims; s++) { const D = mk(G, T + b, r); if (rejeita(escoresV3(D, G, T + b, { burn: b }).S)) a++; if (pReferencia(D, G, T + b, { burn: b }, rr, R).p <= 0.05) c++; } console.log([nm, G, T, Math.round(100 * a / sims), Math.round(100 * c / sims)].join('\t')); }
}
