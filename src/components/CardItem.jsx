import React from 'react';

export default function CardItem({
  card,
  type, // 'search' | 'library' | 'wishlist'
  libraryMap = {},
  wishlistMap = {},
  setPreviewImage,
  handleToggleWishlist,
  handleUpdateQuantity,
  handleUpdateWishlistQty,
  // Tag Props
  currentTags = [],
  availableTags = [],
  isDropdownOpen = false,
  setActiveTagDropdown,
  handleRemoveTag,
  handleToggleTagCheck,
  handleAddTag,
  tagInputVal = '',
  setTagInputVal,
}) {
  const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
  const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || card.image_url;
  const highResUrl = card.image_uris?.large || card.image_uris?.png || card.card_faces?.[0]?.image_uris?.large || imgUrl;
  const cardName = card.name || card.card_name;
  
  const owned = libraryMap[scryfallId] || { reg: card.reg_quantity || 0, foil: card.foil_quantity || 0 };
  const totalOwned = owned.reg + owned.foil;
  const isWishlisted = !!wishlistMap[scryfallId];

  return (
    <div className="flex flex-col sm:flex-row gap-6 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-start">
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={cardName}
          onClick={() => setPreviewImage(type === 'search' ? highResUrl : imgUrl)}
          className="w-56 rounded-xl cursor-pointer transition-transform hover:scale-105 hover:shadow-xl shrink-0"
          title="Click to view full resolution"
        />
      ) : (
        <div className="w-56 h-80 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-xs text-slate-400 shrink-0">
          No Image
        </div>
      )}

      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-xl">{cardName}</h3>
          <button
            onClick={() => handleToggleWishlist(card)}
            className="text-2xl transition-transform active:scale-125 cursor-pointer"
            title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          >
            {isWishlisted ? '❤️' : '🤍'}
          </button>
        </div>
        <p className="text-base text-slate-500">{card.set_name}</p>

        {/* Search Context Details */}
        {type === 'search' && totalOwned > 0 && (
          <span className="inline-block bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-800">
            📦 In Library: {totalOwned}x ({owned.reg} Reg | {owned.foil} Foil)
          </span>
        )}

        {/* Tag Section - Displays in library mode or whenever totalOwned > 0 */}
        {(type === 'library' || totalOwned > 0) && (
          <div className="flex flex-wrap gap-2 items-center pt-2">
            {currentTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-full text-xs font-medium"
              >
                🏷️ {tag}
                <button
                  onClick={() => handleRemoveTag(card, tag)}
                  className="text-slate-400 hover:text-red-500 font-bold ml-1 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}

            <div className="relative inline-block tag-dropdown-container">
              <button
                type="button"
                onClick={() => setActiveTagDropdown(isDropdownOpen ? null : scryfallId)}
                className="text-xs px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer font-medium"
              >
                + tag ▾
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 mt-1 z-30 w-56 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl space-y-2">
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                    {availableTags.length === 0 ? (
                      <div className="text-xs text-slate-400 px-1 italic">No existing tags</div>
                    ) : (
                      availableTags.map((tag) => {
                        const checked = currentTags.includes(tag);
                        return (
                          <label
                            key={tag}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-xs cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleTagCheck(card, tag)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate">{tag}</span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="flex gap-1 pt-1">
                    <input
                      type="text"
                      placeholder="New tag..."
                      value={tagInputVal}
                      onChange={(e) => setTagInputVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInputVal.trim()) {
                            handleAddTag(card, tagInputVal.trim());
                            if (setTagInputVal) setTagInputVal('');
                          }
                        }
                      }}
                      className="flex-1 text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tagInputVal.trim()) {
                          handleAddTag(card, tagInputVal.trim());
                          if (setTagInputVal) setTagInputVal('');
                        }
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wishlist Context Status */}
        {type === 'wishlist' && (
          totalOwned > 0 ? (
            <span className="inline-block bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-800">
              📦 In Collection: {totalOwned}x
            </span>
          ) : (
            <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-full text-xs font-medium">
              Not in library
            </span>
          )
        )}
      </div>

      {/* Quantity Controllers */}
      {type !== 'wishlist' ? (
        <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-700/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold ml-1">Reg</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleUpdateQuantity(card, false, -1)}
                disabled={owned.reg === 0}
                className="w-8 h-8 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer shadow-sm"
              >
                -
              </button>
              <span className="w-6 text-center text-sm font-bold">{owned.reg}</span>
              <button
                onClick={() => handleUpdateQuantity(card, false, 1)}
                className="w-8 h-8 bg-blue-600 text-white rounded font-bold cursor-pointer shadow-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">✨ Foil</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleUpdateQuantity(card, true, -1)}
                disabled={owned.foil === 0}
                className="w-8 h-8 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer shadow-sm"
              >
                -
              </button>
              <span className="w-6 text-center text-sm font-bold">{owned.foil}</span>
              <button
                onClick={() => handleUpdateQuantity(card, true, 1)}
                className="w-8 h-8 bg-amber-500 text-white rounded font-bold cursor-pointer shadow-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-pink-50/60 dark:bg-pink-950/30 p-2.5 rounded-lg border border-pink-200 dark:border-pink-900/50 min-w-[150px] w-full sm:w-auto">
          <span className="text-sm font-semibold text-pink-800 dark:text-pink-300 ml-1">Want</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleUpdateWishlistQty(card, -1)}
              className="w-8 h-8 bg-white dark:bg-slate-800 hover:bg-pink-100 dark:hover:bg-pink-900/40 text-pink-800 dark:text-pink-300 rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              -
            </button>
            <span className="w-6 text-center text-sm font-bold text-pink-900 dark:text-pink-200">
              {card.desired_quantity}
            </span>
            <button
              onClick={() => handleUpdateWishlistQty(card, 1)}
              className="w-8 h-8 bg-pink-600 hover:bg-pink-700 text-white rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}