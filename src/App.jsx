import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { useDecks } from './hooks/useDecks';
import { useLibrary } from './hooks/useLibrary';
import { useWishlist } from './hooks/useWishlist';
import LibraryTab from './components/LibraryTab';
import SearchTab from './components/SearchTab';
import DecksTab from './components/DecksTab';
import WishlistTab from './components/WishlistTab';
import Login from './components/Login';

const COLOR_NAMES = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

function formatManaColors(colors) {
  if (!colors || colors.length === 0) return 'Colorless';
  if (Array.isArray(colors)) {
    return colors.map((c) => COLOR_NAMES[c] || c).join(', ');
  }
  return String(colors);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [searchResults, setSearchResults] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  // Export Modal & Options State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  const [selectedFields, setSelectedFields] = useState({
    card_name: true,
    set_name: true,
    mana_colors: true,
    type_line: true,
    oracle_text: true,
    reg_quantity: true,
    foil_quantity: true,
    scryfall_id: true,
    tags: true,
  });

  const {
    decks,
    activeDeck,
    setActiveDeck,
    activeDeckCards,
    cardDecksMap,
    fetchDecks,
    fetchDeckCards,
    handleCreateDeck,
    handleDeleteDeck,
    handleUpdateDeckCard,
    handleExportMissingToWishlist,
  } = useDecks(session);

  const {
    libraryMap,
    libraryList,
    fetchLibrary,
    availableTags,
    handleUpdateQuantity,
    handleAddTag,
    handleRemoveTag,
    handleToggleTagCheck,
  } = useLibrary(session);

  const {
    wishlistMap,
    wishlistList,
    fetchWishlist,
    handleToggleWishlist,
    handleUpdateWishlistQty,
  } = useWishlist(session);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchLibrary(session.user.id);
      fetchWishlist(session.user.id);
      fetchDecks();
    }
  }, [session, fetchLibrary, fetchWishlist, fetchDecks]);

  // Enriches library items with Scryfall metadata (mana colors, oracle text, type line) if not already on the record
  const enrichCardsWithScryfallData = async (cards) => {
    const needsEnrichment = cards.filter(
      (c) =>
        c.scryfall_id &&
        (c.oracle_text === undefined || c.colors === undefined || c.type_line === undefined)
    );

    if (needsEnrichment.length === 0) {
      return cards.map((c) => ({
        ...c,
        mana_colors: formatManaColors(c.colors || c.color_identity),
        oracle_text: c.oracle_text || '',
        type_line: c.type_line || '',
      }));
    }

    const scryfallMap = {};
    const chunkSize = 75; // Scryfall /cards/collection max batch size

    for (let i = 0; i < needsEnrichment.length; i += chunkSize) {
      const batch = needsEnrichment.slice(i, i + chunkSize);
      setExportProgress(
        `Fetching card text & mana colors from Scryfall (${Math.min(
          i + chunkSize,
          needsEnrichment.length
        )}/${needsEnrichment.length})...`
      );

      try {
        const identifiers = batch.map((c) => ({ id: c.scryfall_id }));
        const response = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers }),
        });

        if (response.ok) {
          const data = await response.json();
          (data.data || []).forEach((scryCard) => {
            // Handle double-faced cards cleanly
            const combinedOracleText = scryCard.card_faces
              ? scryCard.card_faces
                  .map((f) => `${f.name}: ${f.oracle_text || ''}`)
                  .join(' // ')
              : scryCard.oracle_text || '';

            const colors =
              scryCard.colors ||
              (scryCard.card_faces ? scryCard.card_faces[0]?.colors : null) ||
              scryCard.color_identity ||
              [];

            scryfallMap[scryCard.id.toLowerCase()] = {
              mana_colors: formatManaColors(colors),
              oracle_text: combinedOracleText,
              type_line: scryCard.type_line || '',
            };
          });
        }
      } catch (err) {
        console.warn('Scryfall batch enrichment warning:', err);
      }
    }

    return cards.map((card) => {
      const id = String(card.scryfall_id || '').toLowerCase();
      const enriched = scryfallMap[id] || {};
      return {
        ...card,
        mana_colors:
          enriched.mana_colors ?? formatManaColors(card.colors || card.color_identity),
        oracle_text: enriched.oracle_text ?? card.oracle_text ?? '',
        type_line: enriched.type_line ?? card.type_line ?? '',
      };
    });
  };

  const generatePdfExport = (enrichedList, activeFields) => {
    const printWindow = window.open('', '_blank', 'width=960,height=800');
    if (!printWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups for this site to generate the PDF.');
    }

    const dateStr = new Date().toISOString().slice(0, 10);

    const cardRowsHtml = enrichedList
      .map((item) => {
        const tagsStr = Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '';
        const details = [];

        if (activeFields.includes('set_name') && item.set_name) {
          details.push(`<strong>Set:</strong> ${escapeHtml(item.set_name)}`);
        }
        if (activeFields.includes('mana_colors')) {
          details.push(`<strong>Mana Colors:</strong> ${escapeHtml(item.mana_colors)}`);
        }
        if (activeFields.includes('reg_quantity') || activeFields.includes('foil_quantity')) {
          const reg = activeFields.includes('reg_quantity') ? `Reg: ${item.reg_quantity ?? 0}` : '';
          const foil = activeFields.includes('foil_quantity')
            ? `Foil: ${item.foil_quantity ?? 0}`
            : '';
          details.push(`<strong>Qty:</strong> ${[reg, foil].filter(Boolean).join(' | ')}`);
        }
        if (activeFields.includes('tags') && tagsStr) {
          details.push(`<strong>Tags:</strong> ${escapeHtml(tagsStr)}`);
        }
        if (activeFields.includes('scryfall_id') && item.scryfall_id) {
          details.push(`<strong>Scryfall ID:</strong> <code>${escapeHtml(item.scryfall_id)}</code>`);
        }

        return `
          <div class="card-entry">
            <div class="card-header">
              <span class="card-title">${
                activeFields.includes('card_name') ? escapeHtml(item.card_name) : 'Card Entry'
              }</span>
              ${
                activeFields.includes('type_line') && item.type_line
                  ? `<span class="card-type">${escapeHtml(item.type_line)}</span>`
                  : ''
              }
            </div>
            <div class="card-meta">${details.join(' &nbsp;•&nbsp; ')}</div>
            ${
              activeFields.includes('oracle_text')
                ? `<div class="card-text">${escapeHtml(
                    item.oracle_text || 'No card text / abilities.'
                  ).replace(/\n/g, '<br/>')}</div>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>MTG Library Extract - ${dateStr}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 24px;
              line-height: 1.45;
              font-size: 12px;
            }
            header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
              margin-bottom: 18px;
              display: flex;
              justify-content: space-between;
              align-items: baseline;
            }
            h1 {
              margin: 0;
              font-size: 20px;
            }
            .summary {
              color: #475569;
              font-size: 12px;
            }
            .card-entry {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px 12px;
              margin-bottom: 10px;
              page-break-inside: avoid;
              background-color: #ffffff;
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .card-title {
              font-weight: 700;
              font-size: 14px;
              color: #0f172a;
            }
            .card-type {
              font-style: italic;
              color: #334155;
              font-size: 12px;
            }
            .card-meta {
              color: #334155;
              font-size: 11px;
              margin-bottom: 6px;
            }
            .card-text {
              background-color: #f8fafc;
              border-left: 3px solid #64748b;
              padding: 6px 8px;
              color: #1e293b;
              font-size: 11.5px;
            }
            code {
              font-family: monospace;
              font-size: 10.5px;
            }
            @media print {
              body { margin: 12px; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>MTG Library Extract</h1>
            <div class="summary">Generated: ${dateStr} &nbsp;|&nbsp; Total Cards: ${enrichedList.length}</div>
          </header>
          ${cardRowsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExecuteExport = async () => {
    setExporting(true);
    setExportProgress('Preparing export data...');

    try {
      const activeFields = Object.keys(selectedFields).filter((field) => selectedFields[field]);
      const needsScryfallDetails =
        activeFields.includes('mana_colors') ||
        activeFields.includes('oracle_text') ||
        activeFields.includes('type_line');

      const exportableList = needsScryfallDetails
        ? await enrichCardsWithScryfallData(libraryList)
        : libraryList;

      if (exportFormat === 'pdf') {
        setExportProgress('Opening PDF print preview...');
        generatePdfExport(exportableList, activeFields);
      } else if (exportFormat === 'json') {
        const exportData = exportableList.map((item) => {
          const filteredItem = {};
          activeFields.forEach((field) => {
            filteredItem[field] = item[field];
          });
          return filteredItem;
        });

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mtg-library-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const headers = activeFields;
        const csvRows = [headers.join(',')];

        exportableList.forEach((item) => {
          const row = headers.map((field) => {
            let val = item[field];
            if (Array.isArray(val)) {
              val = val.join('; ');
            }
            const escaped = String(val ?? '').replace(/"/g, '""');
            return `"${escaped}"`;
          });
          csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mtg-library-export-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setExportProgress('Export complete!');
      setTimeout(() => {
        setExporting(false);
        setShowExportModal(false);
        setExportProgress('');
      }, 1000);
    } catch (err) {
      console.error('Export Error:', err);
      alert(`Export failed: ${err.message}`);
      setExporting(false);
      setExportProgress('');
    }
  };

  if (!session) {
    return <Login />;
  }

  const fieldLabels = {
    card_name: 'Card Name',
    set_name: 'Set Name',
    mana_colors: 'Mana Colors',
    type_line: 'Type Line',
    oracle_text: 'Card Text & Abilities',
    reg_quantity: 'Reg Quantity',
    foil_quantity: 'Foil Quantity',
    scryfall_id: 'Scryfall ID',
    tags: 'Tags',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">MTG Personal Library</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        <div className="flex items-center gap-6 border-b border-slate-800 pb-3 text-sm font-medium">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 pb-2 -mb-3 transition-colors cursor-pointer ${
              activeTab === 'search'
                ? 'text-blue-400 border-b-2 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔍 MTG Search
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 pb-2 -mb-3 transition-colors cursor-pointer ${
              activeTab === 'library'
                ? 'text-blue-400 border-b-2 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📚 My Library ({libraryList.length})
          </button>
          <button
            onClick={() => setActiveTab('decks')}
            className={`flex items-center gap-2 pb-2 -mb-3 transition-colors cursor-pointer ${
              activeTab === 'decks'
                ? 'text-blue-400 border-b-2 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🛡️ Decks ({decks.length})
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`flex items-center gap-2 pb-2 -mb-3 transition-colors cursor-pointer ${
              activeTab === 'wishlist'
                ? 'text-blue-400 border-b-2 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ✨ Wishlist ({wishlistList.length})
          </button>
        </div>

        <div className="pt-2">
          {activeTab === 'search' && (
            <SearchTab
              libraryMap={libraryMap}
              wishlistMap={wishlistMap}
              availableTags={availableTags}
              handleUpdateQuantity={handleUpdateQuantity}
              handleToggleWishlist={handleToggleWishlist}
              handleAddTag={handleAddTag}
              handleRemoveTag={handleRemoveTag}
              handleToggleTagCheck={handleToggleTagCheck}
              setPreviewImage={setPreviewImage}
              searchResults={searchResults}
              setSearchResults={setSearchResults}
              decks={decks}
              activeDeck={activeDeck}
              handleUpdateDeckCard={handleUpdateDeckCard}
              cardDecksMap={cardDecksMap}
            />
          )}

          {activeTab === 'library' && (
            <LibraryTab
              libraryList={libraryList}
              libraryMap={libraryMap}
              wishlistMap={wishlistMap}
              availableTags={availableTags}
              handleUpdateQuantity={handleUpdateQuantity}
              handleToggleWishlist={handleToggleWishlist}
              handleAddTag={handleAddTag}
              handleRemoveTag={handleRemoveTag}
              handleToggleTagCheck={handleToggleTagCheck}
              setPreviewImage={setPreviewImage}
              setShowExportModal={setShowExportModal}
              selectedFields={selectedFields}
              exportFormat={exportFormat}
              setExporting={setExporting}
              setExportProgress={setExportProgress}
              decks={decks}
              activeDeck={activeDeck}
              handleUpdateDeckCard={handleUpdateDeckCard}
              cardDecksMap={cardDecksMap}
            />
          )}

          {activeTab === 'decks' && (
            <DecksTab
              decks={decks}
              activeDeck={activeDeck}
              setActiveDeck={setActiveDeck}
              activeDeckCards={activeDeckCards}
              fetchDecks={fetchDecks}
              fetchDeckCards={fetchDeckCards}
              handleCreateDeck={handleCreateDeck}
              handleDeleteDeck={handleDeleteDeck}
              handleUpdateDeckCard={handleUpdateDeckCard}
              handleExportMissingToWishlist={handleExportMissingToWishlist}
              libraryMap={libraryMap}
              wishlistMap={wishlistMap}
              fetchWishlist={fetchWishlist}
              setPreviewImage={setPreviewImage}
            />
          )}

          {activeTab === 'wishlist' && (
            <WishlistTab
              wishlistList={wishlistList}
              libraryMap={libraryMap}
              wishlistMap={wishlistMap}
              handleToggleWishlist={handleToggleWishlist}
              handleUpdateWishlistQty={handleUpdateWishlistQty}
              setPreviewImage={setPreviewImage}
            />
          )}
        </div>
      </div>

      {/* Export Modal Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-5 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold">📥 Export Library Collection</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block font-medium mb-1.5 text-slate-300">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full p-2.5 border rounded-lg border-slate-700 bg-slate-800 text-slate-100"
                >
                  <option value="csv">CSV (Comma Separated Values)</option>
                  <option value="json">JSON (JavaScript Object Notation)</option>
                  <option value="pdf">PDF Extract (Printable Document)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1.5 text-slate-300">Fields to Include</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {Object.keys(selectedFields).map((field) => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedFields[field]}
                        onChange={(e) =>
                          setSelectedFields((prev) => ({ ...prev, [field]: e.target.checked }))
                        }
                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>{fieldLabels[field] || field.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {exporting && (
                <div className="text-center py-2 text-blue-400 font-medium animate-pulse">
                  {exportProgress}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteExport}
                disabled={exporting || libraryList.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm cursor-pointer disabled:opacity-50"
              >
                {exporting
                  ? 'Exporting...'
                  : exportFormat === 'pdf'
                  ? 'Generate PDF'
                  : 'Download Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}