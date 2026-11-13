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
    reg_quantity: true,
    foil_quantity: true,
    scryfall_id: true,
    tags: true,
    image_url: false,
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

  const handleExecuteExport = () => {
    setExporting(true);
    setExportProgress('Preparing export data...');

    try {
      const activeFields = Object.keys(selectedFields).filter((field) => selectedFields[field]);
      
      if (exportFormat === 'json') {
        const exportData = libraryList.map((item) => {
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

        libraryList.forEach((item) => {
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
                      <span className="capitalize">{field.replace('_', ' ')}</span>
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
                {exporting ? 'Exporting...' : 'Download Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}