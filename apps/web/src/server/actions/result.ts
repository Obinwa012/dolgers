export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});
