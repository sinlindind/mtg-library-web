import React, { useState } from 'react';
import CardItem from './CardItem';

export default function WishlistTab({
  wishlistList,
  libraryMap,
  wishlistMap,
  handleToggleWishlist,
  handleUpdateWishlistQty,
  setPreviewImage,
  decks = [],
  activeDeck = null,
  handleUpdateDeckCard,
  cardDecksMap = {},
  availableTags = [],
  setActiveTagDropdown,
  activeTagDropdown,
  handleRemoveTag,
  handleToggleTagCheck,
  handleAddTag,
  tagInputVal = '',
  setTagInputVal,
}) {
  const [wishlistSearch, setWishlistSearch] = useState('');
  const [wishlistSort, setWishlistSort] = useState('name');

  const filteredWishlist = wishlistList.filter(
    (card) =>
      card.card_name?.toLowerCase().includes(wishlistSearch.toLowerCase()) ||
      card.set_name?.toLowerCase().includes(wishlistSearch.toLowerCase())
  );

  const sortedWishlist = [...filteredWishlist].sort((a, b) => {
    if (wishlistSort === 'name') {
      return (a.card_name || '').localeCompare(b.card_name || '');
    } else if (wishlistSort === 'set') {
      return (a.set_name || '').localeCompare(b.set_name || '');
    } else if (wishlistSort === 'quantity') {
      return (b.desired_quantity || 0) - (a.desired_quantity || 0);
    } else if (wishlistSort === 'price-high') {
      const priceA = parseFloat(a.prices?.usd || a.usd || 0);
      const priceB = parseFloat(b.prices?.usd || b.usd || 0);
      return priceB - priceA;
    } else if (wishlistSort === 'price-low') {
      const priceA = parseFloat(a.prices?.usd || a.usd || 0);
      const priceB = parseFloat(b.prices?.usd || b.usd || 0);
      return priceA - priceB;
    }
    return 0;
  });

  // Calculate total estimated cost of the filtered wishlist
  const totalWishlistCost = filteredWishlist.reduce((sum, card) => {
    const price = parseFloat(card.prices?.usd || card.usd || 0);
    const qty = card.desired_quantity || 1;
    return sum + price * qty;
  }, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">
        <div className="flex flex-1 gap-3">
          <input
            type="text"
            value={wishlistSearch}
            onChange={(e) => setWishlistSearch(e.target.value)}
            placeholder="Search wishlist..."
            className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />

          <select
            value={wishlistSort}
            onChange={(e) => setWishlistSort(e.target.value)}
            className="p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
          >
            <option value="name">Sort: Name</option>
            <option value="set">Sort: Set</option>
            <option value="quantity">Sort: Desired Quantity</option>
            <option value="price-high">Sort: Price (High to Low)</option>
            <option value="price-low">Sort: Price (Low to High)</option>
          </select>
        </div>

        <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold flex items-center justify-between sm:justify-center gap-2">
          <span className="text-slate-500">Total Est:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            ${totalWishlistCost.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {sortedWishlist.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Your wishlist is empty.</div>
        ) : (
          sortedWishlist.map((card) => {
            const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
            return (
              <CardItem
                key={card.id}
                card={card}
                type="wishlist"
                libraryMap={libraryMap}
                wishlistMap={wishlistMap}
                setPreviewImage={setPreviewImage}
                handleToggleWishlist={handleToggleWishlist}
                handleUpdateWishlistQty={handleUpdateWishlistQty}
                decks={decks}
                activeDeck={activeDeck}
                handleUpdateDeckCard={handleUpdateDeckCard}
                cardDecks={cardDecksMap[scryfallId] || []}
                currentTags={card.tags || []}
                availableTags={availableTags}
                isDropdownOpen={activeTagDropdown === scryfallId}
                setActiveTagDropdown={setActiveTagDropdown}
                handleRemoveTag={handleRemoveTag}
                handleToggleTagCheck={handleToggleTagCheck}
                handleAddTag={handleAddTag}
                tagInputVal={tagInputVal}
                setTagInputVal={setTagInputVal}
              />
            );
          })
        )}
      </div>
    </div>
  );
}