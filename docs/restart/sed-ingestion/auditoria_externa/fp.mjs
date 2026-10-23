// Calibração do erro tipo I sob H0 (sem conversão) em cenários adversos. Uso: node fp.mjs <cenario|all> <sims> [B]
import { simulate, rng, permTest, groupScores, tTestP, wilsonCI } from './core.mjs';
const base = { G: 10, T: 12, lam: 8 };
export const SC = {
  base: {},
  lam2: { lam: 2 }, lam4: { lam: 4 },
  g20: { G: 20 },
  nb_mes: { nbShape: 2 },                       // sobredispersão do volume entre meses
  comp_over: { compSd: 0.8 },                   // sobredispersão da composição (mix de dívidas varia entre meses)
  ar_06: { arRho: 0.6, arSd: 0.6 },             // autocorrelação do mix por grupo
  ar_09: { arRho: 0.9, arSd: 0.6 },
  desiguais: { sizeSd: 1.0 },                   // grupos muito desiguais
  skew: { skew: 0.4 },                           // dívidas com participações muito diferentes
  tendencia: { trendSd: 0.08 },                 // deriva comum a todos os grupos (por dívida, ~ +-8%/mês)
  tendencia_forte: { trendSd: 0.15 },
  sazonal: { seasAmp: 0.6 },                    // sazonalidade comum (período 6 meses)
  choque_comum: { shockSd: 0.5 },               // choque mensal compartilhado por todos os grupos (evento do cliente)
  choque_comum_g20: { shockSd: 0.5, G: 20 },
  circ_ar: { arRho: 0.8, arSd: 0.6, circ: 1.0 },// classificador circular: adjacente escolhido segundo o que já está latente
  circ_ar_fraco: { arRho: 0.8, arSd: 0.4, circ: 0.5 },
  circ_sem_ar: { circ: 1.0 },                   // classificador circular mas sem persistência (controle)
};
const name = process.argv[2] || 'all', sims = +process.argv[3] || 300, B = +process.argv[4] || 199;
const names = name === 'all' ? Object.keys(SC) : name.split(',');
const rows = [];
for (const nm of names) {
  const o = { ...base, ...SC[nm] }; const r = rng(12345 + nm.length * 7);
  let rej = { perm: 0, minP: [0, 0, 0, 0], shift: 0, t: 0, tAdj: 0, bonf3: 0, holm3: 0 };
  for (let s = 0; s < sims; s++) {
    const D = simulate({ ...o, RR: 1 }, r);
    const pt = permTest(D, o.G, o.T, B, r);
    if (pt.pG <= 0.05) rej.perm++;
    if (pt.pMinP <= 0.05) rej.minP[0]++;
    const pm = Math.min(...pt.pC); if (pm * 3 <= 0.05) rej.bonf3++;
    const sp = [...pt.pC].sort((a, b) => a - b); if (sp[0] * 3 <= 0.05) rej.holm3++; // Holm: o primeiro passo é igual a Bonferroni (FWER de rejeitar ao menos uma é igual)
    if (tTestP(groupScores(D, o.G, o.T)) <= 0.05) rej.t++;
    if (tTestP(groupScores(D, o.G, o.T, { adjustHist: true })) <= 0.05) rej.tAdj++;
    const ps = permTest(D, o.G, o.T, 99, r, { shift: true }); if (ps.pG <= 0.05) rej.shift++;
  }
  const f = (k) => { const [lo, hi] = wilsonCI(k, sims); return `${(100 * k / sims).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
  console.log(JSON.stringify({ cenario: nm, G: o.G, T: o.T, lam: o.lam, sims, perm_doc: f(rej.perm), perm_minP3classes: f(rej.minP[0]), bonf3_classes: f(rej.bonf3), shift_circ: f(rej.shift), t_grupos_demean: f(rej.t), t_grupos_demean_hist: f(rej.tAdj) }));
}
