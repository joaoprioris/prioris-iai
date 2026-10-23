/**
 * Biblioteca de 80 momentos do Agente 5 (Feedback Estruturado): arquivo "Agente 5 — Feedback Estruturado" da pasta
 * AGENTES. É âncora semântica para classificação e cobertura de testes, não gabarito exclusivo de rota.
 * Cada momento traz a fase (Antes, Durante, Depois) e a dívida. O texto é o do documento, na ordem em que aparece.
 */
export type Fase = "Antes" | "Durante" | "Depois";
export type Custo = "paralisia" | "retrabalho" | "cinismo" | "ruptura";

export type DividaCodigo =
  | "evitacao_conflito"
  | "decisao_postergada"
  | "comunicacao_ambigua"
  | "autoridade_fragilizada"
  | "accountability_diluida"
  | "confianca_erosionada"
  | "aprendizado_bloqueado"
  | "alinhamento_simbolico"
  | "energia_emocional_degradada"
  | "maturidade_politica_insuficiente";

export const CUSTO_DA_DIVIDA: Record<DividaCodigo, Custo> = {
  evitacao_conflito: "paralisia",
  decisao_postergada: "paralisia",
  comunicacao_ambigua: "retrabalho",
  autoridade_fragilizada: "retrabalho",
  accountability_diluida: "retrabalho",
  confianca_erosionada: "cinismo",
  aprendizado_bloqueado: "cinismo",
  alinhamento_simbolico: "cinismo",
  energia_emocional_degradada: "ruptura",
  maturidade_politica_insuficiente: "ruptura",
};

export interface Momento {
  /** Posição de 1 a 80 na ordem do documento. */
  id: number;
  fase: Fase;
  divida: DividaCodigo;
  custo: Custo;
  texto: string;
}

/** Posições dos 10 momentos de ativação (Top 10 do documento), na ordem do Top 10. */
export const TOP10: readonly number[] = [8, 20, 25, 45, 54, 60, 63, 67, 73, 80];

