---
name: Recuperação de envios fictícios
description: Limites de continuidade e interpretação de falhas no piloto.
---

Uma desconexão do navegador não comprova término da requisição no servidor.
Um reinício sem resultado persistido não comprova sucesso ou ausência de uso
remoto. Recuperar estado não autoriza repetir automaticamente a chamada.

**Why:** o proprietário pediu confiabilidade sem mensagens, respostas ou cobranças
duplicadas; os registros históricos de indisponibilidade não identificavam sua
causa externa, e a interface incentivava repetição após apagar o envio.

**How to apply:** preservar envio, resultado confirmado e incerteza separadamente;
manter reservas e autorização original. Não atribuir ao fornecedor uma falha
de validação ou gravação e não renovar acesso para completar uma verificação.
