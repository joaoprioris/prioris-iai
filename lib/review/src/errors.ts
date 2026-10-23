/** Entrada inválida ou não autenticada. Nunca é repetida pela fila: vai para quarentena. */
export class Rejected extends Error {
  readonly status: 400 | 401;
  constructor(message: string, status: 400 | 401 = 400) {
    super(message);
    this.name = "Rejected";
    this.status = status;
  }
}

/** Mesmo event_id com conteúdo diferente. Erro permanente: quarentena e revisão. */
export class EventConflict extends Rejected {
  constructor(message: string) {
    super(message, 400);
    this.name = "EventConflict";
  }
}
