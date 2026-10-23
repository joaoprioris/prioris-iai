// Estimador pré-especificado da fase exploratória. Primário: exposição = participação de A como dívida principal (não depende do classificador de adjacência).
// Escore por grupo: soma sobre pares p e meses t de e_gtp * y_gtb * N_gt, com e e y centrados por mês entre grupos (remove tendência, sazonalidade e choque comum).
// Teste: t de Student unilateral sobre os escores por grupo (grupo é a unidade de réplica). Efeito: inclinação agrupada, IC por inversão do teste t (Fieller).
import { PAIR, NP, WIN, tcdf } from './nucleo.mjs';
const MAXLAG = 6;
const STARTS = PAIR.map(q => Math.max(1, WIN[q.cls][0]));

// D: {n:[Int16Array(T*10)], N:[Int16Array(T)]}. Retorna, por grupo, exposição por par e mês (participação de A nos meses da janela, soma das defasagens).
export function exposicaoA(D, G, T, { share = true } = {}) {
  const E = [];
  for (let g = 0; g < G; g++) {
    const e = new Float64Array(NP * T);
    for (let p = 0; p < NP; p++) {
      const a = PAIR[p].a, s = STARTS[p];
      for (let t = 0; t < T; t++) {
        let v = 0;
        for (let l = s; l <= MAXLAG && l <= t; l++) { const N = D.N[g][t - l]; v += share ? (N > 0 ? D.n[g][(t - l) * 10 + a] / N : 0) : D.n[g][(t - l) * 10 + a]; }
        e[p * T + t] = v;
      }
    }
    E.push(e);
  }
  return E;
}
// Exposição direcional: dir=-1 usa meses anteriores (defasagens s..6), dir=+1 usa meses posteriores (placebo de direção). Média da participação de A nos meses disponíveis da janela.
export function exposicaoDir(D, G, T, dir, media = true, pairs = PAIR) {
  const E = [], NPp = pairs.length, STp = pairs.map(q => Math.max(1, WIN[q.cls][0]));
  for (let g = 0; g < G; g++) {
    const e = new Float64Array(NPp * T);
    for (let p = 0; p < NPp; p++) {
      const a = pairs[p].a, s = STp[p];
      for (let t = 0; t < T; t++) {
        let v = 0, c = 0;
        for (let l = s; l <= MAXLAG; l++) { const u = t + dir * l; if (u < 0 || u >= T) continue; const N = D.N[g][u]; v += N > 0 ? D.n[g][u * 10 + a] / N : 0; c++; }
        e[p * T + t] = c ? (media ? v / c : v) : 0;
      }
    }
    E.push(e);
  }
  return E;
}
// Estimador direcional: escore (defasagem) menos escore (avanço). Sob persistência comum os dois têm o mesmo viés e a diferença fica centrada em zero.
export function direcional(D, G, T, media = true, pairs = PAIR) {
  const L = componentes(D, G, T, { E: exposicaoDir(D, G, T, -1, media, pairs), pairs }), F = componentes(D, G, T, { E: exposicaoDir(D, G, T, +1, media, pairs), pairs });
  const S = L.S.map((v, i) => v - F.S[i]);
  return { S, Q: L.Q, Sc: L.Sc.map((a, c) => a.map((v, i) => v - F.Sc[c][i])), lag: L, lead: F };
}
// Componentes por grupo: S_g (numerador), Q_g (denominador, soma e^2 N) e, por classe de prazo, os mesmos.
export function componentes(D, G, T, opts = {}) {
  const pairs = opts.pairs || PAIR, NPp = pairs.length, E = opts.E || exposicaoA(D, G, T, opts);
  const pool = [];
  for (let t = 0; t < T; t++) { const n = new Array(10).fill(0); let N = 0; for (let g = 0; g < G; g++) { N += D.N[g][t]; for (let d = 0; d < 10; d++) n[d] += D.n[g][t * 10 + d]; } pool.push(n.map(v => N > 0 ? v / N : 0)); }
  const em = new Float64Array(NPp * T);
  for (let p = 0; p < NPp; p++) for (let t = 0; t < T; t++) { let s = 0; for (let g = 0; g < G; g++) s += E[g][p * T + t]; em[p * T + t] = s / G; }
  const S = [], Q = [], Sc = [[], [], []];
  for (let g = 0; g < G; g++) {
    let s = 0, q = 0; const sc = [0, 0, 0];
    for (let t = 0; t < T; t++) {
      const N = D.N[g][t]; if (N === 0) continue;
      for (let p = 0; p < NPp; p++) {
        const b = pairs[p].b, e = E[g][p * T + t] - em[p * T + t], y = D.n[g][t * 10 + b] / N - pool[t][b];
        s += e * y * N; q += e * e * N; sc[pairs[p].cls] += e * y * N;
      }
    }
    S.push(s); Q.push(q); for (let c = 0; c < 3; c++) Sc[c].push(sc[c]);
  }
  return { S, Q, Sc };
}
const critCache = new Map();
export function tCrit(df, alpha = 0.05) { // quantil superior de t por bisseção (cache)
  const k = df + ':' + alpha; if (critCache.has(k)) return critCache.get(k);
  let lo = 0, hi = 20; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (1 - tcdf(m, df) > alpha) lo = m; else hi = m; }
  critCache.set(k, hi); return hi;
}
export function tStat(sc) {
  const G = sc.length, m = sc.reduce((a, b) => a + b, 0) / G, v = sc.reduce((a, b) => a + (b - m) * (b - m), 0) / (G - 1);
  return v > 0 ? m / Math.sqrt(v / G) : 0;
}
export const rejeita = (sc, alpha = 0.05) => tStat(sc) > tCrit(sc.length - 1, alpha);
// Efeito: beta = soma S / soma Q (variação da participação de B por unidade de exposição).
// IC95 por inversão do teste t sobre os escores por grupo U_g(b0) = S_g - b0 Q_g (Fieller): conjunto dos b0 que o teste bilateral não rejeita. Usa a mesma estrutura do teste primário.
export function efeito(S, Q) {
  const G = S.length, sS = S.reduce((a, b) => a + b, 0), sQ = Q.reduce((a, b) => a + b, 0);
  if (!(sQ > 0)) return { beta: 0, lo: -Infinity, hi: Infinity };
  const beta = sS / sQ, c = tCrit(G - 1, 0.025);
  // t^2(b0) <= c^2  <=>  (sum U)^2 <= c^2 * G/(G-1)... em termos de quadrática em b0: aqui resolvemos por busca nos dois lados de beta
  const t = (b0) => { const U = S.map((s, i) => s - b0 * Q[i]); const m = U.reduce((a, b) => a + b, 0) / G, v = U.reduce((a, b) => a + (b - m) * (b - m), 0) / (G - 1); return v > 0 ? Math.abs(m / Math.sqrt(v / G)) : 0; };
  const escala = Math.max(Math.abs(beta), sS / sQ === 0 ? 1e-6 : 0, 1e-6) * 50 + 1e-3;
  const lado = (dir) => { let a = beta, b = beta + dir * escala; for (let i = 0; i < 60 && t(b) < c; i++) { b = beta + dir * (b - beta) * 2; } if (t(b) < c) return dir * Infinity; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (t(m) < c) a = m; else b = m; } return (a + b) / 2; };
  return { beta, lo: lado(-1), hi: lado(1) };
}
// Supressão pessimista por célula (grupo, mês, dívida) com menos de k participantes distintos, supondo um participante por SED (melhor caso para o piloto).
export function suprimirCelulas(D, G, T, k = 3) {
  const n = [], N = [];
  for (let g = 0; g < G; g++) {
    const ng = new Int16Array(T * 10), Ng = new Int16Array(T);
    for (let t = 0; t < T; t++) for (let d = 0; d < 10; d++) { const v = D.n[g][t * 10 + d]; if (v >= k) { ng[t * 10 + d] = v; Ng[t] += v; } }
    n.push(ng); N.push(Ng);
  }
  return { n, N, x: D.x };
}
// Liberação agregada por grupo e mês: tudo é liberado se o grupo-mês tiver pelo menos k participantes distintos (um por SED no melhor caso).
export function liberarGrupoMes(D, G, T, k = 3) {
  const n = [], N = [];
  for (let g = 0; g < G; g++) {
    const ng = new Int16Array(T * 10), Ng = new Int16Array(T);
    for (let t = 0; t < T; t++) if (D.N[g][t] >= k) { Ng[t] = D.N[g][t]; for (let d = 0; d < 10; d++) ng[t * 10 + d] = D.n[g][t * 10 + d]; }
    n.push(ng); N.push(Ng);
  }
  return { n, N, x: D.x };
}

// Pares de controle negativo: as 60 combinações (A, B) com A diferente de B que NÃO estão na matriz. Classe de prazo atribuída por rodízio pré-especificado (0, 1, 2), para usar as mesmas janelas.
export const PARES_CONTROLE = (() => {
  const out = []; let k = 0;
  for (let a = 0; a < 10; a++) { const dentro = new Set(PAIR.filter(q => q.a === a).map(q => q.b)); for (let b = 0; b < 10; b++) if (b !== a && !dentro.has(b)) out.push({ a, b, cls: (k++) % 3 }); }
  return out;
})();
