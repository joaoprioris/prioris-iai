// A e B: erro tipo I do estimador direcional em cenários adversos adicionais. Uso: node r2_fp.mjs <cenario|all> <sims>
import { gen, escores, rej, rng, ci, PAIR } from './r2_lib.mjs';
const par = (d) => d % 2 === 0 ? 1 : -1;
const sinais = [1, -1, 1, 1, -1, -1, 1, -1, 1, -1]; // sinais fixos para cargas de causa comum com sinal oposto
const fases = [0.3, 2.1, 4.0, 1.2, 5.0, 3.1, 0.9, 2.7, 4.4, 1.8];
const atrasos = [0, 2, 1, 3, 0, 2, 1, 3, 0, 2];
const alt = (d) => d % 2 === 0 ? 0.15 : 0;
const SC = {
  base: {},
  trend_A_sobe_B_desce: { commonTrend: Array.from({ length: 10 }, (_, d) => 0.12 * par(d)) },
  trend_so_pares: { commonTrend: Array.from({ length: 10 }, (_, d) => alt(d)) },
  trend_de_grupo_indep: { gTrend: { sd: 0, idSd: 0.1 } },
  trend_de_grupo_cargas_opostas: { gTrend: { sd: 0.12, L: Array.from({ length: 10 }, (_, d) => par(d)) } },
  trend_de_grupo_mesmo_sinal: { gTrend: { sd: 0.12, L: new Array(10).fill(1) } },
  sazonal_comum_fases_opostas: { season: { amp: 0.6, period: 6, phase: Array.from({ length: 10 }, (_, d) => d % 2 ? Math.PI : 0) } },
  sazonal_comum_fases_aleatorias: { season: { amp: 0.6, period: 12, phase: fases } },
  ciclo_de_grupo_mesma_fase: { gCycle: { amp: 0.6, period: 6, theta: new Array(10).fill(0) } },
  ciclo_de_grupo_fase_por_divida: { gCycle: { amp: 0.6, period: 6, theta: fases } },
  desiguais_lam2: { lam: 2, sizeSd: 1.0 },
  lam1: { lam: 1 }, lam2: { lam: 2 },
  G6: { G: 6 }, G8: { G: 8 }, G10: { G: 10 },
  T6: { T: 6 }, T9: { T: 9 },
  T6_G6_lam2: { T: 6, G: 6, lam: 2 },
  ar_alternancia_cargas_opostas: { fatores: [{ L: sinais, rho: 0.8, sd: 0.8 }] },
  ar_negativo_alternando: { fatores: [{ L: new Array(10).fill(1), rho: -0.7, sd: 0.8 }] },
  ar_negativo_por_divida: { ar: { rho: -0.6, sd: 0.6 } },
  ar_09: { ar: { rho: 0.9, sd: 0.6 } },
  cc_sinal_oposto_forte: { fatores: [{ L: sinais, rho: 0.8, sd: 1.0 }, { L: sinais.map(x => -x), rho: 0.8, sd: 0.7 }, { L: fases.map(Math.cos), rho: 0.9, sd: 0.7 }] },
  cc_mesmo_sinal_forte: { fatores: [{ L: new Array(10).fill(1), rho: 0.8, sd: 1.0 }, { L: sinais, rho: 0.9, sd: 0.8 }] },
  cc_com_atraso_A_antes_de_B: { fatores: [{ L: new Array(10).fill(1), rho: 0.8, sd: 1.0, delay: atrasos }] },
  meses_suprimidos_30pct_lam4: { lam: 4, supMes: 0.3 },
  skew_forte: { skew: 0.8 },
  nb_lam2: { lam: 2, nbShape: 1 },
  B_rampa_vol_sobe: { volRamp: [0.3, 1.5] },
  B_rampa_vol_desce: { volRamp: [1.5, 0.3] },
  B_ar_comeca_em_zero: { ar: { rho: 0.8, sd: 0.8 }, arZero: true },
  B_fator_comeca_em_zero: { fatores: [{ L: [1, 1, 1, 1, -1, -1, -1, -1, 1, 1], rho: 0.8, sd: 1.0 }], arZero: true },
  B_transitorio_inicial_por_bloco: { transient: { sd: 1.0, tau: 2 } },
  B_transitorio_inicial_forte_longo: { transient: { sd: 1.5, tau: 4 } },
  adverso_total: { G: 10, lam: 4, sizeSd: 0.8, nbShape: 2, ar: { rho: 0.6, sd: 0.4 }, gTrend: { sd: 0.1, L: Array.from({ length: 10 }, (_, d) => par(d)) }, fatores: [{ L: sinais, rho: 0.8, sd: 0.8 }], season: { amp: 0.5, period: 6, phase: fases }, supMes: 0.2 },
};
const nm = process.argv[2] || 'all', sims = +process.argv[3] || 2000;
for (const k of nm === 'all' ? Object.keys(SC) : nm.split(',')) {
  const o = { G: 20, T: 12, lam: 8, ...SC[k] }, r = rng(9000 + k.length * 17 + k.charCodeAt(0));
  let d = 0, l = 0;
  for (let s = 0; s < sims; s++) { const D = gen(o, r); if (rej(escores(D, o.G, o.T, PAIR, 'dir').S)) d++; if (rej(escores(D, o.G, o.T, PAIR, 'lag').S)) l++; }
  console.log(JSON.stringify({ cenario: k, G: o.G, T: o.T, lam: o.lam, sims, direcional: ci(d, sims), so_defasagem: ci(l, sims) }));
}
