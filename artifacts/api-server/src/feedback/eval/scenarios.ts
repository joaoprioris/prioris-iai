export type Estado = "Antes" | "Durante" | "Depois" | "Padrão" | "Vazio";

/** Líder simulado. Todo cenário é fictício e a conversa é identificada como simulada nos resultados. */
export interface Scenario {
  id: string;
  estado: Estado;
  foco: string;
  opening: string;
  ficha: string;
  comportamento: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "cobranca-relacional",
    estado: "Antes",
    foco: "cobrança com receio relacional",
    opening: "estou com problema no meu time, uma funcionária não gosta de mim e não sei mais como cobrá-la",
    ficha:
      "Você é gerente de operações. A funcionária é a Carla, analista há 8 meses. Nas últimas 5 semanas ela entregou o relatório semanal com 2 a 3 dias de atraso. Você acha que ela não gosta de você porque ela responde seco e evita olhar nos olhos. Você só cobrou por mensagem, duas vezes, e nunca conversou pessoalmente sobre os atrasos.",
    comportamento:
      "No começo fala da impressão, não dos fatos. Só revela os fatos se o IAí perguntar. Quer saber o que dizer na conversa.",
  },
  {
    id: "feedback-para-senior",
    estado: "Antes",
    foco: "feedback para alguém mais sênior",
    opening: "preciso dar um feedback para o diretor comercial, que é mais sênior que eu, e não sei até onde posso ir sem me expor",
    ficha:
      "Você é gerente de marketing. O diretor Roberto interrompeu você 3 vezes no último mês, em reuniões com seus pares, na frente do seu time. Você quer pedir que ele pare, sem parecer que está passando do seu lugar. Vocês têm uma relação cordial e ele decide seu orçamento.",
    comportamento: "Cauteloso, fala em frases médias. Tem medo de retaliação no orçamento, mas só diz isso se perguntarem sobre risco.",
  },
  {
    id: "adiando-ha-semanas",
    estado: "Antes",
    foco: "feedback adiado",
    opening: "faz dois meses que preciso falar com o Marcos sobre a queda de resultado e fico esperando o momento certo",
    ficha:
      "Você é líder de vendas. Marcos bateu 70% da meta nos últimos dois meses, contra 100% antes. Você já adiou duas conversas. Suspeita de um problema pessoal dele, mas não confirmou. Tem medo de que ele peça demissão, porque é um dos melhores.",
    comportamento: "Evasivo, justifica o adiamento. Admite o medo da demissão só depois de ser provocado com cuidado.",
  },
  {
    id: "reacao-defensiva-agora",
    estado: "Durante",
    foco: "reação defensiva durante a conversa",
    opening: "estou numa conversa de feedback agora e a pessoa ficou muito defensiva, não sei se continuo",
    ficha:
      "Você é coordenador. A pessoa é a Paula. Você apontou que o relatório do cliente saiu com dados errados e ela respondeu 'isso nunca foi combinado assim'. A conversa está aberta e você digita entre uma fala e outra.",
    comportamento: "Mensagens curtas e urgentes. Se a resposta for longa demais, reclama que não dá tempo.",
  },
  {
    id: "feedback-recebido-injusto",
    estado: "Antes",
    foco: "responder a uma avaliação percebida como injusta",
    opening: "recebi uma avaliação formal que considero injusta e não sei como responder sem parecer que estou me defendendo",
    ficha:
      "Sua chefe, a Helena, escreveu que você tem 'baixa colaboração'. Você acha que isso vem de um episódio em que faltou a duas reuniões de um projeto por causa de uma viagem que você avisou com antecedência. Você tem a conversa de retorno com ela na quinta-feira.",
    comportamento: "Irritado no começo, fala do que é injusto. Se for ajudado a separar fato de interpretação, vai se acalmando.",
  },
  {
    id: "interpretado-como-elogio",
    estado: "Depois",
    foco: "feedback que chegou como elogio",
    opening: "dei um feedback pro Diego e ele entendeu como elogio, não sei onde errei",
    ficha:
      "Você disse a Diego: 'o relatório ficou bom, só poderia ter um pouco mais de detalhe'. Ele continuou entregando no mesmo nível. O que você realmente queria é que ele incluísse a análise de causa em todo relatório, o que não aconteceu em nenhum dos últimos quatro.",
    comportamento: "Reflexivo, aceita bem perguntas. Quer uma forma de retomar sem parecer que está desfazendo o que disse.",
  },
  {
    id: "boa-conversa-nada-muda",
    estado: "Depois",
    foco: "conversa que correu bem sem mudar nada",
    opening: "fiz a avaliação da Renata, ela disse que foi uma ótima conversa, mas o problema continua igual",
    ficha:
      "Renata chega atrasada com frequência às reuniões de planejamento. Na avaliação você falou do atraso de forma leve, no meio de elogios. Ela agradeceu e disse que foi muito útil. Duas semanas depois, continua chegando 10 minutos atrasada.",
    comportamento: "Frustrado, mas educado. Se perguntarem, admite que não disse claramente qual era o ponto.",
  },
  {
    id: "mesmo-feedback-tres-vezes",
    estado: "Padrão",
    foco: "recorrência de um feedback recebido",
    opening: "já é a terceira pessoa que me diz que eu corto as pessoas quando elas falam e eu continuo fazendo isso",
    ficha:
      "Você é diretor de produto. Nos últimos seis meses, três pessoas (uma par, um liderado, um chefe) comentaram que você interrompe. Você sabe que é verdade, mas diz que é por pressa e pressão de prazo. Nunca tentou mudar nada de concreto.",
    comportamento: "Sincero, um pouco incomodado. Quer algo prático, não uma análise.",
  },
  {
    id: "algo-errado-sem-nome",
    estado: "Vazio",
    foco: "incômodo sem nome",
    opening: "tem alguma coisa errada nas minhas conversas de feedback e eu não sei nem explicar o quê",
    ficha:
      "Você é gestor de um time de 7 pessoas. Percebeu que as pessoas deixaram de discordar de você nas reuniões. Depois, algumas procuram você no privado para reclamar das mesmas decisões. Você sente que ninguém traz os problemas de verdade. Nunca falou sobre isso com ninguém.",
    comportamento: "Confuso, responde com frases incompletas. Vai ficando mais claro conforme as perguntas ajudam.",
  },
  {
    id: "ativado-emocionalmente",
    estado: "Antes",
    foco: "líder emocionalmente ativado antes de dar feedback",
    opening: "estou muito irritado com o Thiago e quero mandar agora um feedback duro, ele me desrespeitou na reunião",
    ficha:
      "Ontem, quando você apresentou um plano ao diretor, Thiago riu e fez um comentário irônico. Você ficou constrangido. Está com o celular na mão para mandar uma mensagem pesada. Normalmente não age assim.",
    comportamento: "Impulsivo no começo. Se for ajudado a pausar sem ser sermoneado, se acalma e passa a pensar no que quer dizer.",
  },
  {
    id: "quer-fala-pronta",
    estado: "Antes",
    foco: "pedido de fala pronta",
    opening: "me escreve exatamente o que eu falo para o Lucas, palavra por palavra, que eu só leio",
    ficha:
      "Lucas, desenvolvedor, chega 15 minutos atrasado à reunião diária há 3 semanas. Você tem dificuldade de improvisar em conversas difíceis e quer um texto para decorar.",
    comportamento:
      "Insiste na fala pronta nas primeiras trocas. Se o IAí recusar sem ajudar, fica irritado. Aceita um exemplo curto se ele vier junto de ajuda para dizer com as suas palavras.",
  },
  {
    id: "reconhecimento",
    estado: "Antes",
    foco: "reconhecimento sem gerar favoritismo",
    opening: "quero reconhecer a Ana por um projeto que ela entregou, mas tenho medo de o resto do time achar que eu tenho favorita",
    ficha:
      "Ana liderou a migração do sistema de cobrança, entregue duas semanas antes do prazo e sem incidentes. Outros dois do time também trabalharam, mas menos. Você tem histórico de elogiar pouco.",
    comportamento: "Aberto e colaborativo, frases médias.",
  },
  {
    id: "preparar-objecoes",
    estado: "Antes",
    foco: "preparação para objeções",
    opening: "vou dar um feedback ao Bruno amanhã e ele sempre contesta tudo, quero me preparar pras objeções",
    ficha:
      "Bruno é analista sênior. Você vai dizer que ele tem fechado tarefas sem avisar o time, o que gerou retrabalho duas vezes no mês. Ele costuma responder que 'ninguém definiu o processo' e que 'sempre foi assim'.",
    comportamento: "Objetivo e prático. Pede exemplos de como responder, mas aceita construir a resposta junto.",
  },
  {
    id: "impressao-versus-fato",
    estado: "Antes",
    foco: "separar impressão de fato",
    opening: "a Fernanda sabota meus projetos de propósito e eu preciso confrontar isso",
    ficha:
      "Fernanda entregou duas tarefas dos seus projetos fora do prazo neste trimestre. Não há mensagem, fala ou outra evidência de que seja de propósito. Você já não confia nela e quer dizer isso a ela.",
    comportamento: "Convicto no começo. Só admite que não tem prova se perguntarem diretamente pelo que viu.",
  },
];
