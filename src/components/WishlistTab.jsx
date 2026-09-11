import React, { useState } from 'react';
import CardItem from './CardItem';

export default function WishlistTab({
  wishlistList,
  libraryMap,
  wishlistMap,
  handleToggleWishlist,
  handleUpdateWishlistQty,
  setPreviewImage,
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
    }
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
        </select>
      </div>

      <div className="space-y-6">
        {sortedWishlist.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Your wishlist is empty.</div>
        ) : (
          sortedWishlist.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              type="wishlist"
              libraryMap={libraryMap}
              wishlistMap={wishlistMap}
              setPreviewImage={setPreviewImage}
              handleToggleWishlist={handleToggleWishlist}
              handleUpdateWishlistQty={handleUpdateWishlistQty}
            />
          ))
        )}
      </div>
    </div>
  );
}