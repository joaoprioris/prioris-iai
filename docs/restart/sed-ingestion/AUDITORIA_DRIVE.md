# Auditoria adversarial dos documentos reconstruídos no Drive

Data: 23/10/2026. Objetivo: provar, e não presumir, que cada Google Doc novo contém tudo o que o original continha, e só as mudanças autorizadas.

## Método

1. **Texto integral dos Google Docs novos** via leitura estrutural (o resultado é grande e fica salvo em arquivo, o que permite processá-lo por programa em vez de ler a olho).
2. **Referência de comparação:**
   - Arquitetura, Dossiê Metodológico, Manual de Auditoria, Roteiro, Cultural Risk Engine, Health Monitor e Modelo IEC: a transcrição de 21/10 em `docs/restart/methodology/` (versão anterior às minhas correções, recuperada do git).
   - Mestre da raiz e Mestre 2.0: o próprio .docx original, baixado, descompactado e lido do XML.
   - Backlog: só verificação de estrutura (ver limites).
3. **Três testes:** diferença palavra por palavra; diferença parágrafo por parágrafo e célula por célula; forma das tabelas (quantidade de tabelas e de linhas).
4. **Varredura de resíduos:** busca, nos dez documentos, de qualquer texto que ainda contradiga D10 ou a supressão de grupos pequenos.
5. **Varredura de objetos estranhos:** busca de equações, imagens e campos que a importação possa ter criado.

## Resultado

| Documento | Palavras (orig / novo) | Diferenças reais | Observação |
|---|---|---|---|
| Arquitetura | 2.502 / 2.512 | só as correções autorizadas | tabelas iguais (8) |
| Dossiê Metodológico | 3.212 / 3.154 | correções e erros de digitação | tabelas iguais (14); a diferença de palavras vem de marcadores de formatação da transcrição |
| Manual de Auditoria | 2.974 / 2.968 | correções e erros de digitação | tabelas iguais (13) |
| Roteiro | 3.778 / 3.768 | só o slide 12 | |
| Cultural Risk Engine | 2.957 / 2.909 | correções e erros de digitação | tabelas iguais (13) |
| Health Monitor | 3.379 / 3.342 | correções e erros de digitação | tabelas iguais (15) |
| Modelo IEC | 2.967 / 2.916 | correções e erros de digitação | tabelas iguais (18) |
| Mestre da raiz | 2.879 / 3.000 | só as correções e a nota de revisão | comparado ao .docx |
| Mestre 2.0 | 5.033 / 5.079 | correções, nota de revisão, sumário sem número de página e **1 defeito** | comparado ao .docx |
| Backlog | não comparado palavra por palavra | 29 tickets e 13 épicos presentes | ver limites |

## Defeito encontrado e corrigido

No Mestre 2.0, o exemplo do DCO ("48 ocorrências anuais x 2,5 horas x 6 pessoas x R$120 por hora x 1,0 = R$86.400 por ano") perdeu o trecho do meio: a importação leu o texto entre dois sinais de dólar como equação e o descartou, deixando "R86.400". Corrigido por edição direta e verificado por nova leitura. A varredura de objetos estranhos depois disso não achou equação, imagem ou campo em nenhum dos dez documentos.

## Resíduos que contradiziam D10, ajustados

Dossiê 2.2, Arquitetura 11.7 e 17, e Health Monitor 8.1 ainda falavam do Top 3 como "regra" ou "priorização". Passaram a dizer "recorte comercial". As menções restantes a "3 dívidas" descrevem o que a Auditoria entrega e a pauta da reunião, que é o recorte comercial previsto pelo D10, e ficaram como estão.

## Limites desta auditoria

- **Backlog:** o conector entrega o texto do .docx cortado no meio do ticket 12.1 (e uma versão de março, no ticket 9.2). Foi verificada a estrutura, não o texto inteiro. O final do ticket 12.1 só se confere abrindo o original, que continua na pasta APP.
- **Aparência:** não foi auditada. Imagens, fontes e diagramação dos originais não existem nos Google Docs novos.
- **Referência indireta:** sete documentos foram comparados com a transcrição de 21/10, e não com o .docx. Se a transcrição divergir do .docx, a divergência não aparece aqui.
- **Auditor único:** quem auditou foi quem converteu. A mitigação foi automatizar a comparação, mas uma segunda pessoa ou um segundo agente, sem acesso a este relatório, daria uma checagem independente.
- **Cópias antigas:** a cópia da Arquitetura na pasta APP, a pasta TESTADO ANTERIORMENTE e o ZIP v0.2 continuam com o texto antigo.

Os scripts estão em `docs/restart/sed-ingestion/auditoria/` (dependem dos arquivos de resultado salvos pelo conector).
