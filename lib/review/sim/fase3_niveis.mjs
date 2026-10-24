// Probabilidade de promoção por nível, com as regras da versão 3: descarte de 3 meses, peso igual por cliente, sinal positivo em todos os clientes,
// robustez à retirada de cada cliente, controle negativo agrupado unilateral superior a 1%. Uso: node fase3_niveis.mjs <sims>
import { simulate } from './nucleo.mjs';
import { rng, ci } from './gerador2.mjs';
import { escoresV3, tstat, pvalor, CTRL } from './estimador2.mjs';
const sims = +process.argv[2] || 300, b = 3, lam = 8;
const ncdf = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const qn = (p) => { let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
const zp = (x) => qn(1 - Math.min(Math.max(pvalor(x), 1e-12), 1 - 1e-12)); // z unilateral do teste t dos escores do cliente
const eff = { nenhum: { RR: 1 }, rampa_RR2: { RR: 2 }, rampa_RR3: { RR: 3 }, degrau_RR2: { RR: 2, mode: 'step' }, efeito_em_2_de_3_RR3: { RRc: [3, 3, 1] } };
const des = [['40 grupos x 18 meses, 14/13/13', 18, [14, 13, 13]], ['60 grupos x 12 meses, 20/20/20', 12, [20, 20, 20]], ['60 grupos x 12 meses, 36/14/10', 12, [36, 14, 10]]];
console.log('probabilidades (%), IC95 Wilson; N3_sem_retirada = Stouffer peso igual p<5% + z>0 nos 3 clientes + controle limpo (unilateral 1%); N3_com_retirada acrescenta: retirar qualquer cliente mantém p<10%');
for (const [nm, T, split] of des) for (const [en, ex] of Object.entries(eff)) {
  const r = rng(1234 + T + split[0] + en.length); let n1 = 0, n1any = 0, n3 = 0, n3A = 0, st = 0, pos = 0, loo = 0, ctrl = 0;
  for (let s = 0; s < sims; s++) {
    const cl = split.map((Gc, i) => { const D = simulate({ G: Gc, T: T + b, lam, driver: 'A', sizeSd: .0867, ...ex, RR: ex.RRc ? ex.RRc[i] : ex.RR }, r); const o = { burn: b }; return { z: zp(escoresV3(D, Gc, T + b, o).S), zc: (() => { const x = escoresV3(D, Gc, T + b, { ...o, pairs: CTRL }).S; return tstat(x) * 0 + qn(1 - Math.min(Math.max(pvalor(x), 1e-12), 1 - 1e-12)); })() }; });
    const Z = (a) => a.reduce((s2, v) => s2 + v, 0) / Math.sqrt(a.length), zs = cl.map(c => c.z);
    const cOK = Z(cl.map(c => c.zc)) < 2.326; // unilateral superior a 1%: só um controle POSITIVO indica precedência espúria; efeito real empurra o controle para baixo
    const c1 = zs[0] > 1.645; if (c1 && cOK) n1++; if (zs.some(z => z > 1.645) && cOK) n1any++;
    const a = Z(zs) > 1.645, p = zs.every(z => z > 0), l = zs.every((_, i) => Z(zs.filter((__, j) => j !== i)) > 1.282);
    if (a) st++; if (p) pos++; if (l) loo++; if (cOK) ctrl++; if (a && p && l && cOK) n3++; if (a && p && cOK) n3A++;
  }
  console.log(JSON.stringify({ desenho: nm, efeito: en, sims, N1_cliente_pre_especificado: ci(n1, sims), N1_livre_escolha: ci(n1any, sims), Stouffer: ci(st, sims), sinal_positivo_3: ci(pos, sims), retirada_ok: ci(loo, sims), controle_limpo: ci(ctrl, sims), N3_com_retirada: ci(n3, sims), N3_sem_retirada: ci(n3A, sims) }));
}
