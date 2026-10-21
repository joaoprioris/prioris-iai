import nodemailer from "nodemailer";
import { localHttpEnabled } from "./auth-state";
export function mailConfiguration() {
  const password = process.env.SMTP_PASSWORD?.replace(/\s/g, "");
  if (process.env.AUTH_EMAIL_ENABLED !== "true" || !password) throw new Error("MAIL_NOT_CONFIGURED");
  const user = process.env.SMTP_USER ?? "joao.mendonca@prioris.com.br";
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  if (!["smtp-relay.gmail.com", "smtp.gmail.com"].includes(host)) throw new Error("MAIL_HOST_NOT_ALLOWED");
  const base = new URL(process.env.APP_BASE_URL ?? "https://leadership-support-tool--joaoprioris.replit.app");
  if ((base.protocol !== "https:" && !(localHttpEnabled() && base.protocol === "http:")) || base.username || base.password || base.search || base.hash) throw new Error("MAIL_BASE_URL_INVALID");
  return { user, host, password, base };
}
export function mailAvailable(): boolean { try { mailConfiguration(); return true; } catch { return false; } }
export async function sendAccessEmail(email: string, token: string): Promise<void> {
  const config = mailConfiguration();
  const transport = nodemailer.createTransport({ host: config.host, port: config.host === "smtp.gmail.com" ? 465 : 587, secure: config.host === "smtp.gmail.com", requireTLS: true, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" }, auth: { user: config.user, pass: config.password }, logger: false, debug: false, connectionTimeout: 15000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true });
  const link = new URL("/", config.base); link.hash = "token=" + token;
  const result = await transport.sendMail({ from: { name: "IAí | PRIORIS", address: config.user }, to: email, subject: "Seu acesso ao IAí", text: "Use o link abaixo para entrar no IAí. Ele vale por 10 minutos e pode ser usado uma única vez.\n\n" + link.toString() + "\n\nCódigo de acesso: " + token + "\n\nSe você não solicitou este acesso, ignore esta mensagem." });
  if (!(result.accepted ?? []).map(String).some(address => address.toLowerCase() === email.toLowerCase())) throw new Error("MAIL_NOT_ACCEPTED");
}
