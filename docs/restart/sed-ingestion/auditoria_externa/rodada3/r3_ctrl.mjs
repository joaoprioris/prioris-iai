// D: em que mundos o controle negativo unilateral (1%) dispara, e quanto ele protege? Um cliente, G=20 (e 40), T teste 18 após descarte 3. Uso: node r3_ctrl.mjs <sims por mundo> <mundos>
import { gen, esc3, rej, rng, ci, PAIR, CTRL } from './r3_lib.mjs';
import { simulate } from './nucleo.mjs';
const sims = +process.argv[2] || 500, W = +process.argv[3] || 12, b = 3, Tt = 18, T = Tt + b, G = 20;
const rw = rng(2468), r = rng(5);
const fases = () => Array.from({ length: 10 }, () => 2 * Math.PI * rw()), atrasos = () => Array.from({ length: 10 }, () => Math.floor(rw() * 4));
const ordenadas = Array.from({ length: 10 }, (_, d) => d * 2 * Math.PI / 10 * 0.6); // fases crescentes com o índice da dívida
function bloco(nome, mk, mundos, extra = {}, simf = null) {
  let p = 0, c = 0, pc = 0, n = 0;
  for (let w = 0; w < mundos; w++) { const o = { G, T, lam: 8, ...mk(), ...extra }; for (let s = 0; s < sims; s++) { const D = simf ? simf(o, r) : gen(o, r); const a = rej(esc3(D, o.G, T, { burnY: b }).S), cc = rej(esc3(D, o.G, T, { burnY: b, pairs: CTRL }).S, 0.01); n++; if (a) p++; if (cc) c++; if (a && !cc) pc++; } }
  console.log(JSON.stringify({ cenario: nome, mundos, sims_total: n, primario_rejeita_5pct: ci(p, n), controle_rejeita_1pct: ci(c, n), primario_rejeita_e_controle_limpo: ci(pc, n), fracao_dos_falsos_positivos_barrados_pelo_controle: p ? +(1 - pc / p).toFixed(2) : null }));
}
bloco('nula_base', () => ({}), 1);
bloco('ciclo_grupo_periodo6 (12 mundos)', () => ({ gCycle: { amp: 0.6, period: 6, theta: fases() } }), W);
bloco('ciclo_grupo_fases_crescentes_com_o_indice (1 mundo)', () => ({ gCycle: { amp: 0.6, period: 6, theta: ordenadas } }), 1);
bloco('cc_atraso (12 mundos)', () => ({ fatores: [{ L: new Array(10).fill(1), rho: 0.8, sd: 1.0, delay: atrasos() }] }), W);
bloco('transitorio_tau6_sd1_5', () => ({ transient: { sd: 1.5, tau: 6 } }), 1);
bloco('efeito real RR3 (rampa, nucleo)', () => ({}), 1, {}, (o, r_) => simulate({ G: o.G, T: o.T, lam: 8, RR: 3, driver: 'A', sizeSd: .0867 }, r_));
bloco('efeito real em 6 pares FORA da matriz (aditivo 0,15)', () => ({ efeito: { beta: 0.15, pairs: CTRL.slice(0, 6) } }), 1, { G: 40 });
bloco('efeito real em 12 pares FORA da matriz', () => ({ efeito: { beta: 0.15, pairs: CTRL.slice(0, 12) } }), 1, { G: 40 });
bloco('efeito real em 30 pares da matriz + 6 fora', () => ({ efeito: { beta: 0.10, pairs: [...PAIR, ...CTRL.slice(0, 6)] } }), 1, { G: 40 });
