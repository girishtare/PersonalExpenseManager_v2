import 'server-only';
import { OAuth2Client } from 'google-auth-library';

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function createOAuthClient(redirectUri: string) {
  return new OAuth2Client(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET, redirectUri);
}

/** access_type=offline + prompt=consent so a refresh token is issued even on a reconnect. */
export function buildAuthUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
  const client = createOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  });
}
