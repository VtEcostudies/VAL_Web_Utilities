/*
    Fetch global (GRank) and subnational (SRank) conservation ranks from the
    NatureServe Explorer public API. Results are cached in sessionStorage keyed
    by `${subnation}:${scientificName}` so repeat lookups within a session skip
    the network call.

    API: POST https://explorer.natureserve.org/api/data/speciesSearch
    Response fields used: results[0].gRank, results[0].roundedGRank,
    results[0].nations[].subnations[].{subnationCode, roundedSRank}.
*/
const Storage = sessionStorage;
const API_URL = 'https://explorer.natureserve.org/api/data/speciesSearch';

export async function getStoredNatureServeRanks(scientificName, subnation = 'VT') {
    if (!scientificName) {return null;}
    const storeKey = `natureServe:${subnation}:${scientificName}`;
    const cached = Storage.getItem(storeKey);
    if (cached) {
        try {return JSON.parse(cached);} catch (e) {/* fall through to refetch */}
    }
    const data = await fetchNatureServeRanks(scientificName, subnation);
    try {Storage.setItem(storeKey, JSON.stringify(data));} catch (e) {/* quota - ignore */}
    return data;
}

export async function fetchNatureServeRanks(scientificName, subnation = 'VT') {
    const body = {
        criteriaType: 'species',
        textCriteria: [{
            paramType: 'textSearch',
            searchToken: scientificName,
            matchAgainst: 'scientificName',
            operator: 'equals'
        }],
        statusCriteria: [],
        locationCriteria: [],
        pagingOptions: {recordsPerPage: 5, page: 0}
    };
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            console.error(`fetchNatureServeRanks(${scientificName}) HTTP ${res.status}`);
            return null;
        }
        const json = await res.json();
        console.log(`fetchNatureServeRanks(${scientificName}) RESULT:`, json);
        const hit = (json.results || [])[0];
        if (!hit) {return null;}
        let roundedSRank = null;
        for (const nation of (hit.nations || [])) {
            const sub = (nation.subnations || []).find(s => s.subnationCode === subnation);
            if (sub) {roundedSRank = sub.roundedSRank || null; break;}
        }
        return {
            scientificName: hit.scientificName || scientificName,
            elementGlobalId: hit.elementGlobalId || null,
            nsxUrl: hit.nsxUrl || null,
            gRank: hit.gRank || null,
            roundedGRank: hit.roundedGRank || null,
            subnation,
            roundedSRank
        };
    } catch (err) {
        console.error(`fetchNatureServeRanks(${scientificName}) ERROR:`, err);
        return null;
    }
}
