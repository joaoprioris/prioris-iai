// Calibração do erro tipo I do estimador da fase 2 sob cenários não iid. Uso: node fase2_fp.mjs <cenario|all> <sims>
import { simulate, rng, wilsonCI } from './nucleo.mjs';
import { componentes, rejeita, efeito } from './estimador.mjs';
const base = { G: 20, T: 12, lam: 8 };
const SC = {
  base: {}, G10: { G: 10 }, lam2: { lam: 2 }, lam4: { lam: 4 }, nb_mes: { nbShape: 2 }, comp_over: { compSd: 0.8 },
  ar_06: { arRho: 0.6, arSd: 0.6 }, ar_09: { arRho: 0.9, arSd: 0.6 }, desiguais: { sizeSd: 1.0 }, skew: { skew: 0.4 },
  tendencia: { trendSd: 0.08 }, tendencia_forte: { trendSd: 0.15 }, sazonal: { seasAmp: 0.6 }, choque_comum: { shockSd: 0.5 },
  circ_ar: { arRho: 0.8, arSd: 0.6, circ: 1.0 }, circ_ar_fraco: { arRho: 0.8, arSd: 0.4, circ: 0.5 },
  tudo_junto: { arRho: 0.6, arSd: 0.4, trendSd: 0.08, shockSd: 0.3, sizeSd: 0.8, nbShape: 3, circ: 0.5 },
};
const name = process.argv[2] || 'all', sims = +process.argv[3] || 1000;
const f = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(1)} [${(100 * lo).toFixed(1)};${(100 * hi).toFixed(1)}]`; };
for (const nm of name === 'all' ? Object.keys(SC) : name.split(',')) {
  const o = { ...base, ...SC[nm] }, r = rng(4242 + nm.length * 13);
  const k = { share: 0, count: 0, bonf3: 0, cobre: 0 }; const crit = (await import('./estimador.mjs')).tCrit;
  for (let s = 0; s < sims; s++) {
    const D = simulate({ ...o, RR: 1 }, r);
    const a = componentes(D, o.G, o.T, { share: true });
    if (rejeita(a.S)) k.share++;
    if (rejeita(componentes(D, o.G, o.T, { share: false }).S)) k.count++;
    if (a.Sc.some(sc => rejeita(sc, 0.05 / 3))) k.bonf3++;
    const e = efeito(a.S, a.Q); if (e.lo <= 0 && e.hi >= 0) k.cobre++;
  }
  console.log(JSON.stringify({ cenario: nm, G: o.G, T: o.T, lam: o.lam, sims, primario_participacao: f(k.share, sims), exposicao_contagem: f(k.count, sims), tres_classes_bonferroni: f(k.bonf3, sims), ic95_cobre_zero: f(k.cobre, sims) }));
}
