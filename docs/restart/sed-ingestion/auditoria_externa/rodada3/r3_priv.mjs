// F: o que sobra do risco de reidentificação com piso 5 e dominância 50%; fração de grupos-mês liberados; custo em poder da supressão por mês. Uso: node r3_priv.mjs
import { gen, esc3, rej, rng, ci, PAIR, lib } from './r3_lib.mjs';
const r = rng(77); const pois = (l) => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
const R = 100000;
console.log('m = número de participantes ativos do grupo (atividade igual); liberado = pelo menos 5 distintos e nenhum acima de 50% dos SED');
for (const act of ['igual', 'desigual (Dirichlet 0,5)']) for (const m of [5, 8, 12, 20]) for (const lam of [4, 8, 16]) {
  const w = new Array(m).fill(1); if (act !== 'igual') { for (let i = 0; i < m; i++) w[i] = (-Math.log(r() || 1e-9)) ** 2; } const sw = w.reduce((a, b) => a + b, 0);
  let rel = 0, n5 = 0, nle6 = 0, todos1 = 0, algum1 = 0, sing = 0, tot = 0, d5 = 0;
  for (let i = 0; i < R; i++) { const N = pois(lam); if (N < 5) continue; const per = new Array(m).fill(0); for (let j = 0; j < N; j++) { let u = r() * sw, q = 0; while (q < m - 1 && u > w[q]) { u -= w[q]; q++; } per[q]++; }
    const dist = per.filter(x => x > 0).length, mx = Math.max(...per); if (dist < 5 || mx * 2 > N) continue; rel++; if (N <= 6) nle6++; if (dist === 5) d5++;
    const c = new Array(10).fill(0); for (let j = 0; j < N; j++) c[Math.floor(r() * 10)]++; const pos = c.filter(x => x > 0); if (pos.every(x => x === 1)) todos1++; if (pos.some(x => x === 1)) algum1++; sing += pos.filter(x => x === 1).length; tot += N; }
  console.log(JSON.stringify({ atividade: act, m, lam, grupo_mes_liberado_pct: +(100 * rel / R).toFixed(1), dentre_liberados_N_ate_6: rel ? +(100 * nle6 / rel).toFixed(1) : null, exatamente_5_distintos: rel ? +(100 * d5 / rel).toFixed(1) : null, todas_dividas_com_contagem_1: rel ? +(100 * todos1 / rel).toFixed(1) : null, ao_menos_uma_divida_com_contagem_1: rel ? +(100 * algum1 / rel).toFixed(1) : null, fracao_dos_SED_em_celulas_de_contagem_1: tot ? +(100 * sing / tot).toFixed(1) : null }));
}
// poder com meses suprimidos aleatoriamente (aditivo 0,10, 40 grupos, 18 meses de teste + 3 de descarte)
for (const pm of [0, 0.2, 0.4, 0.6]) { const rr = rng(5); let c = 0, n = 400; for (let s = 0; s < n; s++) { const D = gen({ G: 40, T: 21, lam: 8, supMes: pm, efeito: { beta: .10, pairs: PAIR } }, rr); if (rej(esc3(D, 40, 21, { burnY: 3, skipMissing: true }).S)) c++; } console.log(JSON.stringify({ fracao_de_grupos_mes_suprimidos: pm, poder_aditivo_0_10_G40_T18: ci(c, n) })); }
