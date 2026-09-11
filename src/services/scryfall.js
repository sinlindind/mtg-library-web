export const fetchAutocompleteSuggestions = async (query) => {
  if (!query || query.trim().length < 2) return [];
  const res = await fetch(
    `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query.trim())}`
  );
  const json = await res.json();
  return json.data || [];
};

export const fetchScryfallSearch = async (query, sortOption) => {
  const res = await fetch(
    `https://api.scryfall.com/cards/search?unique=prints&order=${sortOption}&q=!%22${encodeURIComponent(query.trim())}%22`
  );
  const json = await res.json();
  return json.data || [];
};

export const fetchScryfallDetailsChunked = async (cardsToExport, onProgress) => {
  const scryfallDataMap = {};
  const chunkSize = 75;
  const chunks = [];

  for (let i = 0; i < cardsToExport.length; i += chunkSize) {
    chunks.push(cardsToExport.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const identifiers = chunk.map((c) => ({ id: c.scryfall_id }));

    try {
      const res = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers }),
      });
      const json = await res.json();

      (json.data || []).forEach((scryfallCard) => {
        scryfallDataMap[scryfallCard.id.toLowerCase()] = scryfallCard;
      });
    } catch (err) {
      console.error('Error fetching Scryfall collection chunk:', err);
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / chunks.length) * 100));
    }
  }

  return scryfallDataMap;
};