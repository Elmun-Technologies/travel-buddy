// Brand name is not final: always read from APP_NAME (baked at build time for static pages).
export const APP_NAME = process.env.APP_NAME || "Travel Buddy";

export type LegalInfo = {
  /** LEGAL_ENTITY: company that operates the service. */
  entity?: string;
  /** LEGAL_ADDRESS: its registered address. */
  address?: string;
  /** SUPPORT_EMAIL */
  email?: string;
  /** SUPPORT_TELEGRAM: username without "@". */
  telegram?: string;
};

const env = (name: string) => process.env[name]?.trim() || undefined;

/**
 * Operator and support details shown on the legal pages. Runtime env, so call it per request
 * (after `await connection()` in a server component), never at module scope.
 * A missing or malformed value is `undefined`: the page then leaves that line out.
 */
export function legalInfo(): LegalInfo {
  const email = env("SUPPORT_EMAIL");
  const telegram = env("SUPPORT_TELEGRAM")?.replace(/^@/, "");
  return {
    entity: env("LEGAL_ENTITY"),
    address: env("LEGAL_ADDRESS"),
    email: email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : undefined,
    telegram: telegram && /^[A-Za-z0-9_]{4,32}$/.test(telegram) ? telegram : undefined,
  };
}
