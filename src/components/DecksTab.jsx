import React, { useState, useEffect } from 'react';
import CardItem from './CardItem';
import { fetchScryfallSearch } from '../services/scryfall';

export default function DecksTab({
  decks = [],
  activeDeck,
  setActiveDeck,
  activeDeckCards = [],
  loading,
  fetchDecks,
  fetchDeckCards,
  handleCreateDeck,
  handleDeleteDeck,
  handleUpdateDeckCard,
  handleExportMissingToWishlist,
  libraryMap = {},
  wishlistMap = {},
  fetchWishlist,
  setPreviewImage,
}) {
  const [newDeckName, setNewDeckName] = useState('');
  const [deckFormat, setDeckFormat] = useState('commander');
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const safeDecks = Array.isArray(decks) ? decks : [];
  const safeDeckCards = Array.isArray(activeDeckCards) ? activeDeckCards : [];
  const safeSearchResults = Array.isArray(searchResults) ? searchResults : [];

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  useEffect(() => {
    if (activeDeck?.id) {
      fetchDeckCards(activeDeck.id);
    }
  }, [activeDeck?.id, fetchDeckCards]);

  const handleSearchCards = async (e) => {
    e.preventDefault();
    if (!cardSearchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await fetchScryfallSearch(cardSearchQuery);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Deck Statistics Calculations
  const totalDeckCards = safeDeckCards.reduce((acc, c) => acc + (c.quantity || 0), 0);

  const getOwnershipStatus = (scryfallId, requiredQty) => {
    const owned = libraryMap[scryfallId] || { reg: 0, foil: 0 };
    const totalOwned = (owned.reg || 0) + (owned.foil || 0);
    if (totalOwned >= requiredQty) return { status: 'owned', text: `🟢 Own ${totalOwned} / Need ${requiredQty}` };
    if (totalOwned > 0) return { status: 'partial', text: `🟡 Own ${totalOwned} / Need ${requiredQty}` };
    return { status: 'missing', text: `🔴 Own 0 / Need ${requiredQty}` };
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Selector & Create Deck */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="font-semibold text-sm shrink-0">Active Deck:</label>
          <select
            value={activeDeck?.id || ''}
            onChange={(e) => {
              const selected = safeDecks.find((d) => d.id === e.target.value);
              setActiveDeck(selected || null);
            }}
            className="p-2 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm flex-1 md:w-64"
          >
            <option value="">-- Select a Deck --</option>
            {safeDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name} ({deck.format ? deck.format.toUpperCase() : 'COMMANDER'})
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateDeck(newDeckName, deckFormat);
            setNewDeckName('');
          }}
          className="flex items-center gap-2 w-full md:w-auto"
        >
          <input
            type="text"
            placeholder="New deck name..."
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className="p-2 text-sm border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex-1"
          />
          <select
            value={deckFormat}
            onChange={(e) => setDeckFormat(e.target.value)}
            className="p-2 text-sm border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="commander">Commander</option>
            <option value="standard">Standard</option>
            <option value="modern">Modern</option>
          </select>
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer shrink-0"
          >
            + Create
          </button>
        </form>
      </div>

      {activeDeck ? (
        <div className="space-y-6">
          {/* Deck Header & Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-2xl font-bold">{activeDeck.name}</h2>
              <p className="text-sm text-slate-500">
                Format: <span className="capitalize font-medium">{activeDeck.format}</span> | Total Cards: <span className="font-bold">{totalDeckCards}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExportMissingToWishlist(libraryMap, fetchWishlist)}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                ✨ Wishlist Missing Cards
              </button>
              <button
                onClick={() => handleDeleteDeck(activeDeck.id)}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Delete Deck
              </button>
            </div>
          </div>

          {/* Add Cards Search Section */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-bold text-lg">Add Cards to Deck</h3>
            <form onSubmit={handleSearchCards} className="flex gap-2">
              <input
                type="text"
                placeholder="Search card to add..."
                value={cardSearchQuery}
                onChange={(e) => setCardSearchQuery(e.target.value)}
                className="flex-1 p-2 text-sm border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-semibold cursor-pointer"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {safeSearchResults.length > 0 && (
              <div className="max-h-80 overflow-y-auto space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {safeSearchResults.map((card) => {
                  const scryfallId = String(card.id).toLowerCase();
                  const inDeck = safeDeckCards.find((c) => c.scryfall_id === scryfallId);

                  return (
                    <div
                      key={card.id}
                      className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm"
                    >
                      <div>
                        <span className="font-bold">{card.name}</span>
                        <span className="text-xs text-slate-500 ml-2">({card.set_name})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {inDeck && <span className="text-xs text-blue-500 font-semibold">{inDeck.quantity}x in deck</span>}
                        <button
                          onClick={() => handleUpdateDeckCard(card, 1)}
                          className="px-2 py-1 bg-emerald-600 text-white text-xs rounded font-bold cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deck Cards List with Ownership Indicators */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Deck List ({safeDeckCards.length} Cards)</h3>
            {safeDeckCards.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No cards in this deck yet. Use the search above to add cards!</div>
            ) : (
              safeDeckCards.map((card) => {
                const ownership = getOwnershipStatus(card.scryfall_id, card.quantity);

                return (
                  <div key={card.id} className="relative">
                    <CardItem
                      card={card}
                      libraryMap={libraryMap}
                      wishlistMap={wishlistMap}
                      setPreviewImage={setPreviewImage}
                      type="library"
                    />
                    
                    {/* Deck Controls Overlay */}
                    <div className="mt-2 flex flex-wrap justify-between items-center bg-slate-100 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        {ownership.text}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">In Deck:</span>
                        <button
                          onClick={() => handleUpdateDeckCard(card, -1)}
                          className="w-7 h-7 bg-white dark:bg-slate-700 rounded font-bold text-sm border border-slate-300 dark:border-slate-600 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold text-sm">{card.quantity}</span>
                        <button
                          onClick={() => handleUpdateDeckCard(card, 1)}
                          className="w-7 h-7 bg-blue-600 text-white rounded font-bold text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          Select a deck from the top dropdown or create a new one to begin building.
        </div>
      )}
    </div>
  );
}