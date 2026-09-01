import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'library' | 'wishlist'
  
  // Search View State
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const isSearchingRef = useRef(false);

  // Library & Wishlist Data State
  const [libraryMap, setLibraryMap] = useState({});
  const [libraryList, setLibraryList] = useState([]);
  const [wishlistMap, setWishlistMap] = useState({});
  const [wishlistList, setWishlistList] = useState([]);
  
  // Filters & Inputs
  const [librarySearch, setLibrarySearch] = useState('');
  const [wishlistSearch, setWishlistSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [tagInputs, setTagInputs] = useState({});

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
    }
  }, [session]);

  useEffect(() => {
    const fetchAutocomplete = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setSelectedIndex(-1);
        return;
      }

      if (isSearchingRef.current) {
        isSearchingRef.current = false;
        return;
      }

      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query.trim())}`
        );
        const json = await res.json();
        
        if (!isSearchingRef.current) {
          setSuggestions(json.data || []);
          setShowDropdown(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    };

    const timer = setTimeout(fetchAutocomplete, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLibrary = async (userId) => {
    const { data, error } = await supabase
      .from('user_cards')
      .select('id, scryfall_id, card_name, set_name, image_url, reg_quantity, foil_quantity, tags')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching library:', error);
      return;
    }

    const qtyMap = {};
    (data || []).forEach((item) => {
      const cleanSid = String(item.scryfall_id || '').trim().toLowerCase();
      if (cleanSid) {
        qtyMap[cleanSid] = {
          reg: item.reg_quantity || 0,
          foil: item.foil_quantity || 0,
          tags: item.tags || [],
        };
      }
    });

    setLibraryMap(qtyMap);
    setLibraryList(data || []);
  };

  const fetchWishlist = async (userId) => {
    const { data, error } = await supabase
      .from('user_wishlist')
      .select('id, scryfall_id, card_name, set_name, image_url, desired_quantity')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching wishlist:', error);
      return;
    }

    const map = {};
    (data || []).forEach((item) => {
      const cleanSid = String(item.scryfall_id || '').trim().toLowerCase();
      if (cleanSid) {
        map[cleanSid] = item.desired_quantity || 1;
      }
    });

    setWishlistMap(map);
    setWishlistList(data || []);
  };

  const executeSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    
    isSearchingRef.current = true;
    setShowDropdown(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    setLoading(true);

    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?unique=prints&q=!%22${encodeURIComponent(searchQuery.trim())}%22`
      );
      const json = await res.json();
      setSearchResults(json.data || []);
    } catch (err) {
      console.error('Scryfall API search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (card, isFoil, delta) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.id || card.scryfall_id).trim().toLowerCase();
    const current = libraryMap[scryfallId] || { reg: 0, foil: 0, tags: [] };
    const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || card.image_url;

    const newReg = isFoil ? current.reg : Math.max(0, current.reg + delta);
    const newFoil = isFoil ? Math.max(0, current.foil + delta) : current.foil;

    if (newReg === 0 && newFoil === 0) {
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', session.user.id)
        .eq('scryfall_id', card.id || card.scryfall_id);

      if (error) {
        alert(`Delete Error: ${error.message}`);
        return;
      }

      await fetchLibrary(session.user.id);
      return;
    }

    const { error } = await supabase
      .from('user_cards')
      .upsert(
        {
          user_id: session.user.id,
          scryfall_id: card.id || card.scryfall_id,
          card_name: card.name || card.card_name,
          set_name: card.set_name,
          image_url: imgUrl,
          reg_quantity: newReg,
          foil_quantity: newFoil,
          tags: current.tags || [],
        },
        { onConflict: 'user_id, scryfall_id' }
      );

    if (error) {
      alert(`Upsert Error: ${error.message}`);
    } else {
      await fetchLibrary(session.user.id);
    }
  };

  const handleToggleWishlist = async (card) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.id || card.scryfall_id).trim().toLowerCase();
    const isWishlisted = !!wishlistMap[scryfallId];

    if (isWishlisted) {
      const { error } = await supabase
        .from('user_wishlist')
        .delete()
        .eq('user_id', session.user.id)
        .eq('scryfall_id', card.id || card.scryfall_id);

      if (error) alert(`Wishlist Delete Error: ${error.message}`);
    } else {
      const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || card.image_url;
      const { error } = await supabase
        .from('user_wishlist')
        .upsert(
          {
            user_id: session.user.id,
            scryfall_id: card.id || card.scryfall_id,
            card_name: card.name || card.card_name,
            set_name: card.set_name,
            image_url: imgUrl,
            desired_quantity: 1,
          },
          { onConflict: 'user_id, scryfall_id' }
        );

      if (error) alert(`Wishlist Error: ${error.message}`);
    }

    await fetchWishlist(session.user.id);
  };

  const handleUpdateWishlistQty = async (card, delta) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const currentQty = wishlistMap[scryfallId] || 1;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      await handleToggleWishlist(card);
      return;
    }

    const { error } = await supabase
      .from('user_wishlist')
      .update({ desired_quantity: newQty })
      .eq('user_id', session.user.id)
      .eq('scryfall_id', card.scryfall_id || card.id);

    if (error) {
      alert(`Wishlist Qty Error: ${error.message}`);
    } else {
      await fetchWishlist(session.user.id);
    }
  };

  const handleAddTag = async (card, tagToAdd) => {
    const tag = tagToAdd.trim().toLowerCase();
    if (!tag || !session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const currentTags = libraryMap[scryfallId]?.tags || [];

    if (currentTags.includes(tag)) {
      setTagInputs((prev) => ({ ...prev, [scryfallId]: '' }));
      return;
    }

    const updatedTags = [...currentTags, tag];

    const { error } = await supabase
      .from('user_cards')
      .update({ tags: updatedTags })
      .eq('user_id', session.user.id)
      .eq('scryfall_id', card.scryfall_id || card.id);

    if (error) {
      alert(`Tag Error: ${error.message}`);
    } else {
      setTagInputs((prev) => ({ ...prev, [scryfallId]: '' }));
      await fetchLibrary(session.user.id);
    }
  };

  const handleRemoveTag = async (card, tagToRemove) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const currentTags = libraryMap[scryfallId]?.tags || [];
    const updatedTags = currentTags.filter((t) => t !== tagToRemove);

    const { error } = await supabase
      .from('user_cards')
      .update({ tags: updatedTags })
      .eq('user_id', session.user.id)
      .eq('scryfall_id', card.scryfall_id || card.id);

    if (error) {
      alert(`Tag Delete Error: ${error.message}`);
    } else {
      await fetchLibrary(session.user.id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLibraryMap({});
    setLibraryList([]);
    setWishlistMap({});
    setWishlistList([]);
    setSearchResults([]);
  };

  if (!session) return <Login />;

  const allAvailableTags = Array.from(
    new Set(libraryList.flatMap((item) => item.tags || []))
  );

  const filteredLibrary = libraryList.filter((card) => {
    const matchesSearch =
      card.card_name?.toLowerCase().includes(librarySearch.toLowerCase()) ||
      card.set_name?.toLowerCase().includes(librarySearch.toLowerCase());
    const matchesTag =
      !selectedTagFilter || (card.tags || []).includes(selectedTagFilter);

    return matchesSearch && matchesTag;
  });

  const filteredWishlist = wishlistList.filter((card) =>
    card.card_name?.toLowerCase().includes(wishlistSearch.toLowerCase()) ||
    card.set_name?.toLowerCase().includes(wishlistSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="max-w-4xl mx-auto p-6 font-sans">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            MTG Library App
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

        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2 px-1 font-semibold transition-colors cursor-pointer ${
              activeTab === 'search'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🔍 Scryfall Search
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

        {/* Tab Content */}
        {activeTab === 'search' && (
          <div>
            <div ref={dropdownRef} className="relative mb-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearch(query);
                }}
                className="flex gap-3"
              >
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    isSearchingRef.current = false;
                    setQuery(e.target.value);
                  }}
                  onFocus={() => suggestions.length > 0 && !isSearchingRef.current && setShowDropdown(true)}
                  placeholder="Search card name (e.g. Sol Ring)..."
                  className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              {showDropdown && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((name, index) => (
                    <li
                      key={index}
                      onClick={() => {
                        setQuery(name);
                        executeSearch(name);
                      }}
                      className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              {searchResults.map((card) => {
                const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
                const cleanId = String(card.id).trim().toLowerCase();
                const owned = libraryMap[cleanId] || { reg: 0, foil: 0 };
                const totalOwned = owned.reg + owned.foil;
                const isWishlisted = !!wishlistMap[cleanId];

                return (
                  <div key={card.id} className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-center">
                    {imgUrl ? (
                      <img src={imgUrl} alt={card.name} className="w-24 rounded-lg" />
                    ) : (
                      <div className="w-24 h-36 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-400">No Image</div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg">{card.name}</h3>
                        <button
                          onClick={() => handleToggleWishlist(card)}
                          className={`text-xl transition-transform active:scale-125 cursor-pointer`}
                          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        >
                          {isWishlisted ? '❤️' : '🤍'}
                        </button>
                      </div>
                      <p className="text-sm text-slate-500">{card.set_name}</p>
                      
                      {totalOwned > 0 && (
                        <span className="inline-block mt-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-sm border border-emerald-200 dark:border-emerald-800">
                          📦 In Library: {totalOwned}x ({owned.reg} Reg | {owned.foil} Foil)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 min-w-[130px]">
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-lg">
                        <span className="text-xs font-semibold ml-1">Reg</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleUpdateQuantity(card, false, -1)} disabled={owned.reg === 0} className="w-7 h-7 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer">-</button>
                          <span className="w-6 text-center text-xs font-bold">{owned.reg}</span>
                          <button onClick={() => handleUpdateQuantity(card, false, 1)} className="w-7 h-7 bg-blue-600 text-white rounded font-bold cursor-pointer">+</button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/30 p-1.5 rounded-lg">
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 ml-1">✨ Foil</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleUpdateQuantity(card, true, -1)} disabled={owned.foil === 0} className="w-7 h-7 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer">-</button>
                          <span className="w-6 text-center text-xs font-bold">{owned.foil}</span>
                          <button onClick={() => handleUpdateQuantity(card, true, 1)} className="w-7 h-7 bg-amber-500 text-white rounded font-bold cursor-pointer">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search collection by name..."
                className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />

              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[180px]"
              >
                <option value="">All Tags</option>
                {allAvailableTags.map((tag) => (
                  <option key={tag} value={tag}>🏷️ {tag}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No cards found matching your collection.</div>
              ) : (
                filteredLibrary.map((card) => {
                  const scryfallId = String(card.scryfall_id).trim().toLowerCase();
                  const currentTags = card.tags || [];
                  const isWishlisted = !!wishlistMap[scryfallId];

                  return (
                    <div key={card.id} className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-start">
                      {card.image_url ? (
                        <img src={card.image_url} alt={card.card_name} className="w-24 rounded-lg" />
                      ) : (
                        <div className="w-24 h-36 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-400">No Image</div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg">{card.card_name}</h3>
                          <button
                            onClick={() => handleToggleWishlist(card)}
                            className="text-xl transition-transform active:scale-125 cursor-pointer"
                            title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                          >
                            {isWishlisted ? '❤️' : '🤍'}
                          </button>
                        </div>
                        <p className="text-sm text-slate-500">{card.set_name}</p>

                        <div className="flex flex-wrap gap-2 items-center pt-1">
                          {currentTags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-full text-xs font-medium">
                              🏷️ {tag}
                              <button onClick={() => handleRemoveTag(card, tag)} className="text-slate-400 hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
                            </span>
                          ))}

                          <input
                            type="text"
                            placeholder="+ add tag"
                            value={tagInputs[scryfallId] || ''}
                            onChange={(e) => setTagInputs((prev) => ({ ...prev, [scryfallId]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag(card, tagInputs[scryfallId] || '');
                              }
                            }}
                            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 min-w-[130px]">
                        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-lg">
                          <span className="text-xs font-semibold ml-1">Reg</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleUpdateQuantity(card, false, -1)} disabled={card.reg_quantity === 0} className="w-7 h-7 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer">-</button>
                            <span className="w-6 text-center text-xs font-bold">{card.reg_quantity}</span>
                            <button onClick={() => handleUpdateQuantity(card, false, 1)} className="w-7 h-7 bg-blue-600 text-white rounded font-bold cursor-pointer">+</button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/30 p-1.5 rounded-lg">
                          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 ml-1">✨ Foil</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleUpdateQuantity(card, true, -1)} disabled={card.foil_quantity === 0} className="w-7 h-7 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer">-</button>
                            <span className="w-6 text-center text-xs font-bold">{card.foil_quantity}</span>
                            <button onClick={() => handleUpdateQuantity(card, true, 1)} className="w-7 h-7 bg-amber-500 text-white rounded font-bold cursor-pointer">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div>
            <div className="mb-6">
              <input
                type="text"
                value={wishlistSearch}
                onChange={(e) => setWishlistSearch(e.target.value)}
                placeholder="Search wishlist..."
                className="w-full p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-4">
              {filteredWishlist.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Your wishlist is empty.</div>
              ) : (
                filteredWishlist.map((card) => {
                  const scryfallId = String(card.scryfall_id).trim().toLowerCase();
                  const owned = libraryMap[scryfallId] || { reg: 0, foil: 0 };
                  const totalOwned = owned.reg + owned.foil;

                  return (
                    <div key={card.id} className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-center">
                      {card.image_url ? (
                        <img src={card.image_url} alt={card.card_name} className="w-24 rounded-lg" />
                      ) : (
                        <div className="w-24 h-36 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-400">No Image</div>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg">{card.card_name}</h3>
                          <button
                            onClick={() => handleToggleWishlist(card)}
                            className="text-xl transition-transform active:scale-125 cursor-pointer"
                            title="Remove from Wishlist"
                          >
                            ❤️
                          </button>
                        </div>
                        <p className="text-sm text-slate-500">{card.set_name}</p>

                        {totalOwned > 0 ? (
                          <span className="inline-block mt-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                            📦 In Collection: {totalOwned}x
                          </span>
                        ) : (
                          <span className="inline-block mt-3 bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full text-xs font-medium">
                            Not in library
                          </span>
                        )}
                      </div>

                      {/* Wishlist Quantity Selector */}
                      <div className="flex items-center justify-between bg-pink-50/60 dark:bg-pink-950/30 p-2 rounded-lg border border-pink-200 dark:border-pink-900/50 min-w-[130px]">
                        <span className="text-xs font-semibold text-pink-800 dark:text-pink-300 ml-1">Want</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateWishlistQty(card, -1)}
                            className="w-7 h-7 bg-white dark:bg-slate-800 hover:bg-pink-100 dark:hover:bg-pink-900/40 text-pink-800 dark:text-pink-300 rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-pink-900 dark:text-pink-200">
                            {card.desired_quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateWishlistQty(card, 1)}
                            className="w-7 h-7 bg-pink-600 hover:bg-pink-700 text-white rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}