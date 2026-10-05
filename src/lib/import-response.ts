export type ImportApiResponse = {
  success: boolean;
  error?: string;
  preview?: boolean;
  [key: string]: unknown;
};

/**
 * Import routes answer with JSON, but a crash or a proxy error page answers with
 * HTML. Awaiting `res.json()` on those throws and the caller replaces it with a
 * generic "Network error", hiding the real reason. Parse defensively and fall
 * back to the status code plus a short snippet of the body.
 */
export async function readImportResponse(
  res: Response
): Promise<ImportApiResponse> {
  const text = await res.text();
  if (text) {
    try {
      return JSON.parse(text) as ImportApiResponse;
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 200);
      return {
        success: false,
        error: `Import failed (HTTP ${res.status})${snippet ? `: ${snippet}` : ""}`,
      };
    }
  }
  return {
    success: false,
    error: `Import failed (HTTP ${res.status}). Please try again.`,
  };
}