import QRCode from "qrcode";

/**
 * Render a QR PNG for an anchor payload, base64-encoded for JSON transport.
 *
 * Stateless by design (AOK-01 anchor minting is race-free because the ID/
 * payload/row persist in a single insert; the image itself is never stored —
 * it is re-rendered from the payload string on every request). Requires the
 * Node runtime (Buffer) — the route that calls this must NOT set
 * `export const runtime = "edge"`.
 */
export async function renderQrPngBase64(payload: string): Promise<string> {
  const buffer = await QRCode.toBuffer(payload, {
    type: "png",
    margin: 1,
    width: 256,
  });
  return buffer.toString("base64");
}
