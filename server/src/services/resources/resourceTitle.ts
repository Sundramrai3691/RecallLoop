export function displayResourceTitle(title: string | null | undefined, provider: string | null | undefined, url: string): string {
  const value = title?.trim();
  if (value && value.toLowerCase() !== url.trim().toLowerCase()) return value;

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "YouTube video";
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "Vimeo video";
  } catch {
    // Keep malformed source references intact as links; use attribution for the title.
  }
  const attribution = provider?.trim();
  return attribution ? `${attribution} resource` : "Learning resource";
}
