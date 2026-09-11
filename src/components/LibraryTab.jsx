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
}) {
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');
  const [librarySort, setLibrarySort] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [tagInputs, setTagInputs] = useState({});
  const [activeTagDropdown, setActiveTagDropdown] = useState(null);

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

  // Expose function for App execution
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
              />
            );
          })
        )}
      </div>

      {sortedLibrary.length > 0 && renderPaginationControls()}
    </div>
  );
}