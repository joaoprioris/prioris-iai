// C: níveis de promoção da v3, com minhas contas. Uso: node r3_niveis.mjs <sims>
import { simulate } from './nucleo.mjs';
import { esc3, pval, rng, ci, CTRL, tstat, rej, PAIR, gen } from './r3_lib.mjs';
const sims = +process.argv[2] || 400, b = 3, lam = 8;
const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const qn = (p) => { let lo = -9, hi = 9; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
const zOf = (x) => qn(1 - Math.min(Math.max(pval(x), 1e-12), 1 - 1e-12));
const des = [['40x18 (14/13/13)', 18, [14, 13, 13]], ['60x12 (20/20/20)', 12, [20, 20, 20]], ['60x12 (36/14/10)', 12, [36, 14, 10]], ['60x12 (45/10/5)', 12, [45, 10, 5]]];
const ef = { nenhum: { RRc: [1, 1, 1] }, rampa_RR2: { RRc: [2, 2, 2] }, rampa_RR3: { RRc: [3, 3, 3] }, so_1_de_3_RR3: { RRc: [3, 1, 1] }, so_1_de_3_RR5: { RRc: [5, 1, 1] }, em_2_de_3_RR3: { RRc: [3, 3, 1] } };
const BETA_MIN = 0.0189; // beta estimado esperado para efeito aditivo injetado 0,10 (fase3_atenuacao.jsonl); só para mostrar o efeito da regra de efeito mínimo
for (const [nm, T, split] of des) for (const [en, ex] of Object.entries(ef)) {
  const r = rng(321 + T + split[0] + en.length * 3); const k = { n1: 0, n1any: 0, st: 0, pos: 0, ctrl: 0, n3: 0, n3b: 0, het: 0 }; const bq = [];
  for (let s = 0; s < sims; s++) {
    const cl = split.map((Gc, i) => { const D = simulate({ G: Gc, T: T + b, lam, driver: 'A', sizeSd: .0867, RR: ex.RRc[i] }, r); const a = esc3(D, Gc, T + b, { burnY: b }), c = esc3(D, Gc, T + b, { burnY: b, pairs: CTRL }); return { z: zOf(a.S), zc: zOf(c.S), S: a.S, Q: a.Q }; });
    const Zs = cl.reduce((a, c) => a + c.z, 0) / Math.sqrt(3), Zc = cl.reduce((a, c) => a + c.zc, 0) / Math.sqrt(3);
    const sS = cl.reduce((a, c) => a + c.S.reduce((x, y) => x + y, 0), 0), sQ = cl.reduce((a, c) => a + c.Q.reduce((x, y) => x + y, 0), 0), beta = sS / sQ; bq.push(beta);
    const cOK = Zc < 2.326, st = Zs > 1.645, pos = cl.every(c => c.z > 0);
    if (cl[0].z > 1.645 && cOK) k.n1++; if (cl.some(c => c.z > 1.645) && cOK) k.n1any++; if (st) k.st++; if (pos) k.pos++; if (cOK) k.ctrl++; if (st && pos && cOK) k.n3++; if (st && pos && cOK && beta >= BETA_MIN) k.n3b++;
  }
  bq.sort((a, b2) => a - b2);
  console.log(JSON.stringify({ desenho: nm, efeito: en, sims, N1_ref: ci(k.n1, sims), N1_livre: ci(k.n1any, sims), Stouffer: ci(k.st, sims), sinal3: ci(k.pos, sims), controle_ok: ci(k.ctrl, sims), N3_estat: ci(k.n3, sims), N3_estat_e_beta_ge_0_0189: ci(k.n3b, sims), beta_mediana: +bq[sims >> 1].toFixed(4), beta_p10: +bq[Math.floor(sims * .1)].toFixed(4), beta_p90: +bq[Math.floor(sims * .9)].toFixed(4) }));
}
