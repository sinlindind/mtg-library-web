import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';

export default function App() {
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [libraryMap, setLibraryMap] = useState({});
  const [loading, setLoading] = useState(false);

  // Check initial session & listen for auth state changes
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

  // Fetch quantities whenever session updates
  useEffect(() => {
    if (session?.user?.id) {
      fetchLibraryQuantities(session.user.id);
    }
  }, [session]);

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?unique=prints&q=!%22${encodeURIComponent(query.trim())}%22`
      );
      const json = await res.json();
      setSearchResults(json.data || []);
    } catch (err) {
      console.error('Scryfall API search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (card, isFoil) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.id).trim().toLowerCase();
    const current = libraryMap[scryfallId] || { reg: 0, foil: 0 };
    const newReg = isFoil ? current.reg : current.reg + 1;
    const newFoil = isFoil ? current.foil + 1 : current.foil;

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
      console.error('Error updating database:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLibraryMap({});
    setSearchResults([]);
  };

  // Render Login screen if user is not authenticated
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
              className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSearch} className="mb-8 flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search card name (e.g. Sol Ring)..."
            className="flex-1 p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <div className="space-y-4">
          {searchResults.map((card) => {
            const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
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
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{card.name}</h3>
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

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleAddCard(card, false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    + Reg
                  </button>
                  <button
                    onClick={() => handleAddCard(card, true)}
                    className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✨ Foil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}