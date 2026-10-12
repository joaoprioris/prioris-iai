import React from "react";
import {createRoot} from "react-dom/client";
import Login from "./pages/Login";
import {useAuth} from "./hooks/useAuth";
function TestAccess(){const auth=useAuth();return <main><aside>TESTE ISOLADO — empresa fictícia. A versão pública não foi alterada.</aside>{auth.token?<section><h1>Entrada confirmada</h1><p>Sessão de teste ativa.</p><button onClick={()=>auth.logout()}>Sair da conta de teste</button></section>:<Login onLogin={auth.login}/>}</main>}
createRoot(document.getElementById("root")!).render(<TestAccess/>);
