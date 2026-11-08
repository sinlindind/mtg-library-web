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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <h1 className="text-2xl font-black">MTG Card Library & Deck Builder</h1>
          <div className="flex gap-2">
            {['search', 'library', 'decks', 'wishlist'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize cursor-pointer transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-3 py-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
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
  );
}