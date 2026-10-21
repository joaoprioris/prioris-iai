# Retomada e reconstrução do IAí / PRIORIS

Data de corte: **18/10/2026**. Este guia registra requisitos e evidências; não aprova o código existente nem substitui a metodologia. Atualização documental, sem merge de código, deploy ou chamada a modelo.

Para entender a empresa, o app, os agentes, o SED e a metodologia em um só arquivo, comece pelo [documento mestre](MESTRE.md).

## 1. Objetivo e experiência esperada

O IAí apoia líderes em dilemas reais de gestão de pessoas. Deve ajudar a estruturar pensamento, ampliar leitura e qualificar decisões sob pressão, em linguagem humana e direta, preservando a decisão e a autoria do líder. A interface apresenta uma voz única; agentes e classificação metodológica ficam invisíveis.

A conversa deve responder ao pedido, aproveitar o contexto, avançar com ajuda concreta e encerrar quando houver clareza suficiente para o próximo passo, em até **dez trocas globais**. Não precisa resolver toda a situação para encerrar. Não deve virar questionário, aula, roteiro completo ou sequência de perguntas repetidas. Exemplos curtos, opcionais e adaptáveis são permitidos; não substituem a elaboração do líder.

Caso de referência trazido pelo proprietário: “estou com problema no meu time, uma funcionária nao gosta de mim e não sei mais como cobra-la”. É necessário acolher a dificuldade, distinguir impressão de fato, entender o que precisa ser cobrado e ajudar a preparar uma abordagem utilizável. Não assumir sentimentos da funcionária, causas dos atrasos, efeitos ou reações não relatados.

O produto também transforma interações em registros SED que sustentam leitura organizacional agregada. Uma boa resposta sem esse vínculo não completa o produto.

## 2. Decisões vigentes do proprietário

- Prioridade atual: reconstrução simples, **um agente de Feedback primeiro**; depois evoluir para registro confiável do SED. Não retomar complexidade de oito agentes simultaneamente como condição para resolver o básico.
- A classificação de dívida deve orientar a conversa de forma invisível; não é apenas etiqueta acrescentada depois.
- O **SED registra a dívida principal e a adjacente provável, quando houver**. A principal não deve ser substituída por um sinal genérico sem dívida identificada.
- Não empilhar regras e reparos após cada resposta ruim. Corrigir a causa e avaliar a conversa inteira.
- Não apresentar contagem de testes técnicos como satisfação do usuário. Não declarar estabilidade a partir de alguns casos favoráveis.
- Antes do convite ao proprietário para uso direto, demonstrar várias conversas úteis, completas e sem condução manual durante o diálogo, dentro do limite. Identificar explicitamente quando o usuário é simulado.
- Ser econômico com tokens do agente desenvolvedor e com chamadas à API. São consumos diferentes. Não há autorização para avaliações ilimitadas ou alteração silenciosa de limites definidos pelo proprietário.
- Código e continuidade úteis devem ficar neste GitHub privado. Não versionar chaves, cookies, sessões, dados pessoais de conversas ou cada iteração que falhou.
- **Não usar Replit.** Referências antigas ao Replit não autorizam acesso, execução ou contratação.
- Não mudar a metodologia por decisão de engenharia. Nova contradição substantiva exige decisão explícita do proprietário. D01–D03 já aprovadas não precisam ser reabertas.

## 3. Fontes para reconstruir

As fontes estão disponíveis no GitHub, sem depender dos caminhos do computador anterior:

1. [Fundamentos e book do produto](methodology/fundamentos.md): 13 documentos originais da pasta raiz, incluindo Metodologia Dívida Cultural, definição oficial, arquitetura e lógica, interação usuário × IAí, princípios, metodologia completa, dossiês e auditoria.
2. [Agentes e módulos sistêmicos](methodology/agentes.md): 19 documentos, incluindo oito definições, bibliotecas de momentos, documento canônico geral, guia de conversão, Health Monitor, Cultural Risk Engine e Modelo IEC.
3. [Inventário de fontes e hashes](methodology/source-manifest.json): caminho relativo original, SHA-256 do DOCX, quantidade de parágrafos, tabelas e elementos gráficos.
4. [DOCX originais](methodology/fontes-originais.tar.xz): 32 arquivos preservados byte a byte, incluindo imagens e diagramação, com hashes no inventário. Extraia com uma ferramenta compatível com tar.xz para uma pasta nova e confira os hashes.
5. [Corpus de agentes já presente no código](../../artifacts/api-server/src/lib/ex04-corpus.generated.json): 17 fontes identificadas como S01–S17, parágrafos rastreáveis e registro das decisões D01–D03. É uma extração anterior, não o book completo nem prova de ativação no runtime. Comparar hashes com as fontes atuais antes de regenerá-lo.

As transcrições preservam texto e células das tabelas, incluindo preenchimentos explícitos da matriz de adjacência. Não reproduzem a diagramação ou renderizam imagens, cabeçalhos e rodapés; os DOCX originais estão disponíveis no arquivo indicado acima. A transcrição facilita leitura e busca; para elementos exclusivamente gráficos e conferência de formato, consulte o DOCX correspondente.

Ordem recomendada de leitura: **Metodologia Dívida Cultural → Interação USER × IAí → Arquitetura e lógica → Princípios de atuação → Documento canônico geral → definição e momentos de Feedback → Cultural Risk Engine → Health Monitor → Modelo IEC**. As seções são localizáveis pelo nome do arquivo no índice das duas transcrições.

Precedência: decisões expressas do proprietário e princípios comuns delimitam domínio; definições específicas orientam função; exemplos e sínteses devem ser compatíveis. O título de um arquivo, sozinho, não resolve contradição. Os documentos preservam conteúdos históricos: copiar um exemplo não o torna regra nova. A revisão de 15/10/2026 no documento canônico e o registro D01–D03 precisam ser considerados.

## 4. Agentes: visão do produto completo

| ID | Função | Fronteira essencial |
|---|---|---|
| MNT | Mentor Estratégico | Estrutura escolhas, possibilidades, riscos e trade-offs |
| CTN | Contenção | Reatividade do próprio líder comprometendo pensar ou agir |
| PRF | Perfil & Padrões | Investiga padrões próprios relatados ou apoiados por histórico autorizado |
| IMP | Impacto Humano & Relações | Examina efeitos relacionais; separa intenção, efeito e hipótese |
| FBK | Feedback Estruturado | Prepara ou revisa comunicação, preservando autoria |
| OTO | 1:1 de Decisão | Apoia condução de conversa em tempo real |
| CRS | Análise de Crises | Organiza risco sob pressão; dano em curso admite contenção proporcional |
| EVL | Evolução Contínua | Consolidação longitudinal invisível, posterior a SED confiável e histórico recorrente |

Não selecionar agente apenas por palavra-chave ou pelo arquivo onde um exemplo aparece. Transições preservam contexto e contagem global. A etapa atual de um agente não altera essas definições nem entrega as oito funções.

## 5. Contrato metodológico do SED

Fluxo do produto: **IAí → SED → Health Monitor → Cultural Risk Engine → IEC → Auditoria**. O SED é unidade estruturada extraída da interação, não transcrição bruta, histórico pessoal ou simples indicador de progresso da conversa.

| Campo | Significado documentado |
|---|---|
| Dívida principal | Dívida Cultural predominante identificada, com alta confiança |
| Dívida adjacente | Próxima distorção provável se o padrão continuar, quando pertinente; hipótese baseada na matriz |
| Contexto | Situação, como Feedback, conflito, decisão ou alinhamento |
| Ator | Origem da interação, como liderado, time, par, chefe ou cliente |
| Momento | Antes, Durante ou Depois |
| Tipo de decisão | Fragmento de decisão/reflexão efetivamente trabalhado, descrito na fonte de interação |
| Intensidade proxy | Baixa, Média ou Alta; inferida, não perguntada |
| Timestamp | Momento do registro |

Principal é o que está acontecendo agora; adjacente é o que tende a acontecer depois, não uma segunda dívida observada automaticamente. As dez dívidas e os mecanismos de adjacência estão na metodologia. Não criar nova dívida por semelhança de palavras nem exigir que uma conversa prove prevalência organizacional para registrar sua principal. Confirmação de padrão organizacional é uma etapa posterior, com recorrência, persistência e agregação.

Exemplo documental: evitar um feedback difícil por receio da reação → principal **Evitação de Conflito**, adjacente **Comunicação Ambígua**, contexto Feedback, ator Liderado, momento Antes, intensidade Média. É exemplo da fonte, não fixture universal para todo feedback difícil.

A resposta trabalha o momento usando a dívida como lente invisível. Não expõe o nome da dívida ao líder. A adjacência também pode influenciar a elaboração sem virar aula de metodologia.

Não registrar candidato provisório para contornar confiança insuficiente. Confiança declarada pelo próprio modelo e uma citação não bastam para provar qualidade. A extração precisa ser avaliada semanticamente contra o relato e a metodologia, sem transformar fatos inventados pelo assistente em evidência por repetição posterior do usuário.

O registro deve alimentar base longitudinal com anonimização e isolamento adequados. Não expor conversa ou SED identificável à organização. Não usar classificação para avaliação ou punição individual. Pesquisa silenciosa complementa a base; não é sinônimo de diálogo nem de SED.

### Divergências que a engenharia não deve resolver por invenção

- A tabela legada `lib/db/src/schema/seds.ts` aceita intensidade **1–5**; a especificação do SED usa Baixa/Média/Alta. Não inventar conversão. Definir contrato compatível e migração revisada antes de persistir em produção.
- A intensidade proxy do evento não é, por si, o componente agregado I_d do IEC. Não calcular IEC diretamente com um evento ou misturar escalas.
- Um exemplo da arquitetura usa “Inconsistência de Direção” e “Erosão de Confiança”, enquanto o catálogo fundador tem dez dívidas, incluindo **Confiança Erosionada**. Não criar uma 11ª dívida ou equivalência silenciosa por esse exemplo; registrar a discrepância e obter decisão se ela afetar a implementação.
- As regras matemáticas e limiares devem vir de Modelo IEC, Risk Engine e Health Monitor. Pesos e parâmetros não confirmados continuam pendentes. Não apresentar validação empírica ou precisão estatística que não foi demonstrada.

## 6. Estado real em 18/10/2026

| Parte | Estado verificável e limite |
|---|---|
| Código principal | `main@b7212823aab06f95aa389aaee094c57feea95050` no início desta atualização documental |
| Desenvolvimento | PR2 em rascunho, branch `feat/local-runtime-feedback-flow`, head de código `3cd2c4a0a54f980e9195b9cff28b059b5e18f511`; não mesclado |
| App existente | React/Vite + API Express/TypeScript + PostgreSQL/Drizzle; há autenticação, isolamento e controles no código; isso não certifica funcionamento atual ponta a ponta |
| Conversas com API real | Foram executadas localmente, com usuários simulados. Houve diálogos úteis, inclusive encerrados em até dez trocas; estabilidade e satisfação do proprietário não demonstradas |
| Avaliação automática | Já aprovou conversas com problemas encontrados na revisão posterior. Não é critério único de aceite |
| Experimento simples | Um agente + orientação curta + histórico, separado do app; não está no branch e não virou entrega validada. Sem autenticação ou PostgreSQL do app |
| SED | Geração/persistência confiável ponta a ponta não entregue. O caminho legado de encerramento explicitamente mantém SED pendente. Existência de função/tabela não prova gravação |
| Experimento local de SED | Tentativa isolada com SQLite e revisão semântica; não validada, não integrada, não incorporada como contrato do produto |
| Health Monitor / Engine / IEC / EVL | Documentados; não considerar entregues ou ativados por existir código, tela ou relatório histórico |
| Publicação e ambiente externo | Nenhum deploy ou aceite de produção foi realizado nesta retomada. Estado do ambiente histórico não foi reverificado |

O desenvolvimento deve partir desses limites. Relatórios de “16 testes”, outros números de regressões ou rodadas antigas descrevem recortes técnicos; não significam conversas satisfatórias nem produto aprovado.

As últimas rodadas foram interrompidas também por teto **local de avaliação**. Isso não demonstra falta de saldo na conta Anthropic nem é o limite de tokens do Codex. A estimativa acumulada local registrada ao fim foi US$8,968551; não é extrato do fornecedor. Não transportar esse ledger, suas reservas ou a chave para outro ambiente.

Não foi demonstrada uma causa única para todas as respostas ruins. Houve rejeições/reparos excessivos no caminho antigo e problemas semânticos também no agente simples: garantias sobre reações, detalhes não relatados, fala pronta em excesso, perguntas sem avanço e escolha indevida pelo líder. Tratar como falhas observadas, não como prova de que os documentos do proprietário são inadequados ou de que o produto é inviável.

## 7. Mapa do código existente

Os caminhos abaixo se referem ao branch do PR2. Não presumir que o `main` tem todos os arquivos desse branch.

| Caminho | Papel |
|---|---|
| `artifacts/iai-web/` | Interface React/Vite, conversa e integrações de API |
| `artifacts/api-server/src/routes/index.ts` | Monta as rotas funcional e legada |
| `artifacts/api-server/src/routes/functional-orchestrator.ts` | Provider, classificação/geração/validação/reparo e rotas funcionais; flag opt-in |
| `artifacts/api-server/src/routes/orchestrator.ts` | Caminho legado; contém prompts/composição e função SED, mas encerramento não chama sua persistência |
| `artifacts/api-server/src/lib/` | Contratos, instruções, contexto, evidências, validadores e serviço de conversa; revisar antes de reaproveitar |
| `artifacts/api-server/src/lib/auth-mailer.ts` | Envio de magic link; depende de SMTP configurado |
| `lib/db/src/schema/` | Schemas Drizzle; inclusive sessões, organizações, usuários e SED |
| `lib/db/migrations/` | Baseline SQL e instruções para banco vazio descartável |
| `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` | Especificação e geração/consumo dos contratos da API |
| `scripts/dev-local.mjs`, `.env.local.example` | Perfil local sem Replit |
| `scripts/bootstrap-local.sql` | Identidade fictícia no banco `iai_local`, sem bypass de login |
| `scripts/evaluate-feedback-live.mjs` | Executor histórico ligado ao serviço funcional; não é o experimento simples |
| `replit.md`, `docs/pilot-*`, `.agents/memory/` | Registros históricos, com estados e recomendações de épocas diferentes |

A rota funcional é habilitada por `PRIORIS_FUNCTIONAL_ROUTING_V1=true`; o provider direto usa `PRIORIS_AI_PROVIDER=anthropic`. Não confundir código disponível, flag habilitada e revisão efetivamente servida. Identificar esse caminho antes de depurar a resposta.

## 8. Recuperação técnica de referência

Estes comandos descrevem o caminho existente, **não uma instalação limpa reexecutada e aprovada nesta atualização**. Para reconstrução, o programador pode escolher outra arquitetura sem mudar a metodologia, preservando requisitos de segurança e produto.

1. Obter acesso autorizado ao repositório privado. Clonar e selecionar explicitamente `feat/local-runtime-feedback-flow` para investigar o desenvolvimento atual. `main` conserva a base histórica e recebe estes documentos.
2. Usar Node 24, pnpm compatível com o lockfile (as notas existentes indicam pnpm 11) e PostgreSQL. Os scripts históricos de instalação incluem shell Unix; preferir ambiente Linux/WSL para reproduzi-los, ou adaptar conscientemente a instalação no Windows. Não há `packageManager` fixado no manifesto raiz.
3. Instalar com `pnpm install --frozen-lockfile`. Não relaxar controles do workspace nem recriar lockfile por conveniência. Nenhuma instalação foi executada por esta atualização.
4. Criar banco **vazio, descartável**, chamado `iai_local`. Fornecer host, porta, usuário e banco de forma explícita; nunca herdar credenciais de produção.
5. Aplicar uma vez a baseline: `psql -X -v ON_ERROR_STOP=1 -d iai_local -f lib/db/migrations/0001-baseline.sql`. O comando precisa das opções de conexão locais do ambiente. Não usar baseline ou `push-force` em banco existente.
6. Criar identidade fictícia autorizada: `psql -X -v ON_ERROR_STOP=1 -d iai_local -v local_email=alias-autorizado -f scripts/bootstrap-local.sql`. Não usar contas de terceiros.
7. Copiar `.env.local.example` para `.env.local`; preencher `DATABASE_URL`, chave própria `ANTHROPIC_API_KEY` e configuração de e-mail. Configurar `AUTH_EMAIL_ENABLED=true`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` para login pela interface. O exemplo vem com e-mail desligado; sem SMTP não existe login completo validado. Verificar também as variáveis de segurança exigidas pelo caminho de autenticação antes de executá-lo.
8. Definir `PRIORIS_FUNCTIONAL_ROUTING_V1=true`; executar `pnpm dev:local`. O launcher define provider Anthropic, API interna 8080 e interface `http://localhost:5173`, com bind local. Manter o mesmo hostname da configuração de origem/cookie.
9. Confirmar login, isolamento, envio, erros de provider, recarga e encerramento no navegador. Uma execução em memória não cobre esses comportamentos. `pnpm build` e `pnpm typecheck` são verificações técnicas, sem atestar qualidade da conversa.

Nenhuma credencial utilizável está neste guia. A chave anterior ficou em memória de um processo local, não é recuperável clonando o GitHub e tinha validade temporária. Configurar credencial própria por mecanismo seguro. Não reutilizar URLs de loopback, sessões, banco ou ledger do computador anterior.

As integrações/plugins Replit ainda aparecem no código e lockfile; o caminho local documentado não exige uso da plataforma. Não interpretar sua presença como autorização para acessá-la.

## 9. Sequência mínima para recomeçar

1. Ler as fontes e produzir uma visão curta do contrato de Feedback e SED, distinguindo fonte, decisão aprovada e pendência. Não pedir que o proprietário reconte o book.
2. Implementar uma conversa simples de Feedback: orientação curta derivada da fonte, histórico, controle de até dez trocas e tratamento de falha. Evitar reconstruir o conjunto de validadores/reparos só porque existe no legado.
3. Avaliar diálogos inteiros com situações diferentes: cobrança/receio relacional, correção de fato, negativa de fala pronta, reconhecimento e preparação para objeções. Não conduzir manualmente cada próxima fala para levar o agente ao sucesso. Avaliar tanto a utilidade para o líder simulado quanto a metodologia, com revisão do conteúdo completo.
4. Quando houver consistência, disponibilizar para teste pessoal do proprietário. Não chamar um protótipo isolado de app publicado ou integrado.
5. Evoluir para SED: referência independente para principal/adjacente e campos, extração após interação, tratamento de confiança insuficiente, persistência e leitura de volta. Comprovar registro do caso elegível e não forçar dívida onde o relato não sustenta classificação.
6. Só depois integrar o que falta do app e ampliar agentes. Health Monitor, Engine, IEC e EVL exigem suas próprias entregas e evidências; não inferir conclusão a partir de Feedback.

Essa ordem é a orientação vigente, não uma nova metodologia. Não exige refazer tudo que já for comprovadamente reutilizável; permite abandonar a arquitetura conversacional que não se sustentar.

## 10. Critério de entrega e lacunas restantes

O programador tem aqui o núcleo metodológico textual, decisões vigentes, localização do código, instruções de referência e histórico de limitações para começar uma reconstrução **sem depender deste chat**. Não tem um produto pronto, instalação limpa certificada, credenciais, banco exportado, configuração de hospedagem atual ou aceite final do proprietário.

Uma entrega precisa demonstrar conversa útil e coerente em casos variados, encerramento com clareza dentro de dez trocas, preservação de fatos/autoria e funcionamento efetivo do caminho que será usado. Na etapa SED, precisa demonstrar dívida principal, adjacente quando pertinente e demais campos realmente persistidos, sem exposição indevida e sem inventar regra numérica.

Antes de conectar produção ou gerar leitura organizacional, resolver contrato/migração SED e quaisquer divergências matemáticas relevantes, verificar ambiente e obter as autorizações correspondentes. Acesso técnico e segredos são providenciados de forma segura quando necessários; sua ausência no GitHub é intencional.

Documentos históricos permanecem preservados. Se um deles disser “validado”, “concluído” ou apresentar números de testes, interpretar no escopo e na data da emissão. O estado vigente para esta passagem é o da seção 6.
