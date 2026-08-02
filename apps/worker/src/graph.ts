import { ConfidentialClientApplication } from '@azure/msal-node';

const GRAPH_SCOPES = ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/User.Read', 'offline_access'];

function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
    },
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresOn: Date }> {
  const msal = getMsalClient();
  const result = await msal.acquireTokenByRefreshToken({ refreshToken, scopes: GRAPH_SCOPES });
  if (!result) throw new Error('Microsoft refresh failed - mailbox connection likely needs to be re-authorized.');
  return { accessToken: result.accessToken, expiresOn: result.expiresOn ?? new Date(Date.now() + 55 * 60_000) };
}

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export interface GraphAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // base64
}

export async function sendMail(params: {
  accessToken: string;
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
  attachments?: GraphAttachment[];
}): Promise<SendResult> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: { contentType: 'HTML', content: params.htmlBody },
        toRecipients: [{ emailAddress: { address: params.toEmail, name: params.toName } }],
        ...(params.attachments && params.attachments.length > 0
          ? {
              attachments: params.attachments.map((a) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: a.name,
                contentType: a.contentType,
                contentBytes: a.contentBytes,
              })),
            }
          : {}),
      },
      saveToSentItems: true,
    }),
  });

  if (response.status === 202) return { ok: true };

  const error = await response.text().catch(() => response.statusText);
  return { ok: false, status: response.status, error };
}

export type GraphErrorClass = 'throttled' | 'needs_reconnect' | 'transient' | 'permanent';

export function classifyGraphError(status: number | undefined): GraphErrorClass {
  if (status === 429) return 'throttled';
  if (status === 401 || status === 403) return 'needs_reconnect';
  if (status !== undefined && status >= 500) return 'transient';
  return 'permanent';
}
