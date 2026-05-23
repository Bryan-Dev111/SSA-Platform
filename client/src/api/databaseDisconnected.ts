/** Shared helpers when the API reports DATABASE_DISCONNECTED. */

export function notifyDatabaseDisconnected(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('db:disconnected'));
  }
}

export function parseApiErrorBody(
  text: string
): { code?: string; connected?: boolean; error?: string; message?: string } | null {
  try {
    return JSON.parse(text) as {
      code?: string;
      connected?: boolean;
      error?: string;
      message?: string;
    };
  } catch {
    return null;
  }
}

export async function handleApiResponseDisconnected(res: Response): Promise<void> {
  if (res.status !== 503) return;
  const text = await res.clone().text();
  const body = parseApiErrorBody(text);
  if (body?.code === 'DATABASE_DISCONNECTED') {
    notifyDatabaseDisconnected();
  }
}
