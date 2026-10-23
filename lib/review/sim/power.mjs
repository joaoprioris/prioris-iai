// Simulação de poder e de falso positivo para o teste de conversão entre dívidas (adjacência).
// Premissas de volume são HIPÓTESES de simulação, não dados da empresa.
const ADJ = [[1,2,8],[3,4,5],[4,5,6],[1,4,5],[3,5,6],[6,7,8],[5,7,8],[5,6,8],[0,1,9],[0,3,8]]; // índices 0..9 (D1..D10)
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function pois(r,l){if(l>30){const u=(Math.sqrt(-2*Math.log(r()||1e-12))*Math.cos(2*Math.PI*r()));return Math.max(0,Math.round(l+Math.sqrt(l)*u))}let L=Math.exp(-l),k=0,p=1;do{k++;p*=r()}while(p>L);return k-1}
function simulate({G,T,lambda,RR,target,seed,pAdj=0.7,lag=1}){
  const r=rng(seed);
  const n=[],x=[]; // n[g][t][d] principais; x[g][t][a][j] pares (a -> j-ésimo adjacente)
  for(let g=0;g<G;g++){
    const gl=lambda*Math.exp(0.3*(r()-0.5)); // heterogeneidade do grupo
    const ng=[],xg=[];
    for(let t=0;t<T;t++){
      const w=new Array(10).fill(1);
      if(RR>1&&t>=lag){const pairs=xg[t-lag][target.a][target.j]; w[ADJ[target.a][target.j]]*=Math.pow(RR,Math.min(pairs,3)/3)}
      const sw=w.reduce((s,v)=>s+v,0);
      const nt=new Array(10).fill(0),xt=Array.from({length:10},()=>[0,0,0]);
      const N=pois(r,gl);
      for(let i=0;i<N;i++){
        let u=r()*sw,d=0;while(u>w[d]){u-=w[d];d++}
        nt[d]++;
        if(r()<pAdj){xt[d][Math.floor(r()*3)]++}
      }
      ng.push(nt);xg.push(xt);
    }
    n.push(ng);x.push(xg);
  }
  return {n,x};
}
function zStat({n,x},G,T,a,j,L){
  const b=ADJ[a][j];let S=0,V=0;
  for(let g=0;g<G;g++){
    let m=0,c=0;for(let t=L;t<T;t++){m+=n[g][t][b];c++}
    m/=c;
    for(let t=L;t<T;t++){const xv=x[g][t-L][a][j];S+=xv*(n[g][t][b]-m);V+=xv*xv*Math.max(m,0.05)}
  }
  return V>0?S/Math.sqrt(V):0;
}
const zcrit={0.05:1.6449};
function qnorm(p){ // aproximação de Acklam para quantil normal
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00],b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01],c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00],d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  const pl=0.02425;let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
}
const ALPHA=0.05, TESTS=30*2; // 30 pares x 2 defasagens (1 e 2)
const zc=-qnorm(ALPHA/TESTS);
function run({G,T,lambda,RR,sims}){
  let rejTarget=0,anyFalse=0;const target={a:0,j:1}; // D1 -> D2 (curto)
  for(let s=0;s<sims;s++){
    const data=simulate({G,T,lambda,RR,target,seed:1000+s*7919+G*31+T});
    let anyRej=false,tgt=false;
    for(let a=0;a<10;a++)for(let j=0;j<3;j++){
      const z=Math.max(zStat(data,G,T,a,j,1),zStat(data,G,T,a,j,2));
      if(z>zc){ if(RR>1&&a===target.a&&j===target.j)tgt=true; else anyRej=true }
    }
    if(tgt)rejTarget++; if(anyRej)anyFalse++;
  }
  return {power:rejTarget/sims,fwer:anyFalse/sims};
}
const sims=Number(process.argv[2]||400);
console.log('alpha familia=',ALPHA,'testes=',TESTS,'zcrit=',zc.toFixed(3),'sims=',sims);
console.log('G=grupos T=meses lambda=eventos por grupo e mes RR=aumento de B apos o par');
console.log('G\tT\tlambda\tFWER(RR=1)\tpoder RR=1.5\tpoder RR=2.0');
for(const lambda of [4,8,16])for(const G of [5,10,20,40,80])for(const T of [6,9,12]){
  const n0=run({G,T,lambda,RR:1,sims}), n1=run({G,T,lambda,RR:1.5,sims}), n2=run({G,T,lambda,RR:2,sims});
  console.log([G,T,lambda,n0.fwer.toFixed(3),n1.power.toFixed(2),n2.power.toFixed(2)].join('\t'));
}
