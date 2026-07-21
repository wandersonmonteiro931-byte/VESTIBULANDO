const SESSION_KEY = "vestibulando:session-id";

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function clearSessionId(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
