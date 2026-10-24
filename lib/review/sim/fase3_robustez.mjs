// Robustez do estimador a processos com direção no tempo: descarte inicial, remoção de tendência por grupo, janela cheia. Uso: node fase3_robustez.mjs <sims> [G] [T]
import { gen, rng, ci } from './gerador2.mjs';
import { escoresV3, rejeita } from './estimador2.mjs';
const sims = +process.argv[2] || 600, G = +process.argv[3] || 20, T = +process.argv[4] || 18, lam = 8;
const V = { v2: {}, b2: { burn: 2 }, b3: { burn: 3 }, b2_det: { burn: 2, detrend: true }, b2_cheia: { burn: 2, janela: 'cheia' }, b3_det_cheia: { burn: 3, detrend: true, janela: 'cheia' } };
const rw = rng(2468), W = 12;
const fases = () => Array.from({ length: 10 }, () => 2 * Math.PI * rw());
const atrasos = () => Array.from({ length: 10 }, () => Math.floor(rw() * 4));
const cen = [
  ['base', () => ({})],
  ['transitorio_tau2', () => ({ transient: { sd: 1.0, tau: 2 } })],
  ['transitorio_forte_tau4', () => ({ transient: { sd: 1.5, tau: 4 } })],
  ['ar_comeca_em_zero', () => ({ ar: { rho: 0.8, sd: 0.8 }, arZero: true })],
  ['ciclo_grupo_periodo6 (12 mundos)', () => ({ gCycle: { amp: 0.6, period: 6, theta: fases() } })],
  ['ciclo_grupo_periodo4 (12 mundos)', () => ({ gCycle: { amp: 0.6, period: 4, theta: fases() } })],
  ['cc_atraso (12 mundos)', () => ({ fatores: [{ L: new Array(10).fill(1), rho: 0.8, sd: 1.0, delay: atrasos() }] })],
  ['tendencia_grupo_sinais_opostos', () => ({ gTrend: { sd: 0.08, L: [1, 1, 1, 1, -1, -1, -1, -1, 1, -1] } })],
];
const k = {}; const out = [];
for (const [nm, mk] of cen) {
  const mundos = nm.includes('mundos') ? W : 1, tot = {}; for (const v of Object.keys(V)) tot[v] = 0;
  const por = {}; for (const v of Object.keys(V)) por[v] = [];
  for (let w = 0; w < mundos; w++) {
    const o = { G, T, lam, ...mk() }, r = rng(500 + w * 7 + nm.length), c = {}; for (const v of Object.keys(V)) c[v] = 0;
    const n = mundos > 1 ? Math.max(200, Math.round(sims / 2)) : sims;
    for (let s = 0; s < n; s++) { const D = gen(o, r); for (const [v, op] of Object.entries(V)) if (rejeita(escoresV3(D, G, T, op).S)) c[v]++; }
    for (const v of Object.keys(V)) { por[v].push(c[v] / n); tot[v] += c[v] / n; }
  }
  const row = { cenario: nm, G, T };
  for (const v of Object.keys(V)) row[v] = mundos > 1 ? `media ${(100 * tot[v] / mundos).toFixed(1)} max ${(100 * Math.max(...por[v])).toFixed(1)}` : (100 * tot[v]).toFixed(1);
  console.log(JSON.stringify(row)); out.push(row);
}
