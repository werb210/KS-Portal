export const DEV_SERVER_HOST: string;
export function serverHost(env: Record<string, string | undefined>): string;
export function addServer(csp: string, host: string): string;
export function patchServerIfChanged(json: string, host: string): string | null;
