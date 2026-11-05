import { PGlite } from "@electric-sql/pglite";

import { applyMigrations } from "../lib/db.ts";
import { DEV_USERS, installAuth, seed, type DevUserKey } from "./seed.ts";

const b64url = (value: string) => Buffer.from(value).toString("base64url");

type PgError = { code?: string; message?: string; detail?: string; hint?: string };

export type DevSupabase = Readonly<{
  url: string;
  port: number;
  guildId: string;
  /** Ouvre la base à une requête SQL directe (tests, curiosité). */
  query: PGlite["query"];
  close: () => Promise<void>;
}>;

/** Jeton factice reconnu par `getClaims()` (il retombe sur `/auth/v1/user`, que ce serveur sert). */
export function devToken(user: (typeof DEV_USERS)[DevUserKey], now = Date.now()): string {
  const exp = Math.floor(now / 1000) + 7 * 24 * 3600;
  return [
    b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64url(JSON.stringify({ sub: user.id, aud: "authenticated", role: "authenticated", exp, iat: exp - 60, iss: "dev-local", session_id: "dev", user_metadata: metadata(user) })),
    "dev",
  ].join(".");
}

const metadata = (user: (typeof DEV_USERS)[DevUserKey]) => ({
  provider_id: user.discordId,
  full_name: user.username,
  name: user.username,
  custom_claims: { global_name: user.name },
});

const userOf = (token: string | null) => {
  if (!token) return null;
  try {
    const sub = (JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { sub?: string }).sub;
    return Object.values(DEV_USERS).find((user) => user.id === sub) ?? null;
  } catch {
    return null;
  }
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/**
 * Remplace Supabase en local : les VRAIES migrations et fonctions `panel_*` tournent sur PGlite, avec
 * des données de démonstration, et ce serveur parle comme PostgREST/GoTrue pour ce dont le panneau a besoin
 * (`/rest/v1/rpc/<panel_*>`, `/auth/v1/user`). La sécurité testée est donc la vraie : un visiteur
 * qui n'est pas dans `panel_admin` est refusé par la base, pas par un faux.
 */
export async function startDevSupabase(options: { port: number; panelUrl: string; guildId: string }): Promise<DevSupabase> {
  const client = new PGlite();
  await applyMigrations(client);
  await installAuth(client);
  await seed(client, options.guildId);

  // PGlite n'a qu'une connexion : on sérialise les requêtes (chacune pose son utilisateur puis appelle la fonction).
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  const callFunction = (user: ReturnType<typeof userOf>, fn: string, args: Record<string, unknown>) =>
    serial(() =>
      client.transaction(async (tx) => {
        await tx.query("SELECT set_config('dev.uid', $1, true)", [user?.id ?? ""]);
        const names = Object.keys(args);
        const call = `SELECT ${fn}(${names.map((name, i) => `${name} => $${i + 1}`).join(", ")}) AS result`;
        return (await tx.query<{ result: unknown }>(call, names.map((name) => args[name]))).rows[0]?.result ?? null;
      }),
    );

  const server = Bun.serve({
    port: options.port,
    async fetch(request) {
      const url = new URL(request.url);
      const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
      const user = userOf(bearer);

      if (url.pathname === "/auth/v1/user") {
        return user
          ? json({ id: user.id, aud: "authenticated", role: "authenticated", app_metadata: { provider: "discord" }, user_metadata: metadata(user) })
          : json({ code: 401, msg: "invalid token" }, 401);
      }

      if (url.pathname.startsWith("/auth/v1/") && url.pathname.includes("jwks")) return json({ keys: [] });

      const rpc = /^\/rest\/v1\/rpc\/(panel_[a-z0-9_]+)$/.exec(url.pathname);
      if (rpc && request.method === "POST") {
        const args = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        if (!Object.keys(args).every((name) => /^p_[a-z0-9_]+$/.test(name))) return json({ code: "PGRST202", message: "invalid argument name" }, 400);

        try {
          return json(await callFunction(user, rpc[1]!, args));
        } catch (caught) {
          const error = caught as PgError;
          // PostgREST : 42501 (privilège insuffisant) devient 401 sans session, 403 avec une session.
          const status = error.code === "42501" ? (user ? 403 : 401) : error.code?.startsWith("42") ? 404 : 400;
          return json({ code: error.code ?? "XX000", message: error.message ?? "error", details: error.detail ?? null, hint: error.hint ?? null }, status);
        }
      }

      if (url.pathname === "/__dev/login") {
        const key = (url.searchParams.get("as") ?? "owner") as DevUserKey;
        const target = DEV_USERS[key];
        if (!target) return new Response("utilisateur inconnu", { status: 404 });

        const token = devToken(target);
        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
        const session = { access_token: token, refresh_token: "dev", token_type: "bearer", expires_in: 7 * 24 * 3600, expires_at: exp, user: { id: target.id } };
        // Même nom de cookie que @supabase/ssr : « sb-<premier libellé de l'hôte>-auth-token ».
        const cookie = `sb-${new URL(options.panelUrl).hostname.split(".")[0]}-auth-token`;
        const to = new URL(url.searchParams.get("to") ?? "/dashboard", options.panelUrl).toString();

        return new Response(null, {
          status: 302,
          headers: { location: to, "set-cookie": `${cookie}=base64-${b64url(JSON.stringify(session))}; Path=/; Max-Age=604800; SameSite=Lax` },
        });
      }

      if (url.pathname === "/__dev" || url.pathname === "/") {
        const links = (Object.keys(DEV_USERS) as DevUserKey[])
          .map((key) => `<li><a href="/__dev/login?as=${key}">${DEV_USERS[key].name}</a> — ${DEV_USERS[key].role ?? "pas administrateur (doit être refusé)"}</li>`)
          .join("");
        return new Response(
          `<!doctype html><meta charset="utf-8"><title>Sakutina — pile locale</title><body style="font:16px system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>Pile locale</h1><p>Base de démonstration (vraies migrations, vraies fonctions <code>panel_*</code>). Se connecter au panneau comme :</p><ul>${links}</ul><p><a href="${options.panelUrl}">Ouvrir le panneau</a></p></body>`,
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }

      return json({ code: "PGRST404", message: "not found" }, 404);
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    port: server.port ?? options.port,
    guildId: options.guildId,
    query: client.query.bind(client) as PGlite["query"],
    close: async () => {
      await server.stop(true);
      await client.close();
    },
  };
}
