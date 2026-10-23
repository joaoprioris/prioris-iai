// G: (1) quão frequente é a liberação em que cada dívida aparece com contagem 1 (atribuição trivial ao conjunto de 3 pessoas); (2) custo em poder de ruído de Laplace e de arredondamento nas contagens. Uso: node r2_privacidade.mjs <sims>
import { simulate } from './nucleo.mjs';
import { escores, rej, rng, ci } from './r2_lib.mjs';
const sims = +process.argv[2] || 300, r0 = rng(77);
// (1) Poisson(lam) condicionado a N>=3 (melhor caso: um SED por participante), 10 dívidas equiprováveis
for (const lam of [4, 8, 16]) {
  let rel = 0, apen3 = 0, todosUm = 0, algumUm = 0, nmed = 0; const R = 200000;
  for (let i = 0; i < R; i++) { let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= r0(); } while (p > L); const N = k - 1; if (N < 3) continue; rel++; nmed += N; if (N === 3) apen3++; const c = new Array(10).fill(0); for (let j = 0; j < N; j++) c[Math.floor(r0() * 10)]++; const pos = c.filter(x => x > 0); if (pos.every(x => x === 1)) todosUm++; if (pos.some(x => x === 1)) algumUm++; }
  console.log(JSON.stringify({ lam, grupo_mes_liberado_pct: +(100 * rel / R).toFixed(1), dentre_liberados_N_igual_3_exato_pct: +(100 * apen3 / rel).toFixed(1), todas_as_dividas_com_contagem_1_pct: +(100 * todosUm / rel).toFixed(1), ao_menos_uma_divida_com_contagem_1_pct: +(100 * algumUm / rel).toFixed(1), N_medio: +(nmed / rel).toFixed(1) }));
}
// (2) poder com ruído
const lap = (r, b) => { const u = r() - .5; return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); };
function modif(D, G, T, f) { const n = [], N = []; for (let g = 0; g < G; g++) { const ng = new Int16Array(T * 10), Ng = new Int16Array(T); for (let t = 0; t < T; t++) { let s = 0; for (let d = 0; d < 10; d++) { const v = f(D.n[g][t * 10 + d]); ng[t * 10 + d] = v; s += v; } Ng[t] = s; } n.push(ng); N.push(Ng); } return { n, N }; }
const G = 40, T = 18;
for (const [nm, mk] of [['sem ruído', () => x => x], ['Laplace b=1 (epsilon 1 por contagem)', r => x => Math.max(0, Math.round(x + lap(r, 1)))], ['Laplace b=2', r => x => Math.max(0, Math.round(x + lap(r, 2)))], ['arredondar para múltiplo de 3', () => x => 3 * Math.round(x / 3)], ['arredondar para múltiplo de 5', () => x => 5 * Math.round(x / 5)]]) for (const RR of [1, 2, 3]) {
  const r = rng(11 + RR); let k = 0; for (let s = 0; s < sims; s++) { const D = simulate({ G, T, lam: 8, RR, driver: 'A', sizeSd: .0867 }, r); if (rej(escores(modif(D, G, T, mk(r)), G, T).S)) k++; }
  console.log(JSON.stringify({ mecanismo: nm, G, T, lam: 8, RR_pico: RR, sims, rejeita: ci(k, sims) }));
}
