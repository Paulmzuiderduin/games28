// Keyset paging avoids offsets shifting when another admin inserts/deletes a row.
// Continue until an empty page: the server may cap results below our page size.
export async function collectIdPages(readPage, { pageSize = 500, maxPages = 10000 } = {}) {
  const rows = [];
  const seen = new Set();
  let afterId = null;
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await readPage({ afterId, limit: pageSize });
    if (!Array.isArray(batch)) throw new Error('Invalid paginated response. No partial data was accepted.');
    if (!batch.length) return rows;
    for (const row of batch) {
      if (typeof row?.id !== 'string' || !row.id || seen.has(row.id)) {
        throw new Error('Pagination did not advance safely. Retry loading the data.');
      }
      seen.add(row.id);
      rows.push(row);
    }
    afterId = batch.at(-1).id;
  }
  throw new Error('Pagination limit reached. No partial data was accepted.');
}

export async function fetchRestIdPages(endpoint, { headers, fetchImpl = fetch } = {}) {
  return collectIdPages(async ({ afterId, limit }) => {
    const url = new URL(endpoint);
    url.searchParams.set('order', 'id.asc');
    url.searchParams.set('limit', String(limit));
    if (afterId !== null) url.searchParams.set('id', `gt.${afterId}`);
    const response = await fetchImpl(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Unable to read complete review data: HTTP ${response.status}`);
    return response.json();
  });
}

export async function fetchClientIdPages(client, table, dateColumn) {
  const rows = await collectIdPages(async ({ afterId, limit }) => {
    let query = client.from(table).select('*').order('id', { ascending: true }).limit(limit);
    if (afterId !== null) query = query.gt('id', afterId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  });
  return rows.sort((a, b) => String(b[dateColumn] || '').localeCompare(String(a[dateColumn] || '')) || a.id.localeCompare(b.id));
}
