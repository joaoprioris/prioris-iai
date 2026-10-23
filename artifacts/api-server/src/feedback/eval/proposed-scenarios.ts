import type { Scenario } from "./scenarios.ts";

/**
 * Cenários propostos para fechar os buracos de cobertura da biblioteca de 80 momentos (ver coverage.ts).
 * NÃO fazem parte de SCENARIOS e não foram rodados: rodar custa API e depende de decisão do dono.
 * Todo líder é fictício. `momento` aponta o id do momento da biblioteca que o cenário cobre.
 */
export interface ProposedScenario extends Scenario {
  momento: number;
}

export const PROPOSED_SCENARIOS: ProposedScenario[] = [
  {
    id: "mensagem-se-perdeu",
    momento: 5,
    estado: "Durante",
    foco: "mensagem central perdida por excesso de cuidado",
    opening:
      "estou num 1:1 de avaliação e percebo que estou falando tão cuidadosamente que a mensagem que importa se perdeu",
    ficha:
      "Você é gerente de atendimento. Está avaliando o Rafael, que atrasou o fechamento de chamados 4 vezes nas últimas 6 semanas. Faz 20 minutos que você só elogiou e comentou o contexto. Ainda não disse que o problema são os atrasos recorrentes. Ele está tranquilo e agradece.",
    comportamento:
      "Mensagens curtas, a conversa está em andamento. Quer saber como voltar ao ponto sem soar brusco. Se a resposta for longa demais, reclama que não dá tempo.",
  },
  {
    id: "retro-sem-comportamento",
    momento: 37,
    estado: "Durante",
    foco: "retrospectiva em que ninguém fala de comportamento",
    opening:
      "estou numa retrospectiva e todo mundo explica o problema pelo processo, ninguém fala do que faria diferente",
    ficha:
      "Você é líder de projetos. O lançamento atrasou duas semanas. Na retrospectiva, cada um culpa o contexto: 'o prazo era curto', 'faltou definição'. Você sabe que a decisão de manter o escopo foi sua e de mais dois líderes, e ninguém a mencionou. Quer que o grupo fale de comportamento sem virar caça a culpado.",
    comportamento:
      "Objetivo. Só admite que a decisão de escopo foi dele se perguntarem qual foi o papel dele no que aconteceu.",
  },
  {
    id: "avaliacao-para-reter",
    momento: 41,
    estado: "Antes",
    foco: "avaliação positiva por pressão de retenção",
    opening:
      "preciso escrever a avaliação do Caio e a empresa quer reter ele, mas minha avaliação honesta é mais complexa",
    ficha:
      "Caio é engenheiro sênior e entrega bem, mas trata mal quem revisa o código dele e isso levou dois colegas a pedirem para sair do time dele. A diretoria quer muito mantê-lo e pediu avaliações positivas neste ciclo. Você pensa em suavizar tudo.",
    comportamento:
      "Dividido, frases médias. Só admite que está tentado a omitir o comportamento se perguntarem o que a avaliação vai deixar de dizer.",
  },
  {
    id: "elogio-suspeito",
    momento: 52,
    estado: "Durante",
    foco: "feedback muito positivo recebido com desconfiança",
    opening: "estou recebendo um feedback muito positivo do meu diretor e não consigo acreditar que seja sincero",
    ficha:
      "Seu diretor, o Henrique, está dizendo na avaliação que seu trabalho está excelente em tudo. Três semanas atrás ele reclamou de você com um par seu. Você desconfia que ele esteja só administrando você porque circula o boato de uma reorganização da área. Você não viu nenhum documento sobre isso.",
    comportamento:
      "Desconfiado, frases curtas. Quer saber se pergunta ou aceita. Só admite que não tem prova da reorganização se perguntarem o que viu de concreto.",
  },
  {
    id: "honestos-marcados",
    momento: 80,
    estado: "Depois",
    foco: "honestidade punida no ciclo de avaliações",
    opening:
      "depois do ciclo de avaliações percebi que quem deu feedback honesto foi marcado como difícil e quem elogiou foi promovido",
    ficha:
      "Você é gerente. No ciclo de avaliações, você e outra gerente deram feedbacks diretos sobre a diretoria de produto e ambas ouviram que têm perfil difícil. Dois colegas que só elogiaram foram promovidos. No próximo ciclo você ainda terá de dar feedback e se pergunta se vale a pena ser honesto.",
    comportamento:
      "Amargo no começo. Se for ajudado a separar o que viu do que supõe, passa a pensar em como continuar direto sem se expor além do necessário.",
  },
];
