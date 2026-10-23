// E: o controle negativo agrupado (60 pares fora da matriz) é contaminado por efeito real em pares da matriz que compartilham A ou B? Uso: node r2_controle.mjs <sims>
import { gen, escores, rej, rng, ci, PAIR, CTRL } from './r2_lib.mjs';
import { tstat } from './r2_lib.mjs';
const sims = +process.argv[2] || 500, G = 40, T = 18;
const sinais = [1, -1, 1, 1, -1, -1, 1, -1, 1, -1];
const subA0 = PAIR.filter(q => q.a === 0);                  // 3 pares da matriz com origem D1; o controle tem 6 pares com origem D1
const subB5 = PAIR.filter(q => q.b === 5);                  // todos os pares da matriz que chegam em D6 (6 pares); o controle tem pares chegando em D6
const bloco0 = PAIR.filter(q => q.a < 4);
const compartilha = (sub) => CTRL.filter(c => sub.some(q => q.a === c.a || q.b === c.b)).length;
const casos = [
  ['efeito em todos os 30 pares, A iid', { pairs: PAIR }, {}],
  ['efeito em todos os 30 pares, A persistente (AR 0,8)', { pairs: PAIR }, { ar: { rho: .8, sd: .6 } }],
  ['efeito em todos os 30 pares, causa comum persistente de sinais mistos', { pairs: PAIR }, { fatores: [{ L: sinais, rho: .8, sd: 1 }] }],
  ['efeito só nos 3 pares com A=D1', { pairs: subA0 }, {}],
  ['efeito só nos pares que chegam em D6', { pairs: subB5 }, {}],
  ['efeito só nos pares com A no bloco D1 a D4, causa comum do mesmo bloco', { pairs: bloco0 }, { fatores: [{ L: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0], rho: .8, sd: 1 }] }],
  ['efeito em 6 pares FORA da matriz (matriz incompleta), nenhum na matriz', { pairs: CTRL.slice(0, 6) }, {}],
  ['efeito em 12 pares fora da matriz', { pairs: CTRL.slice(0, 12) }, {}],
];
for (const [nm, ef, ex] of casos) for (const beta of [0.15]) {
  const o = { G, T, lam: 8, ...ex, efeito: { beta, pairs: ef.pairs } }, r = rng(777 + nm.length); let prim = 0, ctrl = 0, tc = 0, tp = 0;
  for (let s = 0; s < sims; s++) { const D = gen(o, r); const a = escores(D, G, T, PAIR).S, c = escores(D, G, T, CTRL).S; if (rej(a)) prim++; if (rej(c)) ctrl++; tp += tstat(a); tc += tstat(c); }
  console.log(JSON.stringify({ caso: nm, G, T, beta_aditivo: beta, pares_controle_que_compartilham_A_ou_B_com_os_pares_com_efeito: compartilha(ef.pairs), primario_rejeita: ci(prim, sims), controle_rejeita: ci(ctrl, sims), t_medio_primario: +(tp / sims).toFixed(2), t_medio_controle: +(tc / sims).toFixed(2) }));
}
