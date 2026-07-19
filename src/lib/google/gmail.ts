import 'server-only';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
      client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface ListMessagesResult {
  ids: string[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export async function listMessageIds(params: {
  accessToken: string;
  query: string;
  pageToken?: string;
  maxResults: number;
}): Promise<ListMessagesResult> {
  const url = new URL(`${GMAIL_API}/users/me/messages`);
  url.searchParams.set('q', params.query);
  url.searchParams.set('maxResults', String(params.maxResults));
  if (params.pageToken) url.searchParams.set('pageToken', params.pageToken);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!res.ok) throw new Error(`Gmail messages.list failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number };
  return {
    ids: (data.messages ?? []).map((m) => m.id),
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate ?? 0,
  };
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function findPart(part: GmailPart, mimeType: string): GmailPart | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|td|table|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Prefers the text/plain part; falls back to stripping tags from text/html. */
function extractMessageText(payload: GmailPart): string {
  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) {
    const text = decodeBase64Url(plain.body.data);
    // Some senders (e.g. BOBCARD's alerts) emit a placeholder plain-text part - literally the
    // string "null" in one observed case - alongside the real content in text/html. A part that
    // trivially short isn't real content, so fall through to HTML instead of returning it.
    if (text.trim().length > 20) return text;
  }
  const html = findPart(payload, 'text/html');
  if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return '';
}

export async function getMessage(params: { accessToken: string; messageId: string }): Promise<{ bodyText: string }> {
  const url = new URL(`${GMAIL_API}/users/me/messages/${params.messageId}`);
  url.searchParams.set('format', 'full');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!res.ok) throw new Error(`Gmail messages.get failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { payload: GmailPart };
  return { bodyText: extractMessageText(data.payload) };
}
