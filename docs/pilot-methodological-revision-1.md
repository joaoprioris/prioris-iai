# IAí — revisão metodológica 1 sobre fluxo 0.3.4

## Escopo e fundamento

Correção delimitada das rodadas 17/18, conforme orientação explícita do proprietário:
clareza e elaboração, sem fórmula como próximo movimento padrão. Fontes locais:
contrato de agentes preservado, documentação de condução 0.3.0 e de autoria 0.3.3.
Os blocos canônicos referidos pelo proprietário fundamentam essa orientação;
nesta intervenção não foi feita uma nova conferência dos originais externos.
Não foram redefinidas funções, rotas, critérios ou lentes.

## Evidência e mudanças

- 17/T2: fala pronta antes da abordagem do líder. Autoria e referência à elaboração
  agora também são exigidas no 1:1; microdirecionamento pode apoiar raciocínio
  concreto sem redigir pelo líder. Exemplo revisa abordagem existente, opcional.
- 17/T3: contingência perguntava novamente qual era o contexto ao vivo.
  A contingência do 1:1 agora conserva trecho do relato atual e identifica sua
  própria limitação, sem nova triagem do contexto nem fingir sucesso de geração.
- 17/T5: “pode ser processamento, não evasão” excluía uma alternativa sem base.
  Hipótese aberta é permitida; exclusão não comprovada é recusada.
- 18/T1–T3: proteger o momento, preservar acordo e incapacidade de cumprir foram
  afirmados sem fonte pertinente. Controles de saída focados exigem fonte
  afirmativa pertinente; intenção, hipótese, condição ou fonte do assistente
  não comprovam resultado. Hipóteses identificadas continuam possíveis.
- Cada replay usa apenas mensagens anteriores àquela resposta. Uma elaboração
  posterior não justifica retroativamente exemplo ou efeito anterior.
- Aplicação verificada nas funções pertinentes, sem usar arquivo/caso como rota.
  Perigo físico relatado conserva o caminho protetivo existente.

## Verificações executadas

13 testes em `scripts/methodological-revision-1.test.cjs`, aprovados.
Incluem candidatos arquivados, controles positivos e negativos, provedor simulado
de classificação/geração, reparo, contingência e continuidade OTO→FBK→CRS.
Na primeira execução, a fixture de risco usava um enum inexistente; a fixture foi
corrigida para o contrato existente, sem relaxar o controle do produto.

11 testes da revisão operacional 1 e 6 regressões focadas de abandono, avanço e
reserva conservadora aprovados. Total: 30 testes. API/frontend passaram TypeScript.
Zero chamadas reais de IA, aquecimento ou geração de conversa do piloto.
Não são contagem de palavras nos prompts nem aprovação de qualidade semântica.

## Estado preservado e acesso

Rodada 19 permanece a mesma: duas respostas, tentativa falha e situação ativa.
Desistência relatada não foi reenviada, gravada ou artificialmente confirmada.
US$4,253750 e 168 chamadas observadas, teto US$5, margens e reservas preservadas.
Somente expiresAt foi renovado por duas horas mediante autorização explícita.
A hora exata, hashes e verificação da prévia constam em
`generated-artifacts/pilot-methodology-revision-1/result.json`.
Prévia: `/pilot-0.3.0`; autenticação normal com a conta Replit do proprietário.
O recarregamento da API pode exigir novo login. Confirmar desistência na própria
tela e abrir próxima conversa continuam ações explícitas do proprietário.

Cópias anteriores desta intervenção em
`generated-artifacts/pilot-methodology-revision-1/`; revisão operacional 1 e sua
cópia recuperável permanecem intactas.

## Limitações

Controles determinísticos de superfície/proveniência não compreendem todas as
paráfrases nem certificam que uma abordagem foi interpretada corretamente.
A contingência explicita a limitação em vez de substituir o raciocínio por receita.
O teste real posterior é necessário para avaliar utilidade e interpretação.
Não houve alteração de produção, publicação, histórico pessoal, camada
organizacional, SED ou habilitação global.
