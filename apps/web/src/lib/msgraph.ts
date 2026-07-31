import { ConfidentialClientApplication } from '@azure/msal-node';

/**
 * Microsoft Graph integration (Part 7.1, 11.1). Each Host connects their own
 * Outlook/Microsoft 365 mailbox via standard OAuth; the app stores an
 * encrypted refresh token (lib/crypto.ts) so the send worker can send while
 * the Host is away (Part 2.2).
 *
 * One Azure AD app registration (owner's one-time setup, see
 * docs/OWNER_SETUP_CHECKLIST.md) serves every tenant — this is standard
 * multi-tenant OAuth, not a per-Host app registration.
 */

const GRAPH_SCOPES = ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read', 'offline_access'];

function assertConfigured() {
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    throw new MicrosoftNotConfiguredError();
  }
}

export class MicrosoftNotConfiguredError extends Error {
  constructor() {
    super(
      'Microsoft sign-in is not configured yet. Ask the operator to complete the Azure app registration step in docs/OWNER_SETUP_CHECKLIST.md.'
    );
    this.name = 'MicrosoftNotConfiguredError';
  }
}

function getMsalClient(): ConfidentialClientApplication {
  assertConfigured();
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
    },
  });
}

export async function getMicrosoftAuthUrl(state: string): Promise<string> {
  const msal = getMsalClient();
  return msal.getAuthCodeUrl({
    scopes: GRAPH_SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    state,
    prompt: 'select_account',
  });
}

export async function exchangeMicrosoftCode(code: string) {
  const msal = getMsalClient();
  const result = await msal.acquireTokenByCode({
    code,
    scopes: GRAPH_SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
  });

  if (!result) {
    throw new Error('Microsoft did not return a token. Please try connecting again.');
  }

  // msal-node's public types don't expose the refresh token on the result
  // object (it manages its own cache), so we pull it out of the token cache
  // for our own encrypted storage — this app needs to hold it itself since
  // the send worker is a separate process/service without access to msal's
  // in-memory cache.
  const cache = msal.getTokenCache().serialize();
  const parsed = JSON.parse(cache);
  const refreshTokenEntry = Object.values(parsed.RefreshToken || {})[0] as
    | { secret: string }
    | undefined;

  if (!refreshTokenEntry) {
    throw new Error('Could not extract a refresh token from Microsoft. Please try connecting again.');
  }

  return {
    email: result.account?.username ?? null,
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.expiresOn,
    refreshToken: refreshTokenEntry.secret,
  };
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  const msal = getMsalClient();
  const result = await msal.acquireTokenByRefreshToken({
    refreshToken,
    scopes: GRAPH_SCOPES,
  });

  if (!result) {
    throw new Error('Microsoft refresh failed — the connection likely needs to be re-authorized.');
  }

  return {
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.expiresOn,
  };
}

export interface SendMailParams {
  accessToken: string;
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
}

/**
 * Sends exactly one email through the Host's own mailbox via Graph's
 * /me/sendMail. This is why the recipient sees a genuine personal email
 * from the Host's real address, in the Host's real Sent folder (7.1).
 */
export async function sendMailViaGraph(params: SendMailParams): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: { contentType: 'HTML', content: params.htmlBody },
        toRecipients: [{ emailAddress: { address: params.toEmail, name: params.toName } }],
      },
      saveToSentItems: true,
    }),
  });

  if (response.status === 202) {
    return { ok: true };
  }

  const text = await response.text().catch(() => '');
  return { ok: false, status: response.status, error: text || response.statusText };
}

/** Graph returns 429 (throttled) or 403/401 (auth trouble) distinctly enough
 * that the worker can decide "pause and flag" vs. "retry with backoff"
 * (Part 7.1, 7.6). */
export function classifyGraphError(status: number): 'throttled' | 'needs_reconnect' | 'transient' | 'permanent' {
  if (status === 429) return 'throttled';
  if (status === 401 || status === 403) return 'needs_reconnect';
  if (status >= 500) return 'transient';
  return 'permanent';
}
