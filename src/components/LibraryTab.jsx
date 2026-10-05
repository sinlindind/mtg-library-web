import React, { useState, useEffect } from 'react';
import CardItem from './CardItem';
import { normalizeTags } from '../utils/tagUtils';
import { fetchScryfallDetailsChunked } from '../services/scryfall';

export default function LibraryTab({
  libraryList,
  libraryMap,
  wishlistMap,
  availableTags,
  handleUpdateQuantity,
  handleToggleWishlist,
  handleAddTag,
  handleRemoveTag,
  handleToggleTagCheck,
  setPreviewImage,
  setShowExportModal,
  selectedFields,
  exportFormat,
  setExporting,
  setExportProgress,
  decks,
  activeDeck,
  handleUpdateDeckCard,
}) {
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');
  const [librarySort, setLibrarySort] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [tagInputs, setTagInputs] = useState({});
  const [activeTagDropdown, setActiveTagDropdown] = useState(null);

  useEffect(() => {
    if (
      selectedTagFilter !== 'ALL' &&
      !availableTags.includes(selectedTagFilter)
    ) {
      setSelectedTagFilter('ALL');
    }
  }, [availableTags, selectedTagFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [librarySearch, selectedTagFilter, librarySort, itemsPerPage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tag-dropdown-container')) {
        setActiveTagDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLibrary = libraryList.filter((card) => {
    const tags = normalizeTags(card.tags);

    if (selectedTagFilter !== 'ALL' && !tags.includes(selectedTagFilter)) {
      return false;
    }

    if (!librarySearch.trim()) return true;
    const term = librarySearch.toLowerCase();
    const nameMatch = card.card_name?.toLowerCase().includes(term);
    const setMatch = card.set_name?.toLowerCase().includes(term);
    const tagMatch = tags.some((t) => t.includes(term));
    return nameMatch || setMatch || tagMatch;
  });

  const sortedLibrary = [...filteredLibrary].sort((a, b) => {
    if (librarySort === 'name') {
      return (a.card_name || '').localeCompare(b.card_name || '');
    } else if (librarySort === 'set') {
      return (a.set_name || '').localeCompare(b.set_name || '');
    } else if (librarySort === 'quantity') {
      const totalA = (a.reg_quantity || 0) + (a.foil_quantity || 0);
      const totalB = (b.reg_quantity || 0) + (b.foil_quantity || 0);
      return totalB - totalA;
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedLibrary.length / itemsPerPage);
  const paginatedLibrary = sortedLibrary.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderPaginationControls = () => (
    <div className="flex flex-wrap justify-between items-center gap-4 my-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          Per page:
        </span>
        <select
          value={itemsPerPage}
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className="p-1.5 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 cursor-pointer text-sm font-semibold"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 cursor-pointer text-sm font-semibold"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-2">
        <div className="flex flex-1 flex-wrap sm:flex-nowrap gap-3">
          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Filter library..."
            className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />

          <select
            value={selectedTagFilter}
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
          >
            <option value="ALL">Full Library (All Tags)</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                🏷️ {tag}
              </option>
            ))}
          </select>

          <select
            value={librarySort}
            onChange={(e) => setLibrarySort(e.target.value)}
            className="p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
          >
            <option value="name">Sort: Name</option>
            <option value="set">Sort: Set</option>
            <option value="quantity">Sort: Quantity</option>
          </select>
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          📥 Export Library
        </button>
      </div>

      {sortedLibrary.length > 0 && renderPaginationControls()}

      <div className="space-y-6">
        {sortedLibrary.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No cards found in your collection.
          </div>
        ) : (
          paginatedLibrary.map((card) => {
            const scryfallId = String(card.scryfall_id).trim().toLowerCase();
            const currentTags = normalizeTags(card.tags);
            const isDropdownOpen = activeTagDropdown === scryfallId;

            return (
              <CardItem
                key={card.id}
                card={card}
                type="library"
                libraryMap={libraryMap}
                wishlistMap={wishlistMap}
                setPreviewImage={setPreviewImage}
                handleToggleWishlist={handleToggleWishlist}
                handleUpdateQuantity={handleUpdateQuantity}
                currentTags={currentTags}
                availableTags={availableTags}
                isDropdownOpen={isDropdownOpen}
                setActiveTagDropdown={setActiveTagDropdown}
                handleRemoveTag={handleRemoveTag}
                handleToggleTagCheck={handleToggleTagCheck}
                handleAddTag={(c, t) => handleAddTag(c, t, setTagInputs)}
                tagInputVal={tagInputs[scryfallId] || ''}
                setTagInputVal={(val) =>
                  setTagInputs((prev) => ({ ...prev, [scryfallId]: val }))
                }
                decks={decks}
                activeDeck={activeDeck}
                handleUpdateDeckCard={handleUpdateDeckCard}
              />
            );
          })
        )}
      </div>

      {sortedLibrary.length > 0 && renderPaginationControls()}
    </div>
  );
}