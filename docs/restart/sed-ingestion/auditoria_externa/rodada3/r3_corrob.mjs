// B: a corroboração pela pesquisa silenciosa de B reduz o falso positivo conjunto quando a pesquisa oscila com o mesmo ciclo? Uso: node r3_corrob.mjs <sims por mundo> <mundos>
import { gen, esc3, rej, rng, ci, PAIR } from './r3_lib.mjs';
import { normal as nrm } from './nucleo.mjs';
const sims = +process.argv[2] || 600, W = +process.argv[3] || 12, G = 20, Tt = 18, b = 3, T = Tt + b, lam = 8, sig = 0.5;
const rw = rng(2468), r = rng(31);
const fases = () => Array.from({ length: 10 }, () => 2 * Math.PI * rw()), atrasos = () => Array.from({ length: 10 }, () => Math.floor(rw() * 4));
const survey = (D, kappa, r_) => D.P.map((Pg) => { const y = new Float64Array(T * 10); for (let t = 0; t < T; t++) for (let d = 0; d < 10; d++) y[t * 10 + d] = kappa * Math.log(10 * Pg[t * 10 + d]) + sig * nrm(r_); return y; });
const KS = [1.0, 0.5, 0.0];
function bloco(nome, mk, mundos, extra = {}) {
  const acc = {}; for (const k of KS) acc[k] = { prim: 0, sur: 0, ambos: 0 }; let nn = 0;
  for (let w = 0; w < mundos; w++) { const o = { G, T, lam, ...mk(), ...extra };
    for (let s = 0; s < sims; s++) { const D = gen(o, r); const pr = rej(esc3(D, G, T, { burnY: b }).S); nn++;
      for (const k of KS) { const sv = rej(esc3(D, G, T, { burnY: b, Y: survey(D, k, r) }).S); acc[k].prim += pr; acc[k].sur += sv; acc[k].ambos += pr && sv; } } }
  for (const k of KS) console.log(JSON.stringify({ cenario: nome, mundos, sims_total: nn, kappa_pesquisa_ao_estado_latente: k, primario_rejeita: ci(acc[k].prim, nn), pesquisa_rejeita: ci(acc[k].sur, nn), ambos_rejeitam: ci(acc[k].ambos, nn) }));
}
bloco('nula_base', () => ({}), 1, {});
bloco('ciclo_de_grupo_periodo6_12_mundos', () => ({ gCycle: { amp: 0.6, period: 6, theta: fases() } }), W);
bloco('ciclo_de_grupo_periodo4_12_mundos', () => ({ gCycle: { amp: 0.6, period: 4, theta: fases() } }), W);
bloco('cc_atraso_12_mundos', () => ({ fatores: [{ L: new Array(10).fill(1), rho: 0.8, sd: 1.0, delay: atrasos() }] }), W);
// efeito real (aditivo conhecido, janela do estimador): a pesquisa corrobora?
bloco('efeito_real_aditivo_0_10', () => ({ efeito: { beta: 0.10, pairs: PAIR } }), 1, { G: 40 });
