// C: recalcula células da tabela de poder (gerador e DGP do documento, MEU estimador) e testa se o DGP favorece o estimador.
// Uso: node r2_poder.mjs tabela|favorece <sims>
import { simulate } from './nucleo.mjs';
import { escores, rej, rng, ci, gen, PAIR } from './r2_lib.mjs';
const modo = process.argv[2] || 'tabela', sims = +process.argv[3] || 500;
const lib = (D, G, T, k = 3) => { const n = [], N = []; for (let g = 0; g < G; g++) { const ng = new Int16Array(T * 10), Ng = new Int16Array(T); for (let t = 0; t < T; t++) if (D.N[g][t] >= k) { Ng[t] = D.N[g][t]; for (let d = 0; d < 10; d++) ng[t * 10 + d] = D.n[g][t * 10 + d]; } n.push(ng); N.push(Ng); } return { n, N }; };
function cel(G, T, lam, RR, extra = {}) { const r = rng(4000 + G * 3 + T * 5 + lam * 7 + Math.round(RR * 100)); let k = 0; for (let s = 0; s < sims; s++) { const D = lib(simulate({ G, T, lam, RR, driver: 'A', sizeSd: .0867, ...extra }, r), G, T); if (rej(escores(D, G, T).S)) k++; } return k; }
if (modo === 'tabela') {
  const doc = { '20,12,8': [18, 37, 69], '40,12,8': [33, 58, 91], '60,12,8': [36, 77, 99], '100,12,8': [50, 90, 100], '20,18,8': [29, 53, 87], '40,18,8': [50, 82, 100], '60,18,8': [55, 92, 100], '40,24,8': [55, 91, 100], '40,12,16': [37, 70, 97], '40,18,16': [46, 82, 99], '20,12,4': [10, 16, 33], '100,12,4': [25, 49, 85] };
  console.log('G,T,lam | RR1.5 doc / meu | RR2 doc / meu | RR3 doc / meu  (sims=' + sims + ')');
  for (const [key, v] of Object.entries(doc)) { const [G, T, lam] = key.split(',').map(Number); console.log(key, [1.5, 2, 3].map((RR, i) => `${v[i]} / ${ci(cel(G, T, lam, RR), sims)}`).join(' | ')); }
} else {
  // O DGP favorece o estimador? (a) A persistente; (b) efeito em degrau; (c) efeito aditivo com janelas de atraso diferentes da janela do estimador; (d) com e sem persistência em A no DGP aditivo.
  console.log('G=40, T=18, lam=8; poder (%) do direcional, sims=' + sims);
  const lin = (nome, f) => { const r = rng(777 + nome.length); let k = 0; for (let s = 0; s < sims; s++) if (rej(escores(lib(f(r), 40, 18), 40, 18).S)) k++; console.log(nome.padEnd(58), ci(k, sims)); };
  for (const RR of [2, 3]) {
    lin(`doc: rampa, A iid, RR pico ${RR}`, r => simulate({ G: 40, T: 18, lam: 8, RR, driver: 'A', sizeSd: .0867 }, r));
    lin(`doc: rampa, A persistente (AR 0,8, dp 0,6), RR ${RR}`, r => simulate({ G: 40, T: 18, lam: 8, RR, driver: 'A', sizeSd: .0867, arRho: .8, arSd: .6 }, r));
    lin(`doc: degrau, A iid, RR ${RR}`, r => simulate({ G: 40, T: 18, lam: 8, RR, driver: 'A', mode: 'step', sizeSd: .0867 }, r));
    lin(`doc: degrau, A persistente, RR ${RR}`, r => simulate({ G: 40, T: 18, lam: 8, RR, driver: 'A', mode: 'step', arRho: .8, arSd: .6, sizeSd: .0867 }, r));
  }
  // efeito aditivo conhecido: beta de 0,10 (participação de B sobe 0,10 por unidade de participação média de A na janela do efeito). Tabela de variantes de janela.
  const todos = PAIR;
  for (const [nm, lags] of [['janela do estimador (prazo..6)', null], ['só atrasos 1 a 2', [1, 2]], ['só atrasos 4 a 6', [4, 6]], ['só atraso 1', [1, 1]]]) for (const ar of [null, { rho: .8, sd: .6 }]) {
    lin(`aditivo beta 0,15, janela ${nm}, A ${ar ? 'persistente' : 'iid'}`.slice(0, 58), r => gen({ G: 40, T: 18, lam: 8, ar, efeito: { beta: 0.15, pairs: todos, lags } }, r));
  }
}
