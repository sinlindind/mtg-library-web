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

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title matching production screenshot */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">MTG Personal Library</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {/* Navigation Tabs matching production styling */}
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

        {/* Active Tab Content Area */}
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
    </div>
  );
}