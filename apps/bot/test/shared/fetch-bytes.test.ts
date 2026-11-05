import { afterAll, expect, test } from "bun:test";

import { fetchBytes } from "@/shared/fetch-bytes.ts";

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/ok") {
      return new Response(new Uint8Array([1, 2, 3, 4]));
    }

    if (pathname === "/missing") {
      return new Response("no", { status: 404 });
    }

    if (pathname === "/big") {
      return new Response(new Uint8Array(5_000));
    }

    if (pathname === "/stream") {
      // Sans Content-Length : seule la lecture permet de détecter la taille.
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(3_000));
            controller.enqueue(new Uint8Array(3_000));
            controller.close();
          },
        }),
      );
    }

    await Bun.sleep(1_000);
    return new Response("slow");
  },
});
afterAll(() => server.stop(true));

const url = (path: string) => `http://localhost:${server.port}${path}`;
const limits = { timeoutMs: 300, maxBytes: 4_096 };

test("renvoie les octets d'une réponse valide", async () => {
  expect([...(await fetchBytes(url("/ok"), limits))!]).toEqual([1, 2, 3, 4]);
});

test("renvoie null pour une erreur HTTP, une cible injoignable ou un délai dépassé", async () => {
  expect(await fetchBytes(url("/missing"), limits)).toBeNull();
  expect(await fetchBytes("http://localhost:1/none", limits)).toBeNull();
  expect(await fetchBytes(url("/slow"), limits)).toBeNull();
});

test("renvoie null au-delà de la taille maximale, déclarée ou lue", async () => {
  expect(await fetchBytes(url("/big"), limits)).toBeNull();
  expect(await fetchBytes(url("/stream"), limits)).toBeNull();
});
