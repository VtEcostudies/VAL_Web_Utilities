/*
    Load a Threatened & Endangered species CSV list and index rows by the
    "Scientific Name" column. The parsed object is cached in sessionStorage
    keyed by the CSV path, so the list is fetched once per session.

    Expected header columns include at minimum:
        Scientific Name, State Status, Federal Status
    Additional columns are carried through on each row as-is.
*/
const DEFAULT_KEY_COL = 'Scientific Name';

export async function getStoredTnEListCsv(csvPath, keyCol = DEFAULT_KEY_COL) {
    if (!csvPath) {return {};}
    return fetchTnEListCsv(csvPath, keyCol);
}

export async function fetchTnEListCsv(csvPath, keyCol = DEFAULT_KEY_COL) {
    try {
        const res = await fetch(csvPath);
        if (!res.ok) {
            console.error(`fetchTnEListCsv(${csvPath}) HTTP ${res.status}`);
            return {};
        }
        const text = await res.text();
        const rows = parseCsv(text);
        if (!rows.length) {return {};}
        const header = rows.shift().map(h => h.trim());
        const out = {};
        rows.forEach(cells => {
            const obj = {};
            header.forEach((col, i) => {obj[col] = (cells[i] ?? '').trim();});
            const name = obj[keyCol];
            if (name) {out[name] = obj;}
        });
        return out;
    } catch (err) {
        console.error(`fetchTnEListCsv(${csvPath}) ERROR:`, err);
        return {};
    }
}

// RFC 4180 CSV parser: handles quoted fields, embedded commas/newlines,
// and escaped quotes (""). Returns an array of row arrays.
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {field += '"'; i++;}
                else {inQuotes = false;}
            } else {
                field += c;
            }
            continue;
        }
        if (c === '"') {inQuotes = true; continue;}
        if (c === ',') {row.push(field); field = ''; continue;}
        if (c === '\r') {continue;}
        if (c === '\n') {row.push(field); rows.push(row); row = []; field = ''; continue;}
        field += c;
    }
    if (field.length || row.length) {row.push(field); rows.push(row);}
    return rows.filter(r => r.some(v => v !== ''));
}