const RAW: readonly (readonly [Fase, DividaCodigo, string])[] = [
  // Evitação de Conflito
  [
    "Antes",
    "evitacao_conflito",
    "Tenho que fazer a avaliação formal de alguém que precisa de feedback duro — e já adiei a conversa duas vezes",
  ],
  [
    "Antes",
    "evitacao_conflito",
    "Recebi um feedback formal com o qual discordo profundamente — e não sei como responder sem parecer que estou me defendendo",
  ],
  ["Antes", "evitacao_conflito", "O time nunca se dá feedback direto — todos concordam na sala e reclamam no corredor"],
  [
    "Antes",
    "evitacao_conflito",
    "Estou vendo um processo de 360 sendo preenchido por obrigação — as respostas são genéricas e ninguém está sendo honesto",
  ],
  [
    "Durante",
    "evitacao_conflito",
    "Estou num 1:1 de avaliação e percebo que estou usando uma linguagem tão cuidadosa que a mensagem que importa se perdeu",
  ],
  [
    "Durante",
    "evitacao_conflito",
    "Estou ouvindo um feedback e percebo que estou construindo minha defesa enquanto a pessoa ainda está falando",
  ],
  [
    "Durante",
    "evitacao_conflito",
    "Estou facilitando uma rodada de feedback em grupo e todo mundo está sendo gentil demais — ninguém está dizendo o que pensa",
  ],
  [
    "Depois",
    "evitacao_conflito",
    "Depois da avaliação formal, o colaborador me disse que tinha sido uma boa conversa — mas o problema que eu precisava endereçar não mudou",
  ],
  [
    "Depois",
    "evitacao_conflito",
    "Alguém que saiu do time deixou escrito que a cultura de feedback da área era 'a gente sabe o que não pode falar'",
  ],
  [
    "Depois",
    "evitacao_conflito",
    "Recebi uma avaliação positiva mas saí com a sensação de que o que realmente importava não foi tocado na conversa",
  ],
  // Decisão Postergada
  [
    "Antes",
    "decisao_postergada",
    "Sei há meses que preciso ter uma conversa de redirecionamento com alguém — e fico esperando um momento ideal que nunca vem",
  ],
  [
    "Antes",
    "decisao_postergada",
    "Tenho que dar um feedback que pode mudar o rumo de carreira de alguém — e não me sinto preparado para ter essa conversa",
  ],
  [
    "Antes",
    "decisao_postergada",
    "Fui solicitado a dar feedback formal sobre um par — e não sei como ser honesto sem comprometer a relação de trabalho",
  ],
  [
    "Antes",
    "decisao_postergada",
    "Meu gestor prometeu me dar feedback sobre o projeto há três meses — e ainda não aconteceu",
  ],
  [
    "Durante",
    "decisao_postergada",
    "Estou no meio de uma conversa de feedback e o que eu havia preparado já não faz sentido dado o que a pessoa acabou de me revelar",
  ],
  [
    "Durante",
    "decisao_postergada",
    "A pessoa está recebendo bem o feedback — mas ainda não cheguei no ponto difícil que precisava dizer",
  ],
  [
    "Durante",
    "decisao_postergada",
    "Estou sendo pressionado a fechar uma avaliação agora mas não tenho os dados que preciso para ser justo",
  ],
  [
    "Depois",
    "decisao_postergada",
    "O colaborador foi promovido sem nunca ter recebido o feedback que eu estava esperando o momento certo para dar",
  ],
  [
    "Depois",
    "decisao_postergada",
    "A conversa de avaliação aconteceu, mas nenhum dos dois saiu com um próximo passo claro",
  ],
  [
    "Depois",
    "decisao_postergada",
    "Soube depois que alguém estava interpretando meu silêncio como aprovação — quando eu estava só esperando para dar o feedback",
  ],
  // Comunicação Ambígua
  [
    "Antes",
    "comunicacao_ambigua",
    "Vou dar feedback sobre uma entrega abaixo do esperado — mas o critério de qualidade nunca foi combinado explicitamente antes",
  ],
  [
    "Antes",
    "comunicacao_ambigua",
    "Duas pessoas do time receberam o mesmo feedback genérico e entenderam coisas completamente diferentes sobre o que precisavam mudar",
  ],
  [
    "Antes",
    "comunicacao_ambigua",
    "Vou pedir feedback sobre minha performance e não sei como formular a pergunta para receber algo que realmente me ajude",
  ],
  [
    "Durante",
    "comunicacao_ambigua",
    "Estou dando um feedback no formato sanduíche e percebo que a pessoa está confusa sobre qual parte é central",
  ],
  [
    "Durante",
    "comunicacao_ambigua",
    "Estou recebendo um feedback tão indireto que não sei o que concretamente preciso mudar",
  ],
  [
    "Depois",
    "comunicacao_ambigua",
    "O feedback que dei foi interpretado como elogio — eu achava que tinha sido claro sobre o que precisava melhorar",
  ],
  [
    "Depois",
    "comunicacao_ambigua",
    "Pedi feedback formal sobre minha atuação e recebi uma resposta genérica que não me ajuda a mudar absolutamente nada",
  ],
  // Autoridade Fragilizada
  [
    "Antes",
    "autoridade_fragilizada",
    "Vou dar feedback para alguém mais sênior do que eu — e não sei como fazer isso sem parecer que estou ultrapassando o meu lugar",
  ],
  [
    "Antes",
    "autoridade_fragilizada",
    "Meu feedback vai ser contrariado informalmente pelo gestor da pessoa — isso já aconteceu antes, e anula o que eu digo",
  ],
  [
    "Antes",
    "autoridade_fragilizada",
    "A liderança sênior me pediu pra não dar um feedback que acho necessário — 'não é o momento'",
  ],
  [
    "Durante",
    "autoridade_fragilizada",
    "Estou dando um feedback e percebo que a pessoa não acredita que tenho autoridade para dar — está ouvindo por protocolo",
  ],
  [
    "Durante",
    "autoridade_fragilizada",
    "Estou recebendo um feedback de alguém que não tem contexto real do que aconteceu — e fico em dúvida se vale contextualizar ou se vai parecer que estou me defendendo",
  ],
  [
    "Depois",
    "autoridade_fragilizada",
    "Dei um feedback em 1:1 e soube depois que a pessoa foi falar com quem 'realmente decide' — e o feedback foi revertido",
  ],
  [
    "Depois",
    "autoridade_fragilizada",
    "Um feedback que dei foi parar no RH como reclamação formal — sem que eu soubesse que isso estava acontecendo",
  ],
  // Accountability Diluída
  [
    "Antes",
    "accountability_diluida",
    "Vou dar feedback sobre o resultado de um time — mas ninguém tem clareza de quem é responsável por cada parte da entrega",
  ],
  [
    "Antes",
    "accountability_diluida",
    "A falha aconteceu entre as responsabilidades de duas pessoas — e o feedback precisa chegar nas duas sem virar jogo de culpa",
  ],
  [
    "Durante",
    "accountability_diluida",
    "Estou numa retrospectiva e cada pessoa está atribuindo os problemas ao contexto ou ao processo — ninguém está falando de comportamento",
  ],
  [
    "Durante",
    "accountability_diluida",
    "Estou recebendo um feedback coletivo como se fosse pessoalmente meu — quando a decisão que gerou o problema foi compartilhada",
  ],
  [
    "Depois",
    "accountability_diluida",
    "No final do ciclo de avaliações, percebi que ninguém recebeu feedback sobre os problemas reais que aconteceram no trimestre",
  ],
  [
    "Depois",
    "accountability_diluida",
    "O feedback que dei a uma pessoa chegou alterado via terceiros até outra — e gerou um problema que não existia antes",
  ],
  // Alinhamento Simbólico
  [
    "Antes",
    "alinhamento_simbolico",
    "Tenho que escrever uma avaliação positiva de alguém que a empresa quer reter — mas minha avaliação honesta é mais complexa do que isso",
  ],
  [
    "Antes",
    "alinhamento_simbolico",
    "O processo de feedback foi redesenhado para parecer mais humano — mas é a mesma coleta de dados de performance com outra embalagem",
  ],
  [
    "Antes",
    "alinhamento_simbolico",
    "Vou participar de um 360 de alguém cujos resultados já estão decididos — o feedback é ritual, não insumo real",
  ],
  [
    "Durante",
    "alinhamento_simbolico",
    "Estou num processo de feedback onde percebo que todo mundo está gerenciando a mensagem — ninguém está falando o que observou de fato",
  ],
  [
    "Durante",
    "alinhamento_simbolico",
    "Estou dando um feedback alinhado com o que a empresa quer ouvir sobre a pessoa — não com o que eu realmente observei",
  ],
  [
    "Depois",
    "alinhamento_simbolico",
    "O ciclo de feedback terminou e ninguém ficou mais claro sobre o que precisa mudar — foi um ritual, não um processo",
  ],
  [
    "Depois",
    "alinhamento_simbolico",
    "Fui cobrado por dar um feedback honesto que 'não estava alinhado com a narrativa que precisamos construir'",
  ],
  // Confiança Erosionada
  [
    "Antes",
    "confianca_erosionada",
    "Sei que o feedback formal que vou receber foi escrito para me gerenciar — não para me desenvolver",
  ],
  [
    "Antes",
    "confianca_erosionada",
    "Nunca sei se o que me dizem nas conversas de feedback é o que pensam de verdade ou o que é seguro dizer",
  ],
  [
    "Antes",
    "confianca_erosionada",
    "Estou vendo um colega pedindo feedback só para criar uma imagem de abertura — sem intenção nenhuma de usar o que vai receber",
  ],
  [
    "Durante",
    "confianca_erosionada",
    "Estou dando um feedback e percebo que a pessoa está sendo receptiva demais — de um jeito que parece performance",
  ],
  [
    "Durante",
    "confianca_erosionada",
    "Estou recebendo um feedback muito positivo e percebo que estou questionando a sinceridade de quem está falando",
  ],
  [
    "Depois",
    "confianca_erosionada",
    "O feedback que recebi de forma formal foi diferente do que me foi dito informalmente antes — e agora não sei qual dos dois era o real",
  ],
  [
    "Depois",
    "confianca_erosionada",
    "Participei de um 360 com honestidade total e depois descobri que meu feedback foi identificado e atribuído a mim",
  ],
  // Aprendizado Bloqueado
  [
    "Antes",
    "aprendizado_bloqueado",
    "Tenho um ponto cego no meu comportamento que várias pessoas já perceberam — mas ninguém nunca chegou até mim para dizer diretamente",
  ],
  [
    "Antes",
    "aprendizado_bloqueado",
    "Vou pedir feedback sobre minha liderança e já sei que vou receber o que as pessoas acham que quero ouvir",
  ],
  [
    "Durante",
    "aprendizado_bloqueado",
    "Estou recebendo um feedback sobre algo que acho que já melhorei — e percebo que a melhora que sinto por dentro ainda não chegou do lado de fora",
  ],
  [
    "Durante",
    "aprendizado_bloqueado",
    "Estou dando um feedback de desenvolvimento e a pessoa está anotando tudo sem questionar nada — e isso me preocupa",
  ],
  [
    "Depois",
    "aprendizado_bloqueado",
    "Recebi feedback e agi imediatamente — mas percebi depois que fiz a mudança de forma sem entender o que precisava mudar de fundo",
  ],
  [
    "Depois",
    "aprendizado_bloqueado",
    "Recebi o mesmo feedback pela terceira vez de pessoas diferentes — e ainda não mudei nada",
  ],
  // Energia Emocional Degradada
  [
    "Antes",
    "energia_emocional_degradada",
    "Tenho que dar um feedback sobre algo que ainda me afeta emocionalmente — e não sei se consigo separar meu estado da mensagem",
  ],
  [
    "Antes",
    "energia_emocional_degradada",
    "Vou ter uma conversa de feedback difícil com alguém que está num momento de vida muito complicado — e não sei se o timing é esse mesmo",
  ],
  [
    "Antes",
    "energia_emocional_degradada",
    "Recebi um feedback muito duro sobre algo que está diretamente ligado à minha identidade profissional — não estou conseguindo processar",
  ],
  [
    "Antes",
    "energia_emocional_degradada",
    "Percebo que estou evitando pedir feedback porque sei que o que vou ouvir vai me custar emocionalmente",
  ],
  [
    "Durante",
    "energia_emocional_degradada",
    "Estou dando um feedback e a emoção da pessoa tomou conta da conversa — não sei se continuo com o que planejei ou paro",
  ],
  [
    "Durante",
    "energia_emocional_degradada",
    "Estou recebendo um feedback enquanto estou em estado de estresse agudo — estou ouvindo, mas nada está sendo processado",
  ],
  [
    "Durante",
    "energia_emocional_degradada",
    "A conversa de feedback virou uma descarga emocional dos dois lados — saímos com mais ruído do que clareza",
  ],
  [
    "Depois",
    "energia_emocional_degradada",
    "O feedback que dei destabilizou alguém de uma forma que eu não esperava — e a relação de trabalho ficou difícil depois disso",
  ],
  [
    "Depois",
    "energia_emocional_degradada",
    "Saí de uma conversa de feedback sabendo que o que foi dito era verdadeiro — mas não fui capaz de receber naquele momento",
  ],
  [
    "Depois",
    "energia_emocional_degradada",
    "Um feedback que recebi meses atrás só fez sentido agora — na época não tinha contexto emocional para absorver o que estava sendo dito",
  ],
  // Maturidade Política Insuficiente
  [
    "Antes",
    "maturidade_politica_insuficiente",
    "Vou dar um feedback que vai contrariar o que a liderança quer ouvir — e não sei se tenho capital político para sustentar isso",
  ],
  [
    "Antes",
    "maturidade_politica_insuficiente",
    "Fui avisado informalmente de que meu feedback para um colega pode gerar consequências na minha relação com a área dele",
  ],
  [
    "Antes",
    "maturidade_politica_insuficiente",
    "O ciclo de 360 está sendo usado politicamente — as pessoas dão feedback para proteger aliados e penalizar adversários",
  ],
  [
    "Antes",
    "maturidade_politica_insuficiente",
    "Preciso dar feedback para meu gestor — e não sei como fazer isso de forma que chegue sem que ele se feche imediatamente",
  ],
  [
    "Durante",
    "maturidade_politica_insuficiente",
    "Estou numa conversa de feedback e percebo que o que está sendo dito é gerenciado — a mensagem real está nas entrelinhas",
  ],
  [
    "Durante",
    "maturidade_politica_insuficiente",
    "Estou facilitando um processo de feedback em que uma das pessoas tem poder direto sobre a carreira da outra — e isso distorce tudo",
  ],
  [
    "Durante",
    "maturidade_politica_insuficiente",
    "Estou recebendo um feedback e percebo que o que está sendo dito está sendo moldado pelo medo de quem mais pode ouvir",
  ],
  [
    "Depois",
    "maturidade_politica_insuficiente",
    "O feedback que dei honestamente foi tirado do contexto e usado como argumento numa conversa política que não tinha nada a ver com desenvolvimento",
  ],
  [
    "Depois",
    "maturidade_politica_insuficiente",
    "Meu feedback para meu gestor chegou até ele alterado — via terceiros que inseriram a própria interpretação",
  ],
  [
    "Depois",
    "maturidade_politica_insuficiente",
    "Depois do ciclo de avaliações, percebi que quem deu feedbacks honestos foi marcado como difícil — quem elogiou avançou",
  ],
];

export const MOMENTOS: readonly Momento[] = RAW.map(([fase, divida, texto], index) => ({
  id: index + 1,
  fase,
  divida,
  custo: CUSTO_DA_DIVIDA[divida],
  texto,
}));

export const momentoPorId = (id: number): Momento | undefined => MOMENTOS[id - 1];
