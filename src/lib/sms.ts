// Text messages (SMS), only as a last resort and only with the person's consent: when the bot cannot
// reach someone (they blocked it) and the message is about their safety or a prepared offer.
// Off until SMS_PROVIDER is set. Provider: Eskiz.uz (Uzbekistan numbers). Every SMS costs money,
// so callers cap how many a person can get.

export interface SmsProvider {
  /** Send one message to an E.164 number. Returns true if the provider accepted it. */
  send(to: string, text: string): Promise<boolean>;
}

/** +998901234567 → "998901234567" (Eskiz wants digits only, and only Uzbek numbers). */
export function eskizNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return /^998\d{9}$/.test(d) ? d : null;
}

export function createEskiz(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): SmsProvider {
  let token: string | null = null;
  const base = "https://notify.eskiz.uz/api";
  async function login() {
    const body = new FormData();
    body.set("email", env.ESKIZ_EMAIL ?? "");
    body.set("password", env.ESKIZ_PASSWORD ?? "");
    const res = await fetchFn(`${base}/auth/login`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { data?: { token?: string } } | null;
    token = data?.data?.token ?? null;
    return token;
  }
  async function post(to: string, text: string) {
    const body = new FormData();
    body.set("mobile_phone", to);
    body.set("message", text);
    body.set("from", env.ESKIZ_FROM || "4546");
    return fetchFn(`${base}/message/sms/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
  }
  return {
    async send(phone, text) {
      const to = eskizNumber(phone);
      if (!to) return false;
      if (!token && !(await login())) return false;
      let res = await post(to, text);
      if (res?.status === 401 && (await login())) res = await post(to, text); // token expired
      return !!res?.ok;
    },
  };
}

let provider: SmsProvider | null | undefined;
/** The configured provider, or null (SMS off). */
export function smsProvider(): SmsProvider | null {
  if (provider !== undefined) return provider;
  provider =
    process.env.SMS_PROVIDER === "eskiz" && process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD
      ? createEskiz()
      : null;
  return provider;
}

export const smsEnabled = () => smsProvider() !== null;
