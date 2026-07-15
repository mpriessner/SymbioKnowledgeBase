interface RequestOriginInput {
  url: string;
  headers: Headers;
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function getRequestOrigin(request: RequestOriginInput): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host")
  );

  if (!forwardedHost) {
    return requestUrl.origin;
  }

  const forwardedProtocol = firstForwardedValue(
    request.headers.get("x-forwarded-proto")
  );
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : requestUrl.protocol.slice(0, -1);

  return `${protocol}://${forwardedHost}`;
}
