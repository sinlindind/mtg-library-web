import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState([]);
  const [libraryMap, setLibraryMap] = useState({});
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  
  // Flag to prevent autocomplete from reopening after a search submission
  const isSearchingRef = useRef(false);

  // 1. Manage Auth State
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

  // 2. Fetch user's card collection whenever logged in
  useEffect(() => {
    if (session?.user?.id) {
      fetchLibraryQuantities(session.user.id);
    }
  }, [session]);

  // 3. Scryfall Autocomplete API Call with Debounce
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
        console.error('Autocomplete fetch error:', err);
      }
    };

    const timer = setTimeout(fetchAutocomplete, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking anywhere outside
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

  const fetchLibraryQuantities = async (userId) => {
    const { data, error } = await supabase
      .from('user_cards')
      .select('scryfall_id, reg_quantity, foil_quantity')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching library from Supabase:', error);
      return;
    }

    const qtyMap = {};
    (data || []).forEach((item) => {
      const cleanSid = String(item.scryfall_id || '').trim().toLowerCase();
      if (cleanSid) {
        qtyMap[cleanSid] = {
          reg: item.reg_quantity || 0,
          foil: item.foil_quantity || 0,
        };
      }
    });
    setLibraryMap(qtyMap);
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();

    if (showDropdown && selectedIndex >= 0 && suggestions[selectedIndex]) {
      const selectedName = suggestions[selectedIndex];
      setQuery(selectedName);
      executeSearch(selectedName);
    } else {
      executeSearch(query);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelectSuggestion = (cardName) => {
    setQuery(cardName);
    executeSearch(cardName);
  };

  // Adjust quantities up or down and handle database cleanup
  const handleUpdateQuantity = async (card, isFoil, delta) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.id).trim().toLowerCase();
    const current = libraryMap[scryfallId] || { reg: 0, foil: 0 };
    
    const newReg = isFoil ? current.reg : Math.max(0, current.reg + delta);
    const newFoil = isFoil ? Math.max(0, current.foil + delta) : current.foil;

    // If both quantities are zero, delete the record from Supabase
    if (newReg === 0 && newFoil === 0) {
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', session.user.id)
        .eq('scryfall_id', card.id);

      if (!error) {
        setLibraryMap((prev) => {
          const updated = { ...prev };
          delete updated[scryfallId];
          return updated;
        });
      } else {
        console.error('Error removing card from library:', error);
      }
      return;
    }

    // Otherwise update or insert the new quantities
    const { error } = await supabase
      .from('user_cards')
      .upsert(
        {
          user_id: session.user.id,
          scryfall_id: card.id,
          card_name: card.name,
          set_name: card.set_name,
          reg_quantity: newReg,
          foil_quantity: newFoil,
        },
        { onConflict: 'user_id, scryfall_id' }
      );

    if (!error) {
      setLibraryMap((prev) => ({
        ...prev,
        [scryfallId]: { reg: newReg, foil: newFoil },
      }));
    } else {
      console.error('Error updating card quantity:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLibraryMap({});
    setSearchResults([]);
  };

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="max-w-4xl mx-auto p-6 font-sans">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            MTG Library Search
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Search Bar with Autocomplete */}
        <div ref={dropdownRef} className="relative mb-8">
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                isSearchingRef.current = false;
                setQuery(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && !isSearchingRef.current && setShowDropdown(true)}
              placeholder="Search card name (e.g. Sol Ring)..."
              className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Dropdown Suggestions */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((name, index) => (
                <li
                  key={index}
                  onClick={() => handleSelectSuggestion(name)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-4 py-2.5 cursor-pointer transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-700/50 ${
                    index === selectedIndex
                      ? 'bg-blue-100 dark:bg-slate-700 text-blue-900 dark:text-white font-medium'
                      : 'hover:bg-blue-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Results View */}
        <div className="space-y-4">
          {searchResults.map((card) => {
            const imgUrl =
              card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
            const cleanId = String(card.id).trim().toLowerCase();
            const owned = libraryMap[cleanId] || { reg: 0, foil: 0 };
            const totalOwned = owned.reg + owned.foil;

            return (
              <div
                key={card.id}
                className="flex gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 shadow-sm items-center"
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={card.name} className="w-24 rounded-lg shadow-sm" />
                ) : (
                  <div className="w-24 h-36 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                    No Image
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    {card.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{card.set_name}</p>
                  <div className="mt-3 text-sm">
                    {totalOwned > 0 ? (
                      <span className="inline-block bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full font-medium border border-emerald-200 dark:border-emerald-800">
                        📦 In Library: {totalOwned}x ({owned.reg} Reg | {owned.foil} Foil)
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">📦 In Library: 0x</span>
                    )}
                  </div>
                </div>

                {/* Quantity Adjustment Control Groups */}
                <div className="flex flex-col gap-3 min-w-[130px]">
                  {/* Regular Quantity Stepper */}
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 ml-1">Reg</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateQuantity(card, false, -1)}
                        disabled={owned.reg === 0}
                        className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-bold text-sm shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-slate-800 dark:text-slate-100">
                        {owned.reg}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(card, false, 1)}
                        className="w-7 h-7 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Foil Quantity Stepper */}
                  <div className="flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800/60">
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 ml-1">✨ Foil</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateQuantity(card, true, -1)}
                        disabled={owned.foil === 0}
                        className="w-7 h-7 flex items-center justify-center bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded font-bold text-sm shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-amber-900 dark:text-amber-200">
                        {owned.foil}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(card, true, 1)}
                        className="w-7 h-7 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}