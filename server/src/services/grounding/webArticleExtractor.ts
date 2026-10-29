import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { AppError } from "../../utils/errors.js";

const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && parts[2] === 99))) ||
    (a === 198 && ((b === 18 || b === 19) || (b === 51 && parts[2] === 100))) ||
    (a === 203 && b === 0 && parts[2] === 113));
}

function firstPublicIpv4(addresses: Array<{ address: string; family: number }>): string | null {
  const ipv4 = addresses.filter(({ family }) => family === 4);
  if (!ipv4.length || ipv4.some(({ address }) => !isPublicIpv4(address))) return null;
  return ipv4[0].address;
}

export async function validatePublicArticleUrl(rawUrl: string, resolveHost = lookup): Promise<URL> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new AppError("Enter a valid public article URL.", 400, "RESOURCE_URL_INVALID"); }
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || url.hash ||
      (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")))) {
    throw new AppError("Only public HTTP or HTTPS article links on their standard ports are supported.", 400, "RESOURCE_URL_INVALID");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isIP(host) === 6) {
    throw new AppError("This address is not available for import. Use a public article or paste an excerpt you are allowed to use.", 400, "RESOURCE_URL_BLOCKED");
  }
  if (isIP(host) === 4) {
    if (!isPublicIpv4(host)) throw new AppError("This address is not available for import. Use a public article or paste an excerpt you are allowed to use.", 400, "RESOURCE_URL_BLOCKED");
    return url;
  }
  let addresses: Array<{ address: string; family: number }>;
  try { addresses = await resolveHost(host, { all: true, verbatim: true }); }
  catch { throw new AppError("The article host could not be reached. Check the link and try again.", 400, "RESOURCE_URL_UNREACHABLE"); }
  if (!firstPublicIpv4(addresses)) {
    throw new AppError("This address is not available for import. Use a public article or paste an excerpt you are allowed to use.", 400, "RESOURCE_URL_BLOCKED");
  }
  return url;
}

function decodeHtml(text: string): string {
  return text.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_match, number: string) => String.fromCodePoint(parseInt(number, 16)));
}

function plainText(html: string): string {
  return decodeHtml(html.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|nav|header|footer|aside|form|noscript|iframe|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|section|article|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")).replace(/[\t\f\v ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractHtmlArticle(html: string, pageUrl: string): { title: string; text: string; sections: string[] } {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i) ?? html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)/i);
  const title = titleMatch ? plainText(titleMatch[1]).slice(0, 200) : new URL(pageUrl).hostname;
  const candidates = [...html.matchAll(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map((match) => match[2]);
  const body = candidates.sort((a, b) => b.length - a.length)[0] ?? html;
  const text = plainText(body);
  if (text.length < 80) throw new AppError("This page has too little readable text. Paste an excerpt or upload a supported document instead.", 422, "RESOURCE_CONTENT_UNAVAILABLE");
  const sections = [...body.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi)].map((match) => plainText(match[1])).filter(Boolean).slice(0, 40);
  return { title, text: text.slice(0, 250_000), sections };
}

async function requestPage(url: URL): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  const host = url.hostname;
  const addresses = await lookup(host, { all: true, verbatim: true });
  const pinnedAddress = firstPublicIpv4(addresses);
  if (!pinnedAddress) {
    throw new AppError("This address is not available for import. Use a public article or paste an excerpt you are allowed to use.", 400, "RESOURCE_URL_BLOCKED");
  }
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request({
      protocol: url.protocol, hostname: pinnedAddress, port: url.port || undefined,
      path: `${url.pathname}${url.search}`, method: "GET", servername: url.protocol === "https:" ? host : undefined,
      headers: { Host: url.host, "User-Agent": "RecallLoop-ResourceImporter/1.0", Accept: "text/html,application/xhtml+xml" },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve({ status: res.statusCode, location: res.headers.location, contentType: "", body: Buffer.alloc(0) }); return;
      }
      const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
      if (res.statusCode !== 200 || !(contentType.includes("text/html") || contentType.includes("application/xhtml+xml"))) {
        res.resume(); resolve({ status: res.statusCode ?? 0, contentType, body: Buffer.alloc(0) }); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (value: Buffer) => { size += value.length; if (size > MAX_HTML_BYTES) { req.destroy(new AppError("This page is too large to import. Paste a shorter excerpt instead.", 413, "RESOURCE_TOO_LARGE")); return; } chunks.push(value); });
      res.on("end", () => resolve({ status: 200, contentType, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new AppError("The article took too long to respond. Retry or paste an excerpt instead.", 408, "RESOURCE_FETCH_TIMEOUT")));
    req.on("error", (error) => reject(error instanceof AppError ? error : new AppError("The article could not be fetched. Check the link and retry.", 502, "RESOURCE_FETCH_FAILED")));
    req.end();
  });
}

export async function fetchPublicArticle(rawUrl: string, validate = validatePublicArticleUrl, fetchPage = requestPage): Promise<{ url: string; title: string; text: string; sections: string[] }> {
  let url = await validate(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetchPage(url);
    if (response.location) {
      if (redirect === MAX_REDIRECTS) throw new AppError("This article redirected too many times. Use its final public URL.", 400, "RESOURCE_REDIRECT_LIMIT");
      url = await validate(new URL(response.location, url).toString());
      continue;
    }
    if (response.status !== 200 || !(response.contentType.includes("text/html") || response.contentType.includes("application/xhtml+xml"))) {
      throw new AppError("This link did not return a public HTML article. Paste an excerpt or upload a supported document instead.", 415, "RESOURCE_TYPE_UNSUPPORTED");
    }
    return { url: url.toString(), ...extractHtmlArticle(response.body.toString("utf8"), url.toString()) };
  }
  throw new AppError("The article could not be imported.", 502, "RESOURCE_FETCH_FAILED");
}
