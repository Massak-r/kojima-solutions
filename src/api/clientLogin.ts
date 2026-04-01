import { apiFetch } from './client';

export interface ClientLoginProject {
  id: string;
  title: string;
  status: string;
  clientSlug?: string;
  lastActivity?: string;
}

export interface ClientLoginResult {
  client: { id: string; name: string; organization?: string };
  projects: ClientLoginProject[];
}

export function clientLogin(email: string) {
  return apiFetch<ClientLoginResult>('client_login.php', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
