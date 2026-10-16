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

Persistência por arquivo é suportada somente em um host Linux com armazenamento
local durável compartilhado pelos processos. Instâncias com discos independentes
não podem executar a mesma campanha simultaneamente.

**Why:** o proprietário exige continuidade de conversa e orçamento após interrupção;
locks locais não coordenam servidores independentes nem recuperam resultado remoto
nunca persistido.

**How to apply:** manter incerteza e reservas ao recuperar um processo; recuperar
lock apenas com término verificável do proprietário, nunca por idade. Não prometer
garantias entre hosts ou converter testes de SIGKILL em prova de falha elétrica real.

Perder o contexto do navegador automatizado não comprova defeito de login:
a sessão proprietária ainda válida pode corretamente recusar outro contexto.

**Why:** um lote longo de navegador perdeu seu contexto e a retomada recebeu 409;
isso impediu concluir o teste, sem demonstrar falha do produto.

**How to apply:** registrar contadores e evidências em passos curtos e persistidos;
não contornar autenticação nem aprovar interrupção em andamento quando a recarga
só ocorreu depois de a resposta terminar.

Reprovar uma resposta não invalida a informação nem a correção enviada pelo líder.
Ela deve orientar a tentativa seguinte, sem transformar candidato recusado em
fala exibida ou tentativa falha em troca concluída.

**Why:** o proprietário exige continuidade após erros; perder a correção preservava
uma leitura anterior inadequada e obrigava o líder a repetir sua explicação.

**How to apply:** separar retenção do envio, aceitação da resposta e conclusão da
troca; conservar idempotência, consentimento, isolamento e incerteza financeira.

Retenção de envios falhos precisa de capacidade finita, sem descartar fatos para
abrir espaço. Ao atingir o limite, recusar antes de nova chamada e manter a
correção do líder. Apagamento invalida resultados atrasados, mesmo se houver
novo consentimento depois; não restaurar contexto por conclusão tardia.

**Why:** o proprietário exige que falhas repetidas não ampliem indefinidamente
armazenamento, contexto ou custo e que dados apagados não reapareçam.

**How to apply:** contar falhas junto com admissões, preservar idempotência e
reservas, verificar invalidação entre chamadas e separar arquivo de auditoria
fictícia de contexto operacional que pode voltar ao modelo.
