import React, { useState, useEffect, useMemo } from 'react';
import CardItem from './CardItem';

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
  handleSetCommanderCard,
  handleExportMissingToWishlist,
  libraryMap = {},
  wishlistMap = {},
  fetchWishlist,
  setPreviewImage,
  setShowExportModal,
}) {
  const [newDeckName, setNewDeckName] = useState('');
  const [deckFormat, setDeckFormat] = useState('commander');

  const safeDecks = Array.isArray(decks) ? decks : [];
  const safeDeckCards = Array.isArray(activeDeckCards) ? activeDeckCards : [];
  const isCommanderFormat = (activeDeck?.format || 'commander').toLowerCase() === 'commander';

  useEffect(() => {
    if (typeof fetchDecks === 'function') {
      fetchDecks();
    }
  }, [fetchDecks]);

  useEffect(() => {
    if (activeDeck?.id && typeof fetchDeckCards === 'function') {
      fetchDeckCards(activeDeck.id);
    }
  }, [activeDeck?.id, fetchDeckCards]);

  const normalizeId = (card) =>
    String(card?.scryfall_id || card?.id || '').trim().toLowerCase();

  const isCommanderCard = (card) =>
    Boolean(card?.is_commander) || String(card?.board || '').toLowerCase() === 'commander';

  const commanderCards = useMemo(() => {
    if (!isCommanderFormat) return [];
    return safeDeckCards.filter((card) => isCommanderCard(card));
  }, [isCommanderFormat, safeDeckCards]);

  const mainDeckCards = useMemo(() => {
    if (!isCommanderFormat) return safeDeckCards;
    return safeDeckCards.filter((card) => !isCommanderCard(card));
  }, [isCommanderFormat, safeDeckCards]);

  const totalDeckCards = safeDeckCards.reduce((acc, c) => acc + (c.quantity || 0), 0);

  const getOwnershipStatus = (scryfallId, requiredQty) => {
    const key = String(scryfallId || '').trim().toLowerCase();
    const owned = libraryMap[key] || { reg: 0, foil: 0 };
    const totalOwned = (owned.reg || 0) + (owned.foil || 0);
    if (totalOwned >= requiredQty) {
      return { status: 'owned', text: `🟢 Own ${totalOwned} / Need ${requiredQty}` };
    }
    if (totalOwned > 0) {
      return { status: 'partial', text: `🟡 Own ${totalOwned} / Need ${requiredQty}` };
    }
    return { status: 'missing', text: `🔴 Own 0 / Need ${requiredQty}` };
  };

  const renderDeckCardRow = (card, isCommander = false) => {
    const sid = normalizeId(card);
    const ownership = getOwnershipStatus(sid, card.quantity);
    const cardBoard = card.board || 'mainboard';

    return (
      <div
        key={card.id || `${sid}-${cardBoard}`}
        className={`relative rounded-xl transition-all ${
          isCommander
            ? 'ring-2 ring-amber-400/90 shadow-lg shadow-amber-500/15 bg-amber-50/40 dark:bg-amber-950/20 p-2'
            : ''
        }`}
      >
        <CardItem
          card={card}
          libraryMap={libraryMap}
          wishlistMap={wishlistMap}
          setPreviewImage={setPreviewImage}
          type="library"
          isCommander={isCommander}
        />

        <div
          className={`mt-2 flex flex-wrap justify-between items-center gap-2 p-3 rounded-lg border ${
            isCommander
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/70'
              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {isCommander && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400 text-slate-950">
                👑 Commander
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              {ownership.text}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isCommanderFormat && typeof handleSetCommanderCard === 'function' && (
              <button
                type="button"
                onClick={() => handleSetCommanderCard(card, activeDeck.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border cursor-pointer transition-colors ${
                  isCommander
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-400/60 hover:bg-amber-200 dark:hover:bg-amber-900'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                }`}
              >
                {isCommander ? '★ Unset Commander' : '👑 Set Commander'}
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">In Deck:</span>
              <button
                type="button"
                onClick={() => handleUpdateDeckCard(card, -1, cardBoard, activeDeck.id)}
                className="w-7 h-7 bg-white dark:bg-slate-700 rounded font-bold text-sm border border-slate-300 dark:border-slate-600 cursor-pointer"
              >
                -
              </button>
              <span className="w-5 text-center font-bold text-sm">{card.quantity}</span>
              <button
                type="button"
                onClick={() => handleUpdateDeckCard(card, 1, cardBoard, activeDeck.id)}
                className="w-7 h-7 bg-blue-600 text-white rounded font-bold text-sm cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="font-semibold text-sm shrink-0">Active Deck:</label>
          <select
            value={activeDeck?.id || ''}
            onChange={(e) => {
              const selected = safeDecks.find((d) => String(d.id) === String(e.target.value));
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
            if (!newDeckName.trim()) return;
            handleCreateDeck(newDeckName.trim(), deckFormat);
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold">{activeDeck.name}</h2>
                {isCommanderFormat && (
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    👑 Commander Deck
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Format: <span className="capitalize font-medium">{activeDeck.format || 'commander'}</span> | Total Cards:{' '}
                <span className="font-bold">{totalDeckCards}</span>
                {isCommanderFormat && (
                  <>
                    {' '}
                    | Commander:{' '}
                    <span className="font-semibold text-amber-400">
                      {commanderCards.length > 0
                        ? commanderCards.map((c) => c.name || c.card_name).join(' & ')
                        : 'Not designated yet'}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {typeof setShowExportModal === 'function' && (
                <button
                  type="button"
                  onClick={() => setShowExportModal('deck')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  📥 Export Deck
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExportMissingToWishlist(libraryMap, fetchWishlist)}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                ✨ Wishlist Missing Cards
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDeck(activeDeck.id)}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Delete Deck
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading deck cards...</div>
          ) : safeDeckCards.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No cards in this deck yet. Use Search or My Library to add cards to this deck!
            </div>
          ) : (
            <div className="space-y-6">
              {isCommanderFormat && (
                <div className="rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-transparent p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-lg text-amber-300 flex items-center gap-2">
                      <span>👑</span>
                      <span>Commander Spotlight</span>
                    </h3>
                    <span className="text-xs font-medium text-amber-200/80">
                      {commanderCards.length > 0
                        ? `${commanderCards.length} Designated`
                        : 'Click "Set Commander" on a card below to highlight it'}
                    </span>
                  </div>

                  {commanderCards.length > 0 ? (
                    <div className="space-y-4">
                      {commanderCards.map((card) => renderDeckCardRow(card, true))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      No commander is currently highlighted for this deck. Use the{' '}
                      <strong className="text-amber-300">Set Commander</strong> button on any card in
                      your deck list to pin and highlight it here.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-bold text-lg">
                  {isCommanderFormat
                    ? `Deck List (${mainDeckCards.length} Cards)`
                    : `Deck List (${safeDeckCards.length} Cards)`}
                </h3>
                {mainDeckCards.map((card) => renderDeckCardRow(card, false))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          Select a deck from the top dropdown or create a new one to begin building.
        </div>
      )}
    </div>
  );
}