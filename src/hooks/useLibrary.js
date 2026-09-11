import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { normalizeTags } from '../utils/tagUtils';

export function useLibrary(session) {
  const [libraryMap, setLibraryMap] = useState({});
  const [libraryList, setLibraryList] = useState([]);

  const fetchLibrary = useCallback(async (userId) => {
    if (!userId) return;

    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('user_cards')
        .select('id, scryfall_id, card_name, set_name, image_url, reg_quantity, foil_quantity, tags')
        .eq('user_id', userId)
        .range(from, to);

      if (error) {
        console.error('Fetch Library Error:', error.message, error.details);

        if (error.message?.includes('JWT issued at future')) {
          alert(
            'Authentication Time Sync Error:\nYour device clock is behind current server time. Please update/sync your system clock in your device settings.'
          );
          await supabase.auth.refreshSession();
          return;
        }

        alert(`Fetch Library Failed: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const sanitizedData = allData.map((item) => ({
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

    setLibraryMap(qtyMap);
    setLibraryList(sanitizedData);
  }, []);

  const availableTags = useMemo(() => {
    const tagSet = new Set();
    libraryList.forEach((card) => {
      const tags = normalizeTags(card.tags);
      tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [libraryList]);

  const handleUpdateQuantity = async (card, isFoil, delta) => {
    if (!session?.user?.id) {
      alert('User session not found.');
      return;
    }

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const current = libraryMap[scryfallId] || { reg: 0, foil: 0, tags: [] };
    const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || card.image_url;

    const newReg = isFoil ? current.reg : Math.max(0, current.reg + delta);
    const newFoil = isFoil ? Math.max(0, current.foil + delta) : current.foil;

    if (newReg === 0 && newFoil === 0) {
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', session.user.id)
        .eq('scryfall_id', scryfallId);

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
      scryfall_id: scryfallId,
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

  const handleAddTag = async (card, tagToAdd, setTagInputs) => {
    const tag = tagToAdd.trim().toLowerCase();
    if (!tag || !session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const rawExisting = card.tags ?? libraryMap[scryfallId]?.tags;
    const currentTags = normalizeTags(rawExisting);

    if (currentTags.includes(tag)) {
      if (setTagInputs) setTagInputs((prev) => ({ ...prev, [scryfallId]: '' }));
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

    if (setTagInputs) setTagInputs((prev) => ({ ...prev, [scryfallId]: '' }));

    const { error } = await supabase
      .from('user_cards')
      .update({ tags: updatedTags })
      .eq('user_id', session.user.id)
      .eq('scryfall_id', scryfallId);

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
      .eq('scryfall_id', scryfallId);

    if (error) {
      console.error('Tag Delete Error:', error);
      alert(`Tag Delete Error: ${error.message}`);
      await fetchLibrary(session.user.id);
    }
  };

  const handleToggleTagCheck = async (card, tag) => {
    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const currentTags = normalizeTags(card.tags ?? libraryMap[scryfallId]?.tags);
    if (currentTags.includes(tag)) {
      await handleRemoveTag(card, tag);
    } else {
      await handleAddTag(card, tag);
    }
  };

  return {
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
  };
}