// D: cobertura do IC95 (Fieller de estimador.mjs, Wald por delta e jackknife por grupo) sob a nula e sob efeito aditivo conhecido. Uso: node r2_cobertura.mjs <sims>
import { efeito } from './estimador.mjs';
import { escores, gen, rng, ci, PAIR, qt } from './r2_lib.mjs';
const sims = +process.argv[2] || 1500;
const comp = (D, G, T) => { const dir = escores(D, G, T, PAIR, 'dir'), lag = escores(D, G, T, PAIR, 'lag'); return { S: dir.S, Q: lag.Q }; }; // mesma definição de beta de estimador.mjs: S direcional, Q da defasagem
function wald(S, Q) { const G = S.length, sS = S.reduce((a, b) => a + b, 0), sQ = Q.reduce((a, b) => a + b, 0), b = sS / sQ; const U = S.map((s, i) => s - b * Q[i]); const m = U.reduce((a, c) => a + c, 0) / G, v = U.reduce((a, c) => a + (c - m) ** 2, 0) / (G - 1); const se = Math.sqrt(G * v) / sQ; const c = qt(G - 1, .025); return [b - c * se, b + c * se]; }
function jack(S, Q) { const G = S.length, sS = S.reduce((a, b) => a + b, 0), sQ = Q.reduce((a, b) => a + b, 0), b = sS / sQ; const bi = S.map((s, i) => (sS - s) / (sQ - Q[i])); const mb = bi.reduce((a, c) => a + c, 0) / G; const se = Math.sqrt((G - 1) / G * bi.reduce((a, c) => a + (c - mb) ** 2, 0)); const c = qt(G - 1, .025); return [b - c * se, b + c * se]; }
const cfgs = [
  { nome: 'nula G20 T12', G: 20, T: 12, beta: 0 }, { nome: 'nula G40 T18', G: 40, T: 18, beta: 0 }, { nome: 'nula G10 T12', G: 10, T: 12, beta: 0 },
  { nome: 'beta 0,3 G20 T12', G: 20, T: 12, beta: 0.3 }, { nome: 'beta 0,3 G40 T18', G: 40, T: 18, beta: 0.3 }, { nome: 'beta 0,3 G40 T18 A persistente', G: 40, T: 18, beta: 0.3, ar: { rho: .8, sd: .6 } },
  { nome: 'beta 0,1 G40 T18', G: 40, T: 18, beta: 0.1 },
];
// valor populacional de referência: média de beta_hat com G grande
const popRef = (c) => { const r = rng(1), b = []; for (let s = 0; s < 12; s++) { const D = gen({ G: 300, T: c.T, lam: 8, ar: c.ar || null, efeito: c.beta ? { beta: c.beta, pairs: PAIR } : null }, r); const { S, Q } = comp(D, 300, c.T); b.push(S.reduce((a, x) => a + x, 0) / Q.reduce((a, x) => a + x, 0)); } return b.reduce((a, x) => a + x, 0) / b.length; };
for (const c of cfgs) {
  const ref = popRef(c), r = rng(321 + c.G + c.T + Math.round(c.beta * 100)); const k = { f_inj: 0, f_pop: 0, w_inj: 0, w_pop: 0, j_inj: 0, j_pop: 0 }; let bm = 0;
  for (let s = 0; s < sims; s++) {
    const D = gen({ G: c.G, T: c.T, lam: 8, ar: c.ar || null, efeito: c.beta ? { beta: c.beta, pairs: PAIR } : null }, r); const { S, Q } = comp(D, c.G, c.T); bm += S.reduce((a, x) => a + x, 0) / Q.reduce((a, x) => a + x, 0);
    const f = efeito(S, Q); if (f.lo <= c.beta && c.beta <= f.hi) k.f_inj++; if (f.lo <= ref && ref <= f.hi) k.f_pop++;
    const w = wald(S, Q); if (w[0] <= c.beta && c.beta <= w[1]) k.w_inj++; if (w[0] <= ref && ref <= w[1]) k.w_pop++;
    const j = jack(S, Q); if (j[0] <= c.beta && c.beta <= j[1]) k.j_inj++; if (j[0] <= ref && ref <= j[1]) k.j_pop++;
  }
  console.log(JSON.stringify({ cenario: c.nome, beta_injetado: c.beta, beta_populacional_de_referencia: +ref.toFixed(4), beta_hat_medio: +(bm / sims).toFixed(4), sims, fieller_cobre_injetado: ci(k.f_inj, sims), fieller_cobre_populacional: ci(k.f_pop, sims), wald_delta_cobre_pop: ci(k.w_pop, sims), jackknife_cobre_pop: ci(k.j_pop, sims) }));
}
