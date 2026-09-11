import React, { useState, useEffect, useRef } from 'react';
import CardItem from './CardItem';
import { fetchAutocompleteSuggestions, fetchScryfallSearch } from '../services/scryfall';

export default function SearchTab({
  libraryMap,
  wishlistMap,
  availableTags,
  handleUpdateQuantity,
  handleToggleWishlist,
  handleAddTag,
  handleRemoveTag,
  handleToggleTagCheck,
  setPreviewImage,
  searchResults,
  setSearchResults,
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchSort, setSearchSort] = useState('name');

  const dropdownRef = useRef(null);
  const isSearchingRef = useRef(false);

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
        const data = await fetchAutocompleteSuggestions(query);
        if (!isSearchingRef.current) {
          setSuggestions(data);
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

  const executeSearch = async (searchQuery, sortOption = searchSort) => {
    if (!searchQuery.trim()) return;

    isSearchingRef.current = true;
    setShowDropdown(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    setLoading(true);

    try {
      const results = await fetchScryfallSearch(searchQuery, sortOption);
      setSearchResults(results);
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

  return (
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
          className="flex flex-wrap sm:flex-nowrap gap-3"
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

          <select
            value={searchSort}
            onChange={(e) => {
              const newSort = e.target.value;
              setSearchSort(newSort);
              if (query.trim()) {
                executeSearch(query, newSort);
              }
            }}
            className="p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
          >
            <option value="name">Sort: Name</option>
            <option value="released">Sort: Release Date</option>
            <option value="set">Sort: Set Code</option>
            <option value="usd">Sort: Price (USD)</option>
            <option value="cmc">Sort: CMC</option>
          </select>

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
        {searchResults.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            type="search"
            libraryMap={libraryMap}
            wishlistMap={wishlistMap}
            availableTags={availableTags}
            setPreviewImage={setPreviewImage}
            handleToggleWishlist={handleToggleWishlist}
            handleUpdateQuantity={handleUpdateQuantity}
            handleAddTag={handleAddTag}
            handleRemoveTag={handleRemoveTag}
            handleToggleTagCheck={handleToggleTagCheck}
          />
        ))}
      </div>
    </div>
  );
}