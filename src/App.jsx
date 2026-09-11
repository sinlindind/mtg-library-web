import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import Login from './components/Login.jsx';
import SearchTab from './components/SearchTab.jsx';
import LibraryTab from './components/LibraryTab.jsx';
import WishlistTab from './components/WishlistTab.jsx';
import ExportModal, { AVAILABLE_FIELDS } from './components/ExportModal.jsx';
import { useLibrary } from './hooks/useLibrary.js';
import { useWishlist } from './hooks/useWishlist.js';

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [searchResults, setSearchResults] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  // Custom Hooks
  const {
    libraryMap,
    setLibraryMap,
    libraryList,
    setLibraryList,
    fetchLibrary,
    availableTags,
    handleUpdateQuantity,
    handleAddTag,
    handleRemoveTag,
    handleToggleTagCheck,
  } = useLibrary(session);

  const {
    wishlistMap,
    setWishlistMap,
    wishlistList,
    setWishlistList,
    fetchWishlist,
    handleToggleWishlist,
    handleUpdateWishlistQty,
  } = useWishlist(session);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState(
    AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.key)
  );
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes('JWT')) {
        console.warn('JWT Time Sync Warning:', error.message);
        supabase.auth.refreshSession();
      } else {
        setSession(session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchLibrary(session.user.id);
      fetchWishlist(session.user.id);
    }
  }, [session?.user?.id, fetchLibrary, fetchWishlist]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLibraryMap({});
    setLibraryList([]);
    setWishlistMap({});
    setWishlistList([]);
    setSearchResults([]);
  };

  if (!session) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto p-6 font-sans">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            MTG Personal Library
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
              activeTab === 'search'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🔍 MTG Search
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
              activeTab === 'library'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            📚 My Library ({libraryList.length})
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
              activeTab === 'wishlist'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ✨ Wishlist ({wishlistList.length})
          </button>
        </div>

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

      <ExportModal
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        selectedFields={selectedFields}
        setSelectedFields={setSelectedFields}
        exporting={exporting}
        exportProgress={exportProgress}
        handleExecuteExport={LibraryTab.handleExecuteExport}
      />

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-lg w-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white text-3xl font-bold hover:text-red-400 cursor-pointer"
            >
              ✕
            </button>
            <img
              src={previewImage}
              alt="Full Preview"
              className="w-full h-auto rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            />
          </div>
        </div>
      )}
    </div>
  );
}