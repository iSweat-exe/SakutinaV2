type FetchBytesOptions = Readonly<{
  timeoutMs: number;
  maxBytes: number;
}>;

/**
 * Télécharge une ressource avec délai et taille maximaux. Renvoie `null` au
 * moindre problème (réseau, statut, trop gros) : l'appelant dégrade sans échouer.
 */
export async function fetchBytes(
  url: string,
  { timeoutMs, maxBytes }: FetchBytesOptions,
): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

    if (!response.ok || !response.body) {
      return null;
    }

    const declared = Number(response.headers.get("content-length"));

    if (Number.isFinite(declared) && declared > maxBytes) {
      return null;
    }

    const chunks: Uint8Array[] = [];
    let received = 0;

    for await (const chunk of response.body) {
      received += chunk.byteLength;

      if (received > maxBytes) {
        return null;
      }

      chunks.push(chunk);
    }

    const bytes = new Uint8Array(received);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return bytes;
  } catch {
    return null;
  }
}
