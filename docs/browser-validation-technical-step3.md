# Validação técnica de navegador — execução parcial, 15/10/2026

## Escopo e conclusão

Um lote automatizado na interface real sob `/technical-sim`, exclusivamente com
dados fictícios e respostas determinísticas. Nenhuma chamada aos modelos do produto.
**Não é aprovação semântica, validação de autenticação real ou isolamento do banco.**

O lote não foi integralmente concluído. O navegador/notebook perdeu seu contexto
durante a sequência do limite global; nova autenticação foi recusada com HTTP 409
porque a sessão anterior ainda estava vinculada. Não houve contorno da proteção.
Também não se comprovou recarga durante processamento: ela ocorreu após a resposta.
Não se identificou defeito de produto que justificasse alteração metodológica ou
correção de código. Só o harness recebeu contadores locais de simulação.

## Casos e canais de evidência

| Caso | Esperado | Observado | Resultado / canal |
|---|---|---|---|
| 1. Entrar A | Autenticar e abrir sessão A | Login fictício abriu conversa limpa; ID da sessão foi capturado posteriormente. Organização confirmada no estado fictício, não no HTTP inicial. | Aprovado funcionalmente; UI + metadados persistidos. Captura HTTP inicial incompleta. |
| 2. Marcador A | Uma fala e uma resposta | Marcador exibido uma vez, resposta A única; POST 200. Gerações A 0→1, B 0→0. | Aprovado; UI + HTTP + métricas. |
| 3. Recarga | Manter conversa e contagem | Marcador/resposta preservados, nove trocas restantes. | Aprovado; UI. Números de métricas por instante não preservados. |
| 4. Consulta repetida | Não gerar nem duplicar | Três consultas, uma resposta visível e contadores reportados inalterados. | Aprovado; UI + HTTP/métricas. Valores numéricos individuais não foram salvos. |
| 5. Entrar B | Organização/sessão distintas, sem A | B abriu limpa, dez restantes, sem marcador A. IDs distintos confirmados nos arquivos fictícios. | Aprovado funcionalmente; UI + metadados. Captura HTTP inicial incompleta. |
| 6. B tenta sessão A | 403 sem execução | Controle da interface retornou 403, “Somente a conversa fictícia desta rodada é permitida”; nenhuma geração adicional reportada. | Aprovado; UI + HTTP + caminho de código. |
| 7. Marcador B / retorno A e B | Separação bilateral | B recebeu resposta própria; A não mostrou B e B não mostrou A. Após o caso: A=1, B=1 geração. | Aprovado; UI + HTTP/métricas. |
| 8. Interromper processamento | Recuperar entrega única após navegar em andamento | Segundo envio A terminou com POST 200; recarga preservou resposta única, contagem 2. A 1→2, B 1→1. Porém recarga ocorreu depois da conclusão. | **Bloqueado/incompleto** para interrupção em andamento; recuperação após conclusão aprovada. |
| 9. Desistência / recarga | Encerrar sem aprovação | Confirmação na página; encerramento persistiu com duas trocas. Arquivo confirma `kind=abandonment`, `approval=false`, autor autenticado. | Aprovado; UI + metadados persistidos. |
| 10. Encerramento automático | Fechar ao limite de dez | B chegou a seis gerações/trocas persistidas. Browser resetou antes de dez; retomada recusada com 409. | **Bloqueado**, não aprovado. |

O endereço observado `/cross-access` no caso 6 não é falha de encaminhamento:
o harness altera `req.url` internamente para `/session/message` com a sessão
da outra identidade. Não existe redirecionamento HTTP esperado. O texto 403
observado corresponde à recusa da rota real do piloto. O relatório bruto do
tester registrou essa interpretação equivocada; ele foi preservado sem alteração.

Contagem consolidada: **oito casos funcionalmente aprovados, dois incompletos**.
Isso não elimina as lacunas de captura de métricas/HTTP individuais acima.
O relatório bruto classificava quatro aprovados, cinco parciais e um bloqueado;
a consolidação acrescenta somente metadados fictícios e a revisão do caso 6.

## Contadores e limites de evidência

Final medido por HTTP `/technical-sim/metrics`:

- A: duas classificações, duas gerações iniciadas, duas concluídas.
- B: seis classificações, seis gerações iniciadas, seis concluídas.
- Total: oito classificações + oito gerações **simuladas**; chamadas externas: zero.
- Estado fictício final: A encerrada com duas trocas; B ativa com seis.
- Nenhum lock de requisição presente ao encerrar o serviço.

O JSON bruto conserva os valores antes/depois efetivamente capturados. Ausências
não foram preenchidas por inferência ou retrospectivamente apresentadas como
medições. Portanto, o requisito de contadores numéricos antes/depois de TODOS os
casos **não foi integralmente atendido**.

Desistência não equivale a conversa aprovada. O mock não simula clareza semântica
nem fechamento natural antecipado. Nem esse fechamento nem o automático em dez
foram validados nesta execução.

## Preservação e encerramento

Hash histórico antes/depois idêntico:
`1c67f23e622e277eeefd2e52bbbb00261bf978cd2e1005122cb2b67979881d29`.

Somente `artifacts/iai-web: Browser Simulation` foi parado pelo controle de
workflow. App web, API original e demais serviços não foram interrompidos.
Não se alteraram campanha histórica, orçamento, reservas, suspensão ou metodologia.

Evidências: `generated-artifacts/browser-simulation/browser-validation/`.
Incluem relatório bruto, consolidação, capturas, métricas, estados A/B estritamente
fictícios, comparação de hashes e confirmação de parada. Cookies e arquivos de
autenticação não fazem parte do pacote. `browser-validation.cjs` é apenas roteiro
de reprodução, não um runner Playwright autônomo.
