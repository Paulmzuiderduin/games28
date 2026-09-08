export function resolveReportEvidenceUrl(report, source, editedUrl) {
  const value = String(editedUrl ?? report.source_url ?? '').trim();
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter the exact official article or allocation-list URL.'); }
  const host = (address) => {
    try { return new URL(address).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
  };
  const hosts = [source.url, source.allocationUrl, source.entryUrl, source.rulesUrl].map(host).filter(Boolean);
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.includes(host(url.href))) {
    throw new Error('The evidence link must be HTTPS and belong to the selected official source. Choose a matching source or replace the link.');
  }
  return url.href;
}
