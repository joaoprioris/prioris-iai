import {useEffect,useState} from 'react';
interface Settings {enabled:boolean;noticeVersion:string;available:boolean;}
export default function HistorySettings({busy,onErased}:{busy:boolean;onErased:()=>void}) {
 const [settings,setSettings]=useState<Settings|null>(null),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false;fetch('/api/user/history-settings',{credentials:'same-origin',cache:'no-store'}).then(async r=>r.ok?r.json():null).then(s=>{if(!cancelled&&s?.available)setSettings(s)}).catch(()=>{});return()=>{cancelled=true}},[]);
 if(!settings)return null;
 async function update(erase=false){if(!settings)return;setSaving(true);setError('');try{const r=await fetch(erase?'/api/user/history':'/api/user/history-settings',{method:erase?'DELETE':'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(erase?{confirmErase:true}:{enabled:!settings.enabled,noticeVersion:settings.noticeVersion})});const data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível atualizar o histórico.');setSettings({...settings,enabled:data.enabled});if(erase){setConfirm(false);onErased()}}catch(e){setError(e instanceof Error?e.message:'Verifique sua conexão e tente novamente.')}finally{setSaving(false)}}
 return <div style={{position:'relative',zIndex:12,color:'#F2F2F2',background:'#130D22',padding:'8px 16px',fontSize:12}}>
  <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} style={{background:'none',border:0,color:'#B8953F',cursor:'pointer',minHeight:32}}>Meu histórico: {settings.enabled?'ativado':'desativado'}</button>
  {open&&<section aria-label="Meu histórico privado" style={{padding:'8px 0'}}>
   <p>Se você ativar, suas conversas anteriores poderão ajudar o IAí a dar continuidade ao seu contexto. Elas serão usadas apenas no seu acesso, sem envio automático para relatórios da empresa.</p>
   <p>As mensagens usadas na resposta são processadas pelo serviço de IA. Desativar impede o uso e a gravação de novas conversas no histórico; para remover o que já foi salvo, escolha apagar.</p>
   <button type="button" disabled={busy||saving} onClick={()=>update()}>{settings.enabled?'Desativar histórico':'Ativar histórico e aceitar este uso'}</button>{' '}
   <button type="button" disabled={busy||saving} onClick={()=>setConfirm(true)}>Apagar meu histórico</button>
   {confirm&&<div role="alertdialog" aria-label="Confirmar exclusão do histórico"><p>Apagar seu histórico também encerra suas conversas abertas. Essa ação não pode ser desfeita. Deseja continuar?</p><button disabled={busy||saving} onClick={()=>update(true)}>Sim, apagar meu histórico</button>{' '}<button onClick={()=>setConfirm(false)}>Cancelar</button></div>}
   {error&&<p role="alert">{error}</p>}
  </section>}
 </div>;
}
