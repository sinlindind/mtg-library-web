import React, { useState } from 'react';

export default function CardItem({
  card,
  type = 'search',
  libraryMap = {},
  wishlistMap = {},
  availableTags = [],
  setPreviewImage,
  handleToggleWishlist,
  handleUpdateQuantity,
  handleAddTag,
  handleRemoveTag,
  handleToggleTagCheck,
  handleUpdateWishlistQty,
}) {
  const [newTagInput, setNewTagInput] = useState('');

  // Look up current library/wishlist status from maps
  const libraryData = libraryMap[card.id] || {};
  const wishlistData = wishlistMap[card.id] || {};

  const qtyReg = libraryData.qty_regular || 0;
  const qtyFoil = libraryData.qty_foil || 0;
  const cardTags = libraryData.tags || [];
  const totalQty = qtyReg + qtyFoil;

  const inWishlist = Boolean(wishlistData.id || wishlistMap[card.id]);
  const wishlistQty = wishlistData.requested_qty || 1;

  // Extract display information safely
  const imageUri =
    card.image_uris?.normal ||
    card.card_faces?.[0]?.image_uris?.normal ||
    'https://via.placeholder.com/250x350?text=No+Image';

  const priceUsd = card.prices?.usd ? `$${card.prices.usd}` : 'N/A';
  const priceFoil = card.prices?.usd_foil ? `$${card.prices.usd_foil}` : 'N/A';

  const onAddCustomTag = (e) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    if (handleAddTag) {
      handleAddTag(card.id, newTagInput.trim());
    }
    setNewTagInput('');
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm hover:shadow-md transition-shadow">
      {/* Card Image */}
      <div className="shrink-0 flex justify-center sm:justify-start">
        <img
          src={imageUri}
          alt={card.name}
          onClick={() => setPreviewImage && setPreviewImage(imageUri)}
          className="w-32 h-44 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        />
      </div>

      {/* Main Card Info */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
              {card.name}
            </h3>
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {card.set_name || card.set}
            </span>
          </div>

          <div className="flex gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span>Reg: {priceUsd}</span>
            <span>Foil: {priceFoil}</span>
          </div>
        </div>

        {/* Wishlist Toggle Button */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => handleToggleWishlist && handleToggleWishlist(card)}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
              inWishlist
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'
            }`}
          >
            {inWishlist ? '★ In Wishlist' : '☆ Add to Wishlist'}
          </button>

          {type === 'wishlist' && handleUpdateWishlistQty && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500">Wanted:</span>
              <button
                onClick={() => handleUpdateWishlistQty(card.id, wishlistQty - 1)}
                className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded"
              >
                -
              </button>
              <span className="font-bold px-1">{wishlistQty}</span>
              <button
                onClick={() => handleUpdateWishlistQty(card.id, wishlistQty + 1)}
                className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Tag Management Section - Displays whenever total quantity > 0 */}
        {totalQty > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Tags:
            </div>

            {/* Existing Active Tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {cardTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag && handleRemoveTag(card.id, tag)}
                    className="hover:text-red-500 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
              {cardTags.length === 0 && (
                <span className="text-xs text-slate-400 italic">No tags assigned</span>
              )}
            </div>

            {/* Checkbox Quick-Selection for Available Tags */}
            {availableTags && availableTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {availableTags.map((tag) => {
                  const isChecked = cardTags.includes(tag);
                  return (
                    <label
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          handleToggleTagCheck && handleToggleTagCheck(card.id, tag)
                        }
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                      />
                      {tag}
                    </label>
                  );
                })}
              </div>
            )}

            {/* Custom Tag Input */}
            <form onSubmit={onAddCustomTag} className="flex gap-2">
              <input
                type="text"
                placeholder="Add new tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                className="px-2 py-1 text-xs border rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex-1 max-w-[160px]"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded cursor-pointer"
              >
                Add Tag
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Quantity Adjusters */}
      <div className="flex sm:flex-col justify-between sm:justify-center items-end gap-3 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 sm:pl-4 min-w-[120px]">
        {/* Regular Quantity */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Reg:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                handleUpdateQuantity &&
                handleUpdateQuantity(card, 'qty_regular', Math.max(0, qtyReg - 1))
              }
              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded cursor-pointer font-bold text-xs"
            >
              -
            </button>
            <span className="w-5 text-center font-semibold text-sm">{qtyReg}</span>
            <button
              onClick={() =>
                handleUpdateQuantity &&
                handleUpdateQuantity(card, 'qty_regular', qtyReg + 1)
              }
              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded cursor-pointer font-bold text-xs"
            >
              +
            </button>
          </div>
        </div>

        {/* Foil Quantity */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Foil:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                handleUpdateQuantity &&
                handleUpdateQuantity(card, 'qty_foil', Math.max(0, qtyFoil - 1))
              }
              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded cursor-pointer font-bold text-xs"
            >
              -
            </button>
            <span className="w-5 text-center font-semibold text-sm">{qtyFoil}</span>
            <button
              onClick={() =>
                handleUpdateQuantity &&
                handleUpdateQuantity(card, 'qty_foil', qtyFoil + 1)
              }
              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded cursor-pointer font-bold text-xs"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}