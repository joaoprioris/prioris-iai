# Piloto — revisão de consistência 2

## Evidência histórica e limite da conclusão

Em 14/10/2026, inspeção encontrou somente uma API ativa, processo iniciado às
21:00:17 UTC, e estado canônico da rodada 20 vazio, com US$4,253750/168.
Snapshots locais da 20 preservavam abertura/sessão vazia; não continham a primeira
resposta observada nem o segundo envio. Não foram encontrados logs anteriores
que identifiquem o escritor que provocou o retrocesso. Não foi presumido timeout,
falha do fornecedor, custo zero ou resultado do segundo envio.

O login anterior existia somente em memória; sua perda sob reinício é explicada
pelo código. O código também gravava a cópia integral carregada no início,
inclusive na inicialização, sem comparação de versão ou exclusão entre instâncias.

Uma reprodução executou o router anterior preservado, não uma reimplementação
dele: duas instâncias independentes compartilhando o arquivo. A primeira processou
uma mensagem com provedor simulado e mostrou 170; a segunda abriu sessão a partir
de seu estado atrasado e sobrescreveu resposta/despesas, voltando a 168. Esse
defeito é comprovado. Isso não identifica conclusivamente o escritor histórico,
nem prova que duas instâncias estavam simultaneamente ativas naquele incidente.
Uma perda/retorno do próprio filesystem não pôde ser confirmada ou descartada.

## Correção focada

- Inicialização de estado existente deixou de gravá-lo.
- Gravação compara a versão exata lida e usa exclusão no filesystem; escritor
  atrasado é recusado. Instâncias atualizam sua leitura do arquivo canônico.
- Reserva/call em execução tem exclusão durável compartilhada. Desconexão não
  encerra execução; processo ausente é distinguido de execução local ativa,
  mas lock/reserva desconhecidos não são liberados automaticamente.
- Sessão autenticada guarda somente digest e expiração em arquivo privado.
  Não amplia prazo/permissões; reinício subsequente conserva a sessão validada.
  A sessão antiga perdida não pode ser reconstruída: ainda exige login normal.
- Marcador separado e estado reconciliado suspendem chamadas reais. Consulta e
  login continuam possíveis sem classificar/gerar; testes não removem bloqueio.
- Nenhuma mudança de metodologia/prompts, publicação ou habilitação global.

## Reconciliação separada, sem reconstruir usage

A observação externa fornecida pelo proprietário foi preservada em
`generated-artifacts/pilot-consistency-preserved/external-observation.json`.
Primeira fala e resposta foram recuperadas literalmente com essa proveniência.
Não foram inventados ID original de request, estágio, classificação, tokens,
usage, modelo da chamada ou auditoria de geração. Referências locais de recuperação
são identificadas como externas, não como IDs originais.

O segundo envio foi preservado como RESULT_UNCONFIRMED, sem repetição.
Resultado remoto e gasto exato continuam desconhecidos.
Arquivos conflitantes, fontes anteriores, ledger e auditorias anteriores foram
preservados. Reconciliação foi acrescentada separadamente.

Mínimo observado US$4,289318 e 170 chamadas. A diferença para o ledger anterior
é registrada como piso observado, não como chamadas sintéticas.
Margem adicional US$0,710682 retida integralmente: total deduzido/reservado US$5,
teto US$5, disponível para novas chamadas zero. Reservas/margens antigas intactas.
Isso não afirma consumo de US$5 nem garante fatura/exposição remota exata:
faltam os registros de entrada/saída do segundo envio.
Janela não renovada; expiração mantida em 14/10/2026 22:56:17.012 UTC.

## Verificações

7 testes focados de consistência, incluindo reprodução do código anterior,
estados independentes, recuperação sem nova chamada, autenticação sob reinício,
lease sob desconexão, processo ausente e recuperação externa sem duplicação.
11 regressões operacionais e 6 regressões focadas de abandono/reservas.
Total 24 testes aprovados; API/frontend passaram TypeScript.
Tudo em fixtures temporárias e serviço simulado, sem chamadas reais pagas.
Na primeira execução, o carregador de teste precisava indicar TypeScript ao
esbuild; foi corrigido o carregador, não o produto ou suas validações.

Hash original: ba80809ea7032296b86230b64ecb5cc3b9d2b73234590c63553c1c0a0548755d.
Hashes finais e validação da prévia:
`generated-artifacts/pilot-consistency-preserved/reconciliation-result.json`.
A interface autenticada não é verificada pelo capturador sem login; recuperação
é verificada pelo arquivo reconciliado, leitor do piloto e HTTP simulado.
Não é declaração de solução definitiva entre hosts/filesystems distintos.
