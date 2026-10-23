import { authenticate, type Envelope, type ResolveKey } from "./auth.ts";
import { Rejected } from "./errors.ts";

export interface IngressRequest {
  headers: Record<string, string | undefined>;
  /** Corpo original. Com `isBase64Encoded`, é o texto base64 entregue pelo gateway. */
  body: string | Buffer | null | undefined;
  isBase64Encoded?: boolean;
}

export interface IngressDeps {
  resolveKey: ResolveKey;
  /** Deve aguardar a aceitação pela fila. Falha lança e vira 503. */
  publish: (envelope: Envelope) => Promise<void>;
  now?: number;
}

export interface IngressResponse {
  statusCode: 202 | 400 | 401 | 503;
  body: string;
}

const GENERIC: Record<400 | 401 | 503, string> = {
  400: '{"status":"rejected"}',
  401: '{"status":"unauthorized"}',
  503: '{"status":"unavailable"}',
};

/**
 * Autentica e valida os bytes originais, publica o envelope e só então responde 202.
 * Mensagens de erro são genéricas: não revelam qual verificação falhou.
 */
export async function handleIngress(request: IngressRequest, deps: IngressDeps): Promise<IngressResponse> {
  let raw: Buffer;
  try {
    const { body } = request;
    if (typeof body === "string") {
      if (body.length > 24000) throw new Rejected("body too large");
      if (request.isBase64Encoded) {
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body) || body.length % 4 !== 0) throw new Rejected("invalid transport encoding");
        raw = Buffer.from(body, "base64");
      } else {
        raw = Buffer.from(body, "utf8");
      }
    } else if (Buffer.isBuffer(body)) {
      raw = body;
    } else {
      throw new Rejected("missing body");
    }
  } catch (error) {
    if (error instanceof Rejected) return { statusCode: error.status, body: GENERIC[error.status] };
    return { statusCode: 503, body: GENERIC[503] };
  }

  let envelope: Envelope;
  try {
    envelope = authenticate(raw, request.headers, deps.resolveKey, deps.now);
  } catch (error) {
    if (error instanceof Rejected) return { statusCode: error.status, body: GENERIC[error.status] };
    return { statusCode: 503, body: GENERIC[503] };
  }

  try {
    await deps.publish(envelope);
  } catch {
    return { statusCode: 503, body: GENERIC[503] };
  }
  return { statusCode: 202, body: '{"status":"accepted"}' };
}
