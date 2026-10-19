import type { AuthInfo } from "@modelcontextprotocol/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAuthConfig } from "./env";

let cached:
  | {
      issuer: string;
      audience: string;
      jwks: ReturnType<typeof createRemoteJWKSet>;
    }
  | undefined;

function authState() {
  const { issuer, audience } = getAuthConfig();
  if (!cached || cached.issuer !== issuer || cached.audience !== audience) {
    cached = {
      issuer,
      audience,
      jwks: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
    };
  }
  return cached;
}

export async function verifyOAuthToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  try {
    const { issuer, audience, jwks } = authState();
    const { payload } = await jwtVerify(bearerToken, jwks, { issuer, audience });
    const scopeString =
      typeof payload.scope === "string"
        ? payload.scope
        : Array.isArray((payload as any).permissions)
          ? (payload as any).permissions.join(" ")
          : "";
    const scopes = scopeString.split(/\s+/).filter(Boolean);
    const sub = typeof payload.sub === "string" ? payload.sub : "oauth-user";
    return { token: bearerToken, scopes, clientId: sub, extra: { subject: sub } };
  } catch {
    return undefined;
  }
}
