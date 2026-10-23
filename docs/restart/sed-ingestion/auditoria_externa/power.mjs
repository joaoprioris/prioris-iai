// Poder (e RR efetivo) com meu próprio código. Uso: node power.mjs tabela|dimensionamento|classes|supressao <sims> [B]
import { simulate, rng, permTest, groupScores, tTestP, wilsonCI, PAIR } from './core.mjs';
const mode = process.argv[2] || 'tabela', sims = +process.argv[3] || 500, B = +process.argv[4] || 199;
const ci = (k, n) => { const [lo, hi] = wilsonCI(k, n); return `${(100 * k / n).toFixed(0)} [${(100 * lo).toFixed(0)};${(100 * hi).toFixed(0)}]`; };
function cell(G, T, lam, RR, extra = {}, tests = ['perm']) {
  const r = rng(777 + G * 13 + T * 101 + Math.round(lam * 7) + Math.round(RR * 100));
  const rej = { perm: 0, bonf3: 0, minP: 0, t: 0, any: 0, imed: 0, curto: 0, medio: 0 }; let real = 0, rc = 0;
  for (let s = 0; s < sims; s++) {
    let D = simulate({ G, T, lam, RR, ...extra }, r); real += D.realized; rc += D.realizedCount;
    if (extra.suppress) D = suppress(D, G, T);
    const pt = permTest(D, G, T, B, r);
    if (pt.pG <= 0.05) rej.perm++;
    if (Math.min(...pt.pC) * 3 <= 0.05) rej.bonf3++;
    if (pt.pMinP <= 0.05) rej.minP++;
    pt.pC.forEach((p, i) => { if (p * 3 <= 0.05) rej[['imed', 'curto', 'medio'][i]]++; });
    if (tests.includes('t') && tTestP(groupScores(D, G, T)) <= 0.05) rej.t++;
  }
  return { rej, effRR: rc ? real / rc : 1 };
}
// supressão de células com menos de 3 SED (melhor caso: cada SED de um participante distinto), células suprimidas viram ausentes (zero)
function suppress(D, G, T) {
  const n = [], N = [], x = [];
  for (let g = 0; g < G; g++) {
    const ng = new Int16Array(D.n[g].length), Ng = new Int16Array(T), xg = new Int16Array(D.x[g].length);
    for (let i = 0; i < ng.length; i++) if (D.n[g][i] >= 3) ng[i] = D.n[g][i];
    for (let i = 0; i < xg.length; i++) if (D.x[g][i] >= 3) xg[i] = D.x[g][i];
    for (let t = 0; t < T; t++) { let s = 0; for (let d = 0; d < 10; d++) s += ng[t * 10 + d]; Ng[t] = s; }
    n.push(ng); N.push(Ng); x.push(xg);
  }
  return { n, N, x };
}
if (mode === 'tabela') {
  const cfg = [[10,6,8],[10,9,8],[10,12,8],[20,9,8],[20,12,8],[10,12,16],[20,9,16],[40,9,8],[40,12,4]];
  console.log('G\tT\tlam\tRR\tmodo\tRRefetivo\tpoder_global[IC95]');
  for (const [G, T, lam] of cfg) for (const RR of [1.5, 2]) for (const m of ['ramp', 'step']) {
    const { rej, effRR } = cell(G, T, lam, RR, { mode: m, sizeSd: 0.15 * Math.sqrt(1/3) * 0 + 0.0867 });
    console.log([G, T, lam, RR, m, effRR.toFixed(3), ci(rej.perm, sims)].join('\t'));
  }
} else if (mode === 'dimensionamento') {
  const Gs = [10, 15, 20, 30, 40, 60], Ts = [9, 12, 18], lams = [4, 8, 16];
  console.log('modo=ramp (premissas do documento), perm global. G\tT\tlam\tRR\tpoder');
  for (const lam of lams) for (const T of Ts) for (const G of Gs) for (const RR of [1.5, 2]) {
    const { rej, effRR } = cell(G, T, lam, RR, { mode: 'ramp', sizeSd: 0.0867 });
    console.log([G, T, lam, RR, effRR.toFixed(3), ci(rej.perm, sims)].join('\t'));
  }
} else if (mode === 'dimstep') {
  const Gs = [10, 20, 30, 40, 60], Ts = [12, 18], lams = [8];
  console.log('modo=step (RR constante 1.5 ou 2.0 quando ha exposicao na janela). G\tT\tlam\tRR\tRRefet\tpoder');
  for (const lam of lams) for (const T of Ts) for (const G of Gs) for (const RR of [1.5, 2]) {
    const { rej, effRR } = cell(G, T, lam, RR, { mode: 'step', sizeSd: 0.0867 });
    console.log([G, T, lam, RR, effRR.toFixed(3), ci(rej.perm, sims)].join('\t'));
  }
} else if (mode === 'classes') {
  console.log('Poder por classe de prazo (Bonferroni 3) e global; efeito presente nas 3 classes. G\tT\tlam\tRR\tglobal\tqualquer_classe(bonf3)\tminP\timed\tcurto\tmedio');
  for (const [G, T, lam] of [[10,12,8],[20,12,8],[40,12,8]]) for (const RR of [1.5, 2]) {
    const { rej } = cell(G, T, lam, RR, { mode: 'ramp', sizeSd: 0.0867 });
    console.log([G, T, lam, RR, ci(rej.perm, sims), ci(rej.bonf3, sims), ci(rej.minP, sims), ci(rej.imed, sims), ci(rej.curto, sims), ci(rej.medio, sims)].join('\t'));
  }
} else if (mode === 'supressao') {
  console.log('Poder com supressao (celulas com <3 SED viram ausentes). G\tT\tlam\tRR\tpoder_global');
  for (const [G, T, lam] of [[10,12,8],[20,12,8],[20,12,16],[20,12,40],[20,12,100],[10,12,100]]) for (const RR of [1, 1.5, 2]) {
    const { rej } = cell(G, T, lam, RR, { mode: 'ramp', sizeSd: 0.0867, suppress: true });
    console.log([G, T, lam, RR, ci(rej.perm, sims)].join('\t'));
  }
}
