---
name: avaliar-agente-conversacional
description: Como construir, testar e ajustar um agente conversacional do IAí (Feedback e os próximos) até as conversas ficarem boas. Use ao criar um agente novo, ao mexer na orientação de um agente existente, ao rodar a avaliação com líderes simulados ou ao decidir se uma conversa é satisfatória. Resume o que funcionou e o que não funcionou na Fase 1 do agente de Feedback.
---

# Avaliar e ajustar um agente conversacional do IAí

Aprendizado do agente de Feedback (PR 3). Custou cerca de 290 conversas simuladas e US$ 3 em API. Leia antes de gastar a primeira chamada.

## Regra de ouro

**Orientação curta no prompt, regra dura no código.** O modelo cumpre bem o que a orientação pede uma vez e mal o que ela proíbe várias vezes. Toda regra que não pode falhar vira verificação em código com nova tentativa. Prompt comprido com muitas proibições piorou o resultado, não melhorou.

## O que funcionou

1. **Reescrever o prompt do zero, curto, em vez de somar regras.** A versão com remendos acumulados tinha contradição própria: mandava deixar "uma última provocação" ao encerrar e também proibia pergunta no fechamento. O modelo obedecia a primeira. Revise o prompt procurando instruções que se contradizem antes de culpar o modelo.
2. **Reescrita que mostra o rascunho.** Para corrigir estilo, a segunda chamada precisa receber o histórico, o rascunho do agente e a correção pedida ("Reescreva corrigindo: ..."). Refazer a resposta do zero com um aviso no prompt quase não surtiu efeito. Com o rascunho, a taxa por resposta caiu: abertura de validação de 17% para 1%, fala pronta de 17% para 3%, resposta longa de 17% para 7%. Implementação em `runTurn` (`conversation.ts`), regras em `styleIssues` (`guidance.ts`).
3. **Vocabulário vetado só por código.** Instrução no prompt não bastou, porque o líder simulado usava a palavra e o agente repetia. `FORBIDDEN_IN_REPLIES` dispara uma reescrita e, se persistir, devolve erro sem consumir troca.
4. **Fechamento sem pergunta imposto por código.** Mesmo com a instrução, o modelo fechava com pergunta e a frase de encerramento. Solução: uma reescrita e, se ainda sobrar, remover só a pergunta que fecha o texto (`stripTrailingQuestions`).
5. **Critério de aceitação com checagens determinísticas**, não só nota de modelo. Veja `deterministicChecks` e `accept` em `eval/judge.ts`.
6. **Leitura humana da transcrição inteira.** O avaliador automático deixou passar defeitos que o dono enxerga ao ler.

7. **Cansaço e repetição também por código.** Líder simulado impaciente derrubava a nota mesmo com conversa útil. Se a fala do líder mostra cansaço ("tanta pergunta", "me fala logo"), injete instrução de resposta curta e sem pergunta; detecte pergunta repetida por sobreposição de palavras com as perguntas anteriores (`LEADER_FRUSTRATION`, `similar` em `guidance.ts`).
8. **Não ficar mais duro que a orientação do dono.** Uma regra minha ("nunca dar exemplo") era mais rígida que a original ("exemplos curtos e adaptáveis são permitidos, discurso pronto não"). O líder pedia uma abertura curta cinco vezes e saía sem nada. Permita uma única abertura curta quando pedida.

## O que não funcionou

- **Remendar o prompt a cada falha.** Cada rodada parecia melhorar e a taxa ficou parada em cerca de 50%.
- **Trocar de modelo.** Sonnet 5.5 como agente aceitou 7 de 14 cenários, o mesmo que Haiku 5.5, com custo cerca de 7 vezes maior. O gargalo era o desenho, não o modelo.
- **Truncar sentenças com interrogação em qualquer lugar.** Minha primeira trava removia perguntas dentro de aspas e quebrava o texto (`falar.". Você não precisa`). Só pode remover a pergunta no fim da resposta. Sempre leia a última resposta de uma conversa gerada com guarda novo.
- **Confiar no avaliador de modelo barato.** Ele marca quase todo problema como "leve" e aprova conversas com fala pronta, mea culpa e validação em todo turno. Serve para triagem, não para decidir.
- **Contar conversas geradas por versões antigas do código.** Conte só as geradas pelo código que será entregue.

## Armadilhas de infraestrutura

- **Raciocínio interno consome `max_tokens`.** Avaliador com limite de 2500 e líder simulado com 400 estouravam com "resposta incompleta". Valores que funcionaram: avaliador 8000, líder simulado 1200. A mensagem de erro agora traz modelo, limite, saída e tipos de bloco; use isso para diagnosticar.
- **O avaliador devolve JSON malformado de vez em quando** e código de problema com acento ("avanço"). Compare ignorando acento e repita a avaliação uma vez, sem repetir se o erro for de teto de custo.
- **`runTurn` engole a causa dos erros do provider.** O runner agora registra a causa; sem isso uma conversa interrompida não se explica.
- **Variável da chave:** `PRIORIS_API_KEY`. Confirme com a chamada gratuita de lista de modelos antes de gastar.
- **Teto de custo é cumulativo.** Passe `--spent-before` com o total gasto até a rodada anterior; a trava só enxerga o que o processo atual gastou.

## Critério de conversa satisfatória

Uma conversa só conta se:

1. O líder simulado dá nota 4 ou 5 e usaria de novo.
2. O avaliador não aponta problema grave e dá utilidade 4 ou mais.
3. Nenhuma resposta tem vocabulário vetado ou problema de estilo (`styleIssues`).
4. Encerra com a frase de saída e sem pergunta antes dela.
5. **Eu li a transcrição inteira** e confirmei: o líder sai com intenção própria e próximo passo, nenhuma fala inteira entregue pronta, nada afirmado sobre o outro que o líder não contou, nenhum comentário do agente sobre as próprias regras, fechamento coerente.

Registre cada aprovada como "aprovada" ou "aprovada com ressalvas" e liste as ressalvas. Não esconda ressalva para fechar a conta.

## Processo recomendado para um agente novo

1. Escreva a orientação curta a partir dos documentos do agente. Revise contradições.
2. Implemente as guardas em código antes de gastar: vocabulário vetado, fechamento sem pergunta, regras de estilo com reescrita que mostra o rascunho.
3. Rode testes offline (`pnpm run test:feedback` e equivalente) e o checador de tipos nos arquivos do agente.
4. Rode uma rodada pequena com Haiku (`PRIORIS_FEEDBACK_MODEL=claude-haiku-5-5`), 14 cenários custam cerca de US$ 0,10.
5. Agregue os motivos de reprovação por rodada antes de mexer em qualquer coisa. Ataque o motivo mais frequente, não a conversa mais irritante.
6. Quando um motivo se repete mesmo com a instrução, mova a regra para o código.
7. Leia as transcrições aprovadas. Troque as com defeito por outras geradas pelo código final.
8. Para o dono, entregue: quantas conversas rodaram, quantas falharam por erro técnico, quantas foram reprovadas, as aprovadas com o veredito de cada uma. Texto sem hífen nem travessão, sem a palavra proibida do produto.

## Regras fixas do dono para o produto

- Nunca usar as palavras de tratamento clínico ou de profissional de saúde mental em texto de produto, nem repetir quando o líder usar.
- Nada de SED gravado enquanto as conversas não estiverem boas, nem SED provisório.
- Conversas de teste são sempre marcadas como simuladas e não entram no repositório.
- Só o dono faz merge. Não mexer em PR de outra frente.
