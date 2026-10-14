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

Estados carregados em instâncias distintas não podem sobrescrever despesas,
conversas ou auditorias sem verificar a versão persistida e exclusão compartilhada.
Uma recuperação a partir de observação externa deve conservar essa origem,
sem inventar metadados de provedor ou converter margem conservadora em consumo.

**Why:** o proprietário observou retrocesso de 170 para 168 chamadas; reprodução
com instâncias independentes comprovou que o escritor atrasado apagava o novo
estado. O escritor do incidente histórico não foi identificado nos registros.

**How to apply:** conservar versões conflitantes, suspender chamadas na divergência
e reconciliar separadamente com pisos observados e incerteza explícita. Não
confundir reprodução de um defeito com identificação completa da causa histórica.
