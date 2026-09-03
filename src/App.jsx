import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login.jsx';

// Available Scryfall fields to pick from
const AVAILABLE_FIELDS = [
  { key: 'card_name', label: 'Title / Card Name', default: true },
  { key: 'set_name', label: 'Edition / Set Name', default: true },
  { key: 'reg_quantity', label: 'Regular Quantity', default: true },
  { key: 'foil_quantity', label: 'Foil Quantity', default: true },
  { key: 'mana_cost', label: 'Mana Cost', default: false },
  { key: 'type_line', label: 'Type Line', default: false },
  { key: 'oracle_text', label: 'Oracle Text', default: false },
  { key: 'rarity', label: 'Rarity', default: false },
  { key: 'cmc', label: 'CMC', default: false },
  { key: 'colors', label: 'Colors', default: false },
  { key: 'price_usd', label: 'Price (USD)', default: false },
  { key: 'price_usd_foil', label: 'Price Foil (USD)', default: false },
  { key: 'tags', label: 'Tags', default: false },
];

const normalizeTags = (rawTags) => {
  if (!rawTags) return [];
  
  // Handle array input
  if (Array.isArray(rawTags)) {
    return rawTags
      .map((t) => String(t).trim().toLowerCase())
      .filter((t) => t.length > 0);
  }
  
  // Handle string input
  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) {
        return parsed
          .map((t) => String(t).trim().toLowerCase())
          .filter((t) => t.length > 0);
      }
    } catch {
      return rawTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);
    }
  }
  return [];
};

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const isSearchingRef = useRef(false);

  const [libraryMap, setLibraryMap] = useState({});
  const [libraryList, setLibraryList] = useState([]);
  const [wishlistMap, setWishlistMap] = useState({});
  const [wishlistList, setWishlistList] = useState([]);
  
  const [librarySearch, setLibrarySearch] = useState('');
  const [wishlistSearch, setWishlistSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [tagInputs, setTagInputs] = useState({});

  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState(
    AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.key)
  );
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [previewImage, setPreviewImage] = useState(null);

  // Clean Auth listener (prevents triple re-fetching seen in console)
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
  }, [session?.user?.id]);

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
        console.error('Autocomplete Error:', err);
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
    console.log('Fetching library for user:', userId);
    const { data, error } = await supabase
      .from('user_cards')
      .select('id, scryfall_id, card_name, set_name, image_url, reg_quantity, foil_quantity, tags')
      .eq('user_id', userId);

    if (error) {
      console.error('Fetch Library Error:', error.message, error.details);
      alert(`Fetch Library Failed: ${error.message}`);
      return;
    }

    const sanitizedData = (data || []).map((item) => ({
      ...item,
      tags: normalizeTags(item.tags),
    }));

    const qtyMap = {};
    sanitizedData.forEach((item) => {
      const cleanSid = String(item.scryfall_id || '').trim().toLowerCase();
      if (cleanSid) {
        qtyMap[cleanSid] = {
          reg: item.reg_quantity || 0,
          foil: item.foil_quantity || 0,
          tags: item.tags,
        };
      }
    });

    console.log('Library Loaded Successfully:', sanitizedData);
    setLibraryMap(qtyMap);
    setLibraryList(sanitizedData);
  };

  const fetchWishlist = async (userId) => {
    console.log('Fetching wishlist for user:', userId);
    const { data, error } = await supabase
      .from('user_wishlist')
      .select('id, scryfall_id, card_name, set_name, image_url, desired_quantity')
      .eq('user_id', userId);

    if (error) {
      console.error('Fetch Wishlist Error:', error.message, error.details);
      alert(`Fetch Wishlist Failed: ${error.message}`);
      return;
    }

    const map = {};
    (data || []).forEach((item) => {
      const cleanSid = String(item.scryfall_id || '').trim().toLowerCase();
      if (cleanSid) {
        map[cleanSid] = item.desired_quantity || 1;
      }
    });

    console.log('Wishlist Loaded Successfully:', data);
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
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        const selectedName = suggestions[selectedIndex];
        setQuery(selectedName);
        executeSearch(selectedName);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const handleUpdateQuantity = async (card, isFoil, delta) => {
    if (!session?.user?.id) {
      alert('User session not found.');
      return;
    }

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
        console.error('Delete Error:', error);
        alert(`Delete Error: ${error.message}`);
        return;
      }

      await fetchLibrary(session.user.id);
      return;
    }

    const payload = {
      user_id: session.user.id,
      scryfall_id: card.id || card.scryfall_id,
      card_name: card.name || card.card_name,
      set_name: card.set_name,
      image_url: imgUrl,
      reg_quantity: newReg,
      foil_quantity: newFoil,
      tags: current.tags || [],
    };

    const { error } = await supabase
      .from('user_cards')
      .upsert(payload, { onConflict: 'user_id, scryfall_id' });

    if (error) {
      console.error('Upsert Error:', error);
      alert(`Upsert Error: ${error.message}\n${error.details || ''}`);
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

      if (error) console.error('Wishlist Delete Error:', error);
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

      if (error) console.error('Wishlist Upsert Error:', error);
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
      console.error('Wishlist Qty Error:', error);
      alert(`Wishlist Qty Error: ${error.message}`);
    } else {
      await fetchWishlist(session.user.id);
    }
  };

  const handleAddTag = async (card, tagToAdd) => {
    const tag = tagToAdd.trim().toLowerCase();
    if (!tag || !session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const rawExisting = card.tags ?? libraryMap[scryfallId]?.tags;
    const currentTags = normalizeTags(rawExisting);

    if (currentTags.includes(tag)) {
      setTagInputs((prev) => ({ ...prev, [scryfallId]: '' }));
      return;
    }

    const updatedTags = [...currentTags, tag];

    setLibraryList((prev) =>
      prev.map((item) =>
        String(item.scryfall_id).trim().toLowerCase() === scryfallId
          ? { ...item, tags: updatedTags }
          : item
      )
    );

    setLibraryMap((prev) => ({
      ...prev,
      [scryfallId]: {
        ...prev[scryfallId],
        tags: updatedTags,
      },
    }));

    setTagInputs((prev) => ({ ...prev, [scryfallId]: '' }));

    const { error } = await supabase
      .from('user_cards')
      .update({ tags: updatedTags })
      .eq('user_id', session.user.id)
      .eq('scryfall_id', card.scryfall_id || card.id);

    if (error) {
      console.error('Tag Update Error:', error);
      alert(`Tag Error: ${error.message}`);
      await fetchLibrary(session.user.id);
    }
  };

  const handleRemoveTag = async (card, tagToRemove) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const rawExisting = card.tags ?? libraryMap[scryfallId]?.tags;
    const currentTags = normalizeTags(rawExisting);
    const cleanRemove = String(tagToRemove).trim().toLowerCase();

    const updatedTags = currentTags.filter((t) => t !== cleanRemove);

    setLibraryList((prev) =>
      prev.map((item) =>
        String(item.scryfall_id).trim().toLowerCase() === scryfallId
          ? { ...item, tags: updatedTags }
          : item
      )
    );

    setLibraryMap((prev) => ({
      ...prev,
      [scryfallId]: {
        ...prev[scryfallId],
        tags: updatedTags,
      },
    }));

    const { error } = await supabase
      .from('user_cards')
      .update({ tags: updatedTags })
      .eq('user_id', session.user.id)
      .eq('scryfall_id', card.scryfall_id || card.id);

    if (error) {
      console.error('Tag Delete Error:', error);
      alert(`Tag Delete Error: ${error.message}`);
      await fetchLibrary(session.user.id);
    }
  };

  const fetchScryfallDetails = async (cardsToExport) => {
    const scryfallDataMap = {};
    const chunkSize = 75;
    const chunks = [];

    for (let i = 0; i < cardsToExport.length; i += chunkSize) {
      chunks.push(cardsToExport.slice(i, i + chunkSize));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const identifiers = chunk.map((c) => ({ id: c.scryfall_id }));

      try {
        const res = await fetch('https://api.scryfall.com/cards/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifiers }),
        });
        const json = await res.json();

        (json.data || []).forEach((scryfallCard) => {
          scryfallDataMap[scryfallCard.id.toLowerCase()] = scryfallCard;
        });
      } catch (err) {
        console.error('Error fetching Scryfall collection chunk:', err);
      }

      setExportProgress(Math.round(((i + 1) / chunks.length) * 100));
    }

    return scryfallDataMap;
  };

  // FIXED TAG FILTER LOGIC HERE
  // Add logs inside getFilteredLibrary
  const getFilteredLibrary = () => {
    console.log("--- FILTER CHECK START ---");
    console.log("selectedTagFilter RAW:", JSON.stringify(selectedTagFilter));
    console.log("Total libraryList count:", libraryList.length);

    const results = libraryList.filter((card) => {
      const cardTags = normalizeTags(card.tags);
      const searchLower = librarySearch.trim().toLowerCase();
      
      const matchesSearch =
        !searchLower ||
        card.card_name?.toLowerCase().includes(searchLower) ||
        card.set_name?.toLowerCase().includes(searchLower);

      const cleanFilter = (selectedTagFilter || '').trim().toLowerCase();
      
      const matchesTag =
        cleanFilter === '' ||
        cleanFilter === 'all tags' ||
        cleanFilter === '__all__' ||
        cardTags.includes(cleanFilter);

      if (card.card_name?.toLowerCase().includes('absolute grace')) {
        console.log("CARD MATCH DEBUG [Absolute Grace]:", {
          card_name: card.card_name,
          raw_tags: card.tags,
          normalized_tags: cardTags,
          cleanFilter: cleanFilter,
          matchesSearch: matchesSearch,
          matchesTag: matchesTag,
          will_show: matchesSearch && matchesTag
        });
      }

      return matchesSearch && matchesTag;
    });

    console.log("Filtered library count returned:", results.length);
    console.log("--- FILTER CHECK END ---");
    return results;
  };

  const handleExecuteExport = async () => {
    const cardsToExport = getFilteredLibrary();

    if (cardsToExport.length === 0) {
      alert('No library cards match your current filter to export!');
      return;
    }

    setExporting(true);
    setExportProgress(0);

    try {
      const scryfallMap = await fetchScryfallDetails(cardsToExport);

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
              <h1>MTG Personal Library ${selectedTagFilter ? `(Filtered: ${selectedTagFilter})` : ''}</h1>
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
    new Set(
      libraryList.flatMap((item) => normalizeTags(item.tags))
    )
  );

  const filteredLibrary = getFilteredLibrary();

  const filteredWishlist = wishlistList.filter((card) =>
    card.card_name?.toLowerCase().includes(wishlistSearch.toLowerCase()) ||
    card.set_name?.toLowerCase().includes(wishlistSearch.toLowerCase())
  );

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
          <div>
            <div ref={dropdownRef} className="relative mb-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    const selectedName = suggestions[selectedIndex];
                    setQuery(selectedName);
                    executeSearch(selectedName);
                  } else {
                    executeSearch(query);
                  }
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
                  onKeyDown={handleKeyDown}
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
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`px-4 py-2.5 cursor-pointer text-slate-800 dark:text-slate-200 ${
                        selectedIndex === index
                          ? 'bg-blue-100 dark:bg-slate-700 font-semibold'
                          : 'hover:bg-blue-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-6">
              {searchResults.map((card) => {
                const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
                const highResUrl = card.image_uris?.large || card.image_uris?.png || card.card_faces?.[0]?.image_uris?.large || imgUrl;
                const cleanId = String(card.id).trim().toLowerCase();
                const owned = libraryMap[cleanId] || { reg: 0, foil: 0 };
                const totalOwned = owned.reg + owned.foil;
                const isWishlisted = !!wishlistMap[cleanId];

                return (
                  <div key={card.id} className="flex flex-col sm:flex-row gap-6 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-start">
                    {imgUrl ? (
                      <img 
                        src={imgUrl} 
                        alt={card.name} 
                        onClick={() => setPreviewImage(highResUrl)}
                        className="w-56 rounded-xl cursor-pointer transition-transform hover:scale-105 hover:shadow-xl shrink-0" 
                        title="Click to view full resolution"
                      />
                    ) : (
                      <div className="w-56 h-80 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-xs text-slate-400 shrink-0">No Image</div>
                    )}

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-xl">{card.name}</h3>
                        <button
                          onClick={() => handleToggleWishlist(card)}
                          className="text-2xl transition-transform active:scale-125 cursor-pointer"
                          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        >
                          {isWishlisted ? '❤️' : '🤍'}
                        </button>
                      </div>
                      <p className="text-base text-slate-500">{card.set_name}</p>
                      
                      {totalOwned > 0 && (
                        <span className="inline-block bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-800">
                          📦 In Library: {totalOwned}x ({owned.reg} Reg | {owned.foil} Foil)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 min-w-[150px] w-full sm:w-auto">
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/60 p-2 rounded-lg">
                        <span className="text-sm font-semibold ml-1">Reg</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleUpdateQuantity(card, false, -1)} disabled={owned.reg === 0} className="w-8 h-8 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer shadow-sm">-</button>
                          <span className="w-6 text-center text-sm font-bold">{owned.reg}</span>
                          <button onClick={() => handleUpdateQuantity(card, false, 1)} className="w-8 h-8 bg-blue-600 text-white rounded font-bold cursor-pointer shadow-sm">+</button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 ml-1">✨ Foil</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleUpdateQuantity(card, true, -1)} disabled={owned.foil === 0} className="w-8 h-8 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer shadow-sm">-</button>
                          <span className="w-6 text-center text-sm font-bold">{owned.foil}</span>
                          <button onClick={() => handleUpdateQuantity(card, true, 1)} className="w-8 h-8 bg-amber-500 text-white rounded font-bold cursor-pointer shadow-sm">+</button>
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

              {/* Tag Dropdown with explicit empty value for 'All Tags' */}
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

              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                📥 Export Library
              </button>
            </div>

            <div className="space-y-6">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No cards found matching your collection.</div>
              ) : (
                filteredLibrary.map((card) => {
                  const scryfallId = String(card.scryfall_id).trim().toLowerCase();
                  const currentTags = normalizeTags(card.tags);
                  const isWishlisted = !!wishlistMap[scryfallId];

                  return (
                    <div key={card.id} className="flex flex-col sm:flex-row gap-6 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-start">
                      {card.image_url ? (
                        <img 
                          src={card.image_url} 
                          alt={card.card_name} 
                          onClick={() => setPreviewImage(card.image_url)}
                          className="w-56 rounded-xl cursor-pointer transition-transform hover:scale-105 hover:shadow-xl shrink-0" 
                          title="Click to view full resolution"
                        />
                      ) : (
                        <div className="w-56 h-80 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-xs text-slate-400 shrink-0">No Image</div>
                      )}

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-xl">{card.card_name}</h3>
                          <button
                            onClick={() => handleToggleWishlist(card)}
                            className="text-2xl transition-transform active:scale-125 cursor-pointer"
                            title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                          >
                            {isWishlisted ? '❤️' : '🤍'}
                          </button>
                        </div>
                        <p className="text-base text-slate-500">{card.set_name}</p>

                        <div className="flex flex-wrap gap-2 items-center pt-2">
                          {currentTags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-full text-xs font-medium">
                              🏷️ {tag}
                              <button onClick={() => handleRemoveTag(card, tag)} className="text-slate-400 hover:text-red-500 font-bold ml-1 cursor-pointer">×</button>
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
                            className="text-xs px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 min-w-[150px] w-full sm:w-auto">
                        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/60 p-2 rounded-lg">
                          <span className="text-sm font-semibold ml-1">Reg</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleUpdateQuantity(card, false, -1)} disabled={card.reg_quantity === 0} className="w-8 h-8 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer shadow-sm">-</button>
                            <span className="w-6 text-center text-sm font-bold">{card.reg_quantity}</span>
                            <button onClick={() => handleUpdateQuantity(card, false, 1)} className="w-8 h-8 bg-blue-600 text-white rounded font-bold cursor-pointer shadow-sm">+</button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 ml-1">✨ Foil</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleUpdateQuantity(card, true, -1)} disabled={card.foil_quantity === 0} className="w-8 h-8 bg-white dark:bg-slate-800 rounded font-bold disabled:opacity-30 cursor-pointer shadow-sm">-</button>
                            <span className="w-6 text-center text-sm font-bold">{card.foil_quantity}</span>
                            <button onClick={() => handleUpdateQuantity(card, true, 1)} className="w-8 h-8 bg-amber-500 text-white rounded font-bold cursor-pointer shadow-sm">+</button>
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

            <div className="space-y-6">
              {filteredWishlist.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Your wishlist is empty.</div>
              ) : (
                filteredWishlist.map((card) => {
                  const scryfallId = String(card.scryfall_id).trim().toLowerCase();
                  const owned = libraryMap[scryfallId] || { reg: 0, foil: 0 };
                  const totalOwned = owned.reg + owned.foil;

                  return (
                    <div key={card.id} className="flex flex-col sm:flex-row gap-6 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800 items-start">
                      {card.image_url ? (
                        <img 
                          src={card.image_url} 
                          alt={card.card_name} 
                          onClick={() => setPreviewImage(card.image_url)}
                          className="w-56 rounded-xl cursor-pointer transition-transform hover:scale-105 hover:shadow-xl shrink-0" 
                          title="Click to view full resolution"
                        />
                      ) : (
                        <div className="w-56 h-80 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-xs text-slate-400 shrink-0">No Image</div>
                      )}

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-xl">{card.card_name}</h3>
                          <button
                            onClick={() => handleToggleWishlist(card)}
                            className="text-2xl transition-transform active:scale-125 cursor-pointer"
                            title="Remove from Wishlist"
                          >
                            ❤️
                          </button>
                        </div>
                        <p className="text-base text-slate-500">{card.set_name}</p>

                        {totalOwned > 0 ? (
                          <span className="inline-block bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-800">
                            📦 In Collection: {totalOwned}x
                          </span>
                        ) : (
                          <span className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-full text-xs font-medium">
                            Not in library
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-pink-50/60 dark:bg-pink-950/30 p-2.5 rounded-lg border border-pink-200 dark:border-pink-900/50 min-w-[150px] w-full sm:w-auto">
                        <span className="text-sm font-semibold text-pink-800 dark:text-pink-300 ml-1">Want</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateWishlistQty(card, -1)}
                            className="w-8 h-8 bg-white dark:bg-slate-800 hover:bg-pink-100 dark:hover:bg-pink-900/40 text-pink-800 dark:text-pink-300 rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-pink-900 dark:text-pink-200">
                            {card.desired_quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateWishlistQty(card, 1)}
                            className="w-8 h-8 bg-pink-600 hover:bg-pink-700 text-white rounded font-bold text-sm shadow-sm transition-colors cursor-pointer"
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

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3">
              <h2 className="text-xl font-bold">Export Library</h2>
              <button
                onClick={() => !exporting && setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Export Format
              </label>
              <div className="flex gap-4">
                {['csv', 'pdf', 'json'].map((fmt) => (
                  <label key={fmt} className="flex items-center gap-2 cursor-pointer uppercase text-sm font-medium">
                    <input
                      type="radio"
                      name="format"
                      value={fmt}
                      checked={exportFormat === fmt}
                      onChange={(e) => setExportFormat(e.target.value)}
                      disabled={exporting}
                      className="accent-blue-600"
                    />
                    {fmt}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Fields to Include
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg">
                {AVAILABLE_FIELDS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFields([...selectedFields, field.key]);
                        } else {
                          setSelectedFields(selectedFields.filter((k) => k !== field.key));
                        }
                      }}
                      disabled={exporting}
                      className="rounded accent-blue-600"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            {exporting && (
              <div className="space-y-2 text-center py-2">
                <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold">
                  <span className="animate-spin text-xl">🌀</span> Fetching card details... {exportProgress}%
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-200"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteExport}
                disabled={exporting || selectedFields.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {exporting ? 'Exporting...' : 'Download Export'}
              </button>
            </div>
          </div>
        </div>
      )}

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