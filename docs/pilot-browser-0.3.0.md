# Piloto navegável fictício — desenvolvimento 0.3.0

Preparado e iniciado em 13/10/2026. Complementa o roteiro histórico de
`one-to-one-development-0.3.0.md`; não altera a evidência de que aquele primeiro
roteiro ainda não tinha piloto iniciado.

## Entrada

Abrir `/pilot-0.3.0` na prévia de desenvolvimento e selecionar
“Entrar com Replit — abrir em nova aba”. O navegador faz OIDC/PKCE com estado e
nonce; a assinatura e as condições do ID token são verificadas por openid-client.
Somente `sub` igual ao identificador do proprietário fornecido pelo ambiente é
aceito. Nenhuma conta/e-mail é gravada no banco normal; a autorização associa um
cookie HttpOnly/Secure à identidade fictícia do piloto. Não copiar credenciais.

Uma sessão autenticada do proprietário por vez, uma conversa fictícia na rodada.
Sair invalida esse cookie; entrar novamente não cria outra conversa nem reinicia
contagem ou orçamento. A rodada expira duas horas após a inicialização original,
não após cada reinício. Reiniciar o processo exige autenticar novamente.

A conversa e as chamadas são privadas pela autorização do aplicativo. O ajuste
“Private development URL” da plataforma não foi consultado/alterado nem comprovado
nesta rodada. Para restringir também a página de entrada na plataforma: Developer
tools → Networking → Private development URL. Sem depender desse ajuste, visitantes
sem autenticação válida não podem criar conversa ou chamar IA.

## Isolamento

Repositório exclusivo com identificadores fictícios fixos, sem consultas ou
escritas no banco do produto. Contexto operacional e ledger em
`generated-artifacts/pilot-0.3.0-round/state.json`, com permissão restrita e fora
de Git/publicação. Vite nega servir esse diretório por sua API de arquivos.
Nenhuma identidade real é persistida ali. Conversa ativa mantém contexto
operacional fictício; no fechamento seu texto é removido, conforme o serviço
existente com histórico pessoal desligado. Não há reutilização de histórico
pessoal nem camada organizacional.

Rotas ausentes quando NODE_ENV é produção. Router opt-in habilitado somente
nessa instância. App normal, suas imagens e sua autenticação permanecem intactos.

## IA e orçamento

Provedor observado na instância: Replit AI Integrations/Anthropic existente.
Modelos mantidos: `claude-haiku-4-5` (classificação, máximo 600 tokens de saída) e
`claude-sonnet-4-5` (resposta, máximo 2200 por chamada, inclusive recuperação).
Inicialização, status, login e abertura de sessão não chamam IA.
Somente mensagens enviadas pelo proprietário autenticado acionam o fluxo real.
Nenhum caso prévio foi enviado ao produto.

Tarifas públicas consultadas em 13/10/2026, USD por milhão de tokens:

| Modelo | Entrada | Saída |
| --- | ---: | ---: |
| Haiku 4.5 | 1 | 5 |
| Sonnet 4.5 | 3 | 15 |

Fontes: https://platform.claude.com/docs/en/about-claude/pricing e
https://docs.replit.com/features/integrations/replit-ai-integrations .
A segunda documenta cobrança pela Replit ao preço público, descontada dos
créditos. Não consultamos saldo nem validamos credenciais por chamada real.

Teto fixo de US$1 de **consumo estimado desta rodada**, persistido entre
reinícios. Antes de cada chamada: reservar o payload completo serializado
(sistema, mensagens, esquemas, instrução de recuperação), com estimativa
conservadora de duas vezes os bytes UTF-8 mais 8192 tokens de margem; reservar
até duas vezes o preço de entrada e toda a saída configurada. Contexto estimado
acima de 180 mil tokens é negado, evitando preços de contexto longo.

Cada classificação e cada tentativa de geração/recuperação têm sua própria
reserva anterior ao envio; não se usa a reserva antiga de 1600 para uma saída
de 2200. Não há retries automáticos do SDK. Uma classificação pode ser
contabilizada e uma geração posterior ser bloqueada se não couber no restante;
nesse caso não se apresenta resposta de sucesso. Dez trocas é um máximo,
não garantia de dez respostas dentro do orçamento.

Sucesso com usage válido permite ajustar para estimativa baseada nesse usage.
Falha de rede/serviço conserva toda a reserva como consumo incerto; usage ausente
ou acima da margem bloqueia novas chamadas. Reservas síncronas e gravação antes
do envio evitam concorrência excedendo o teto. Se persistência falhar, não se envia.
Não é teto da conta inteira, garantia de fatura exata, informação de saldo ou
limitação dos créditos usados pelo próprio Agent. Tarifas, tokenização e
faturamento externo continuam dependências externas.

## Evidências executadas e limites

- Sete testes locais focados do piloto aprovados: orçamento, recuperação,
  falha/incerteza, modelo/entrada/saída, concorrência, sessão/escopo, dez trocas,
  duplicidade, origem, proprietário inválido/válido, cookies, saída e produção.
- Seis regressões do adaptador 0.3.0 aprovadas, sem IA.
- O teste da rota com OIDC/SDK fictícios confirmou classificação + duas gerações
  contabilizadas individualmente em 600/2200/2200; a falha anterior permaneceu
  reservada. Fixtures e escrita dos testes apenas em /tmp.
- TypeScript do servidor e frontend aprovados; serviço de desenvolvimento iniciou.
- Página e status observados HTTP 200; criação anônima de sessão respondeu 401.
- Tentativa de servir o arquivo isolado pela API de arquivos do Vite respondeu
  403; a mudança de configuração reiniciou automaticamente o frontend.
- Captura da página de entrada sem autenticação disponível nos relatórios.
- Antes da entrega: nenhuma conversa criada e zero chamadas de IA no ledger real.

Relatórios em `generated-artifacts/pilot-0.3.0-verification/`; evidências
anteriores preservadas. O relatório inicial registra uma falha no extrator de
cookies do próprio teste (selecionava o cookie de fluxo removido, não o de
sessão); o teste corrigido passou.

Login real do proprietário e resposta real do modelo **não executados**.
Exigem sua interação. Testes não demonstram interpretação semântica nem
aprovação metodológica. Se Replit rejeitar a autorização, o piloto continua
negando acesso e não chama IA.
