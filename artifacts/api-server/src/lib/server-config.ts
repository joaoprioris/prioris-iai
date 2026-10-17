import { runtimeHost } from "../../../../scripts/local-runtime-config.cjs";

export const serverHost = (): "127.0.0.1" | "0.0.0.0" => runtimeHost();
