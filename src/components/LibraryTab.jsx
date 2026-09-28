import React, { useState, useEffect, useMemo } from 'react';
import CardItem from './CardItem';
import { normalizeTags } from '../utils/tagUtils';
import { fetchScryfallDetailsChunked } from '../services/scryfall';

const COLOR_OPTIONS = [
  { code: 'W', name: 'White', bg: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  { code: 'U', name: 'Blue', bg: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200' },
  { code: 'B', name: 'Black', bg: 'bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-200' },
  { code: 'R', name: 'Red', bg: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200' },
  { code: 'G', name: 'Green', bg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' },
  { code: 'C', name: 'Colorless', bg: 'bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-200' },
];

const CARD_TYPES = ['ALL', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land'];
const RARITIES = ['ALL', 'common', 'uncommon', 'rare', 'mythic'];

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
}) {
  // Search, Tag, and Sort States
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');
  const [librarySort, setLibrarySort] = useState('name');
  
  // Dedicated MTG Property Filters State
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedRarity, setSelectedRarity] = useState('ALL');
  const [minCmc, setMinCmc] = useState('');
  const [maxCmc, setMaxCmc] = useState('');

  // Pagination & Dropdown States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [tagInputs, setTagInputs] = useState({});
  const [activeTagDropdown, setActiveTagDropdown] = useState(null);

  // Reset tag filter if tag disappears from collection
  useEffect(() => {
    if (selectedTagFilter !== 'ALL' && !availableTags.includes(selectedTagFilter)) {
      setSelectedTagFilter('ALL');
    }
  }, [availableTags, selectedTagFilter]);

  // Reset pagination on filter or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    librarySearch,
    selectedTagFilter,
    librarySort,
    itemsPerPage,
    selectedColors,
    selectedType,
    selectedRarity,
    minCmc,
    maxCmc,
  ]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tag-dropdown-container')) {
        setActiveTagDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColor = (code) => {
    setSelectedColors((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleResetFilters = () => {
    setLibrarySearch('');
    setSelectedTagFilter('ALL');
    setLibrarySort('name');
    setSelectedColors([]);
    setSelectedType('ALL');
    setSelectedRarity('ALL');
    setMinCmc('');
    setMaxCmc('');
  };

  const filteredLibrary = useMemo(() => {
    return libraryList.filter((card) => {
      const tags = normalizeTags(card.tags);

      // Tag Filter
      if (selectedTagFilter !== 'ALL' && !tags.includes(selectedTagFilter)) {
        return false;
      }

      // General Text Search (Name, Set, Tags)
      if (librarySearch.trim()) {
        const term = librarySearch.toLowerCase();
        const nameMatch = card.card_name?.toLowerCase().includes(term);
        const setMatch = card.set_name?.toLowerCase().includes(term);
        const tagMatch = tags.some((t) => t.includes(term));
        if (!nameMatch && !setMatch && !tagMatch) return false;
      }

      // Type Line Filter (if card has type_line populated)
      if (selectedType !== 'ALL') {
        if (card.type_line && !card.type_line.toLowerCase().includes(selectedType.toLowerCase())) {
          return false;
        }
      }

      // Rarity Filter
      if (selectedRarity !== 'ALL') {
        if (card.rarity && card.rarity.toLowerCase() !== selectedRarity.toLowerCase()) {
          return false;
        }
      }

      // Mana Cost (CMC) Filter
      if (card.cmc !== undefined && card.cmc !== null) {
        if (minCmc !== '' && card.cmc < parseFloat(minCmc)) return false;
        if (maxCmc !== '' && card.cmc > parseFloat(maxCmc)) return false;
      }

      // Color Filter (Matches if card contains all selected colors)
      if (selectedColors.length > 0) {
        const cardColors = card.colors || card.color_identity || [];
        if (selectedColors.includes('C')) {
          if (cardColors.length > 0) return false;
        } else {
          const hasAllSelected = selectedColors.every((c) => cardColors.includes(c));
          if (!hasAllSelected) return false;
        }
      }

      return true;
    });
  }, [
    libraryList,
    selectedTagFilter,
    librarySearch,
    selectedType,
    selectedRarity,
    minCmc,
    maxCmc,
    selectedColors,
  ]);

  const sortedLibrary = useMemo(() => {
    return [...filteredLibrary].sort((a, b) => {
      if (librarySort === 'name') {
        return (a.card_name || '').localeCompare(b.card_name || '');
      } else if (librarySort === 'set') {
        return (a.set_name || '').localeCompare(b.set_name || '');
      } else if (librarySort === 'quantity') {
        const totalA = (a.reg_quantity || 0) + (a.foil_quantity || 0);
        const totalB = (b.reg_quantity || 0) + (b.foil_quantity || 0);
        return totalB - totalA;
      } else if (librarySort === 'cmc') {
        return (a.cmc || 0) - (b.cmc || 0);
      }
      return 0;
    });
  }, [filteredLibrary, librarySort]);

  const totalPages = Math.ceil(sortedLibrary.length / itemsPerPage);
  const paginatedLibrary = sortedLibrary.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExecuteExport = async () => {
    const cardsToExport = sortedLibrary;

    if (cardsToExport.length === 0) {
      alert('No library cards available to export!');
      return;
    }

    setExporting(true);
    setExportProgress(0);

    try {
      const scryfallMap = await fetchScryfallDetailsChunked(cardsToExport, setExportProgress);

      const exportedData = cardsToExport.map((item) => {
        const scryfallObj = scryfallMap[String(item.scryfall_id).toLowerCase()] || {};
        const record = {};

        selectedFields.forEach((fieldKey) => {
          switch (fieldKey) {
            case 'card_name':
              record['Title'] = item.card_name || scryfallObj.name || '';
              break;
            case 'set_name':
              record['Edition'] = item.set_name || scryfallObj.set_name || '';
              break;
            case 'reg_quantity':
              record['Regular Qty'] = item.reg_quantity || 0;
              break;
            case 'foil_quantity':
              record['Foil Qty'] = item.foil_quantity || 0;
              break;
            case 'scryfall_id':
              record['Scryfall ID'] = item.scryfall_id || scryfallObj.id || '';
              break;
            case 'mana_cost':
              record['Mana Cost'] = scryfallObj.mana_cost || '';
              break;
            case 'type_line':
              record['Type Line'] = scryfallObj.type_line || '';
              break;
            case 'oracle_text':
              record['Oracle Text'] = scryfallObj.oracle_text || '';
              break;
            case 'rarity':
              record['Rarity'] = scryfallObj.rarity || '';
              break;
            case 'cmc':
              record['CMC'] = scryfallObj.cmc ?? '';
              break;
            case 'colors':
              record['Colors'] = (scryfallObj.colors || []).join(', ');
              break;
            case 'price_usd':
              record['Price USD'] = scryfallObj.prices?.usd || '';
              break;
            case 'price_usd_foil':
              record['Price Foil USD'] = scryfallObj.prices?.usd_foil || '';
              break;
            case 'tags':
              record['Tags'] = (item.tags || []).join(', ');
              break;
            default:
              break;
          }
        });

        return record;
      });

      if (exportFormat === 'json') {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportedData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', 'mtg_library.json');
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } else if (exportFormat === 'csv') {
        const headers = Object.keys(exportedData[0] || {});
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of exportedData) {
          const values = headers.map((header) => {
            const val = row[header] ?? '';
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'mtg_library.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (exportFormat === 'pdf') {
        const headers = Object.keys(exportedData[0] || {});
        const printWindow = window.open('', '_blank');

        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>MTG Collection Export</title>
              <style>
                body { font-family: sans-serif; padding: 20px; color: #333; }
                h1 { font-size: 20px; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                tr:nth-child(even) { background-color: #fafafa; }
              </style>
            </head>
            <body>
              <h1>MTG Personal Library</h1>
              <table>
                <thead>
                  <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${exportedData
                    .map(
                      (row) =>
                        `<tr>${headers.map((h) => `<td>${row[h]}</td>`).join('')}</tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </body>
          </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }

      setShowExportModal(false);
    } catch (err) {
      console.error('Export Error:', err);
      alert('An error occurred while generating the export.');
    } finally {
      setExporting(false);
    }
  };

  LibraryTab.handleExecuteExport = handleExecuteExport;

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
      {/* Top Search & Primary Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-4">
        <div className="flex flex-1 flex-wrap sm:flex-nowrap gap-3">
          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search library by name, set, or tag..."
            className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />

          <select
            value={selectedTagFilter}
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
          >
            <option value="ALL">All Tags</option>
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
            <option value="cmc">Sort: Mana Value (CMC)</option>
          </select>
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2 shrink-0"
        >
          📥 Export Library
        </button>
      </div>

      {/* Advanced MTG Filtering Controls */}
      <div className="p-4 mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Card Filters
          </span>
          <button
            onClick={handleResetFilters}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Color Badges */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Color / Identity
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((c) => {
                const active = selectedColors.includes(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={() => toggleColor(c.code)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                      active
                        ? `${c.bg} border-blue-500 ring-2 ring-blue-400/50`
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {c.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Card Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-2 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs cursor-pointer"
            >
              {CARD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Rarity Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Rarity
            </label>
            <select
              value={selectedRarity}
              onChange={(e) => setSelectedRarity(e.target.value)}
              className="w-full p-2 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs cursor-pointer capitalize"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Mana Cost Range */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Mana Value (CMC) Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minCmc}
                onChange={(e) => setMinCmc(e.target.value)}
                className="w-full p-2 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxCmc}
                onChange={(e) => setMaxCmc(e.target.value)}
                className="w-full p-2 border rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {sortedLibrary.length > 0 && renderPaginationControls()}

      <div className="space-y-6">
        {sortedLibrary.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No cards found matching your selected filters.
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
              />
            );
          })
        )}
      </div>

      {sortedLibrary.length > 0 && renderPaginationControls()}
    </div>
  );
}