export function renderTable(rows) { return rows.map((r) => Object.values(r).join(' | ')).join('\n'); }
