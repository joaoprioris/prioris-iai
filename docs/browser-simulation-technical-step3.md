# Navegador descartável — technical-step3

Entrada: `/technical-sim/pilot-0.3.0`, na prévia HTTPS de desenvolvimento.
Serviço separado: **artifacts/iai-web: Browser Simulation**.
Nenhuma mudança no login, banco ou rotas do app normal/piloto original.

## Usar

1. Na faixa amarela, escolha **Usar identidade A**.
2. Clique **Entrar com identidade fictícia — nesta aba**. O login é uma
   substituição local de teste; não utiliza Replit/OIDC real, e-mail ou credencial.
3. Envie uma fala fictícia. A resposta fixa demora seis segundos, permitindo
   recarregar durante o processamento e consultar o mesmo envio pela interface.
   O harness não envia mensagens por conta própria.
4. Use a confirmação de desistência dentro da tela para conferir encerramento.
   O limite global de dez trocas e os controles de envio são do piloto atual.
5. Escolha B, autentique B e confira a conversa separada. Volte a A para recuperá-la.
   Os cookies de A/B são distintos. Selecionar B não transfere a autenticação de A.
6. Autenticado, **Tentar acesso à outra organização** envia à rota real uma
   mensagem com o ID de sessão fictícia estrangeira; o resultado esperado é
   HTTP 403, antes de qualquer resposta simulada. A página mostra o JSON;
   volte pelo navegador. Isso não comprova todos os caminhos de autorização.

## O que é real e o que foi substituído

- Reais: fontes atuais de Pilot/Chat, router funcional, autenticação/cookies de
  sessão do piloto (com adaptadores externos), autorização por escopo,
  recibos/idempotência, persistência `technical-step3`, recuperação e encerramento.
- Simulados por injeção já existente: provedor OIDC, classificação fixa
  `compare_paths`, resposta textual fixa. Não se avalia interpretação, seleção
  semântica, prompts, qualidade das respostas ou validação de saída do provedor.
- O texto “proprietário” na interface original não representa autenticação real
  nesta cópia: qualquer pessoa com acesso à prévia pode usar as identidades
  fictícias. A faixa amarela e os rótulos identificam essa substituição.
- Custos/contadores de chamadas exibidos são do ledger fictício (zero); o modelo
  simulado não passa pelo transporte pago. Não é ensaio de faturamento.
- Não há PostgreSQL neste harness: usa o repositório isolado por arquivo do piloto.
  Portanto, não valida isolamento de tabelas reais ou autenticação do app normal.

## Isolamento e limites

`scripts/iai-browser-sim.cjs` executa um filho com ambiente permitido explícito,
sem DATABASE_URL, SESSION_SECRET ou credenciais reais de IA/SMTP. O alias de banco
recusa consultas. Clientes pagos lançam erro; fetch e transportes HTTP externos
são bloqueados no processo servidor. A página ainda carrega recursos estáticos
e o runtime Vite; isso não representa chamadas de IA.

Estados de A/B usam diretório exclusivo `/tmp/iai-browser-sim-*`, organizações
fictícias distintas e validade de duas horas. A/B são rodadas locais 1001/1002,
não próximas rodadas da campanha histórica. O orçamento real não é lido pelo
router; só se compara o hash do arquivo histórico na inicialização.

Cookies e APIs ficam sob `/technical-sim`, sem reutilizar autenticação original.
O adaptador Vite reescreve caminhos e rótulos apenas em memória; fontes de produto
não são alteradas. Arquivos de estado não são servidos pelo Vite.
Atualização/reinício deste serviço cria outro diretório descartável; esta
preparação não promete continuidade da mesma fixture entre reinícios do harness.
A recarga do navegador mantém a mesma fixture. Não execute servidores desta
fixture em hosts/armazenamentos independentes.

## Encerrar / evidências

Use **Encerrar ambiente descartável**, ou pare somente o workflow
**artifacts/iai-web: Browser Simulation**. Isso encerra o processo filho sem
parar app normal ou API original. Os arquivos fictícios são retidos em `/tmp`
para inspeção; não são backup durável e podem desaparecer com o ambiente.

`generated-artifacts/browser-simulation/access.json` informa endereço observado,
diretório fictício e comparação do estado histórico, sem transcrições/cookies.
Foram conferidos a inicialização e o carregamento da página; nenhum envio,
campanha, login automático de participante ou teste semântico foi executado.
O ensaio de navegador é conduzido pelo proprietário.
