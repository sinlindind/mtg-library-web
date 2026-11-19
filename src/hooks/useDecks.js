import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';

export function useDecks(session) {
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [activeDeckCards, setActiveDeckCards] = useState([]);
  const [allDeckCards, setAllDeckCards] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all decks for current user
  const fetchDecks = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_decks')
        .select('*')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const fetchedDecks = Array.isArray(data) ? data : [];
      setDecks(fetchedDecks);
      await fetchAllDeckCards(fetchedDecks);
    } catch (err) {
      console.error('Error fetching decks:', err.message);
      setDecks([]);
      setAllDeckCards([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch all cards across all user decks for cross-referencing
  const fetchAllDeckCards = useCallback(async (userDecks) => {
    if (!userDecks || userDecks.length === 0) {
      setAllDeckCards([]);
      return;
    }
    try {
      const deckIds = userDecks.map((d) => d.id);
      const { data, error } = await supabase
        .from('deck_cards')
        .select('id, deck_id, scryfall_id, card_name, set_name, image_url, quantity, board, is_foil')
        .in('deck_id', deckIds);

      if (error) throw error;
      setAllDeckCards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching all deck cards:', err.message);
      setAllDeckCards([]);
    }
  }, []);

  // Fetch cards belonging to a specific deck
  const fetchDeckCards = useCallback(async (deckId) => {
    if (!deckId) return;
    try {
      const { data, error } = await supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setActiveDeckCards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching deck cards:', err.message);
      setActiveDeckCards([]);
    }
  }, []);

  // Lookup map: scryfall_id -> array of decks containing this card
  const cardDecksMap = useMemo(() => {
    const map = {};
    allDeckCards.forEach((dc) => {
      const cleanSid = String(dc.scryfall_id || '').trim().toLowerCase();
      if (!cleanSid) return;
      const deck = decks.find((d) => d.id === dc.deck_id);
      if (!map[cleanSid]) {
        map[cleanSid] = [];
      }
      map[cleanSid].push({
        deckId: dc.deck_id,
        deckName: deck ? deck.name : 'Unknown Deck',
        quantity: dc.quantity,
        board: dc.board,
      });
    });
    return map;
  }, [allDeckCards, decks]);

  // Create a new deck
  const handleCreateDeck = async (name, format = 'commander') => {
    if (!session?.user?.id || !name.trim()) return;

    try {
      const { data, error } = await supabase
        .from('user_decks')
        .insert([{ user_id: session.user.id, name, format }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const updatedDecks = [data, ...decks];
        setDecks(updatedDecks);
        setActiveDeck(data);
        await fetchAllDeckCards(updatedDecks);
      }
    } catch (err) {
      console.error('Error creating deck:', err.message);
    }
  };

  // Delete an entire deck
  const handleDeleteDeck = async (deckId) => {
    try {
      const { error } = await supabase.from('user_decks').delete().eq('id', deckId);
      if (error) throw error;

      const updatedDecks = decks.filter((d) => d.id !== deckId);
      setDecks(updatedDecks);
      if (activeDeck?.id === deckId) {
        setActiveDeck(null);
        setActiveDeckCards([]);
      }
      await fetchAllDeckCards(updatedDecks);
    } catch (err) {
      console.error('Error deleting deck:', err.message);
    }
  };

  // Add or update card quantity in a deck (accepts explicit targetDeckId)
  const handleUpdateDeckCard = async (card, delta, board = 'mainboard', targetDeckId = null) => {
    const deckIdToUse = targetDeckId || activeDeck?.id;
    if (!deckIdToUse) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();

    // Fetch current rows for that specific target deck if not activeDeck
    let targetDeckCards = activeDeckCards;
    if (targetDeckId && targetDeckId !== activeDeck?.id) {
      const { data } = await supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', targetDeckId);
      targetDeckCards = Array.isArray(data) ? data : [];
    }

    const existingIndex = targetDeckCards.findIndex(
      (c) =>
        String(c.scryfall_id || '').trim().toLowerCase() === scryfallId &&
        (c.board || 'mainboard') === board
    );

    const existingCard = targetDeckCards[existingIndex];
    const newQty = (existingCard?.quantity || 0) + delta;

    if (newQty <= 0) {
      if (existingCard) {
        const { error } = await supabase
          .from('deck_cards')
          .delete()
          .eq('id', existingCard.id);

        if (!error) {
          if (deckIdToUse === activeDeck?.id) {
            setActiveDeckCards((prev) => prev.filter((c) => c.id !== existingCard.id));
          }
          await fetchAllDeckCards(decks);
        }
      }
      return;
    }

    const payload = {
      deck_id: deckIdToUse,
      scryfall_id: scryfallId,
      card_name: card.name || card.card_name,
      set_name: card.set_name || '',
      image_url:
        card.image_uris?.normal ||
        card.card_faces?.[0]?.image_uris?.normal ||
        card.image_url,
      quantity: newQty,
      board: board,
      is_foil: Boolean(card.is_foil),
    };

    if (existingCard) {
      const { data, error } = await supabase
        .from('deck_cards')
        .update({ quantity: newQty })
        .eq('id', existingCard.id)
        .select()
        .single();

      if (!error && data) {
        if (deckIdToUse === activeDeck?.id) {
          setActiveDeckCards((prev) => prev.map((c) => (c.id === data.id ? data : c)));
        }
        await fetchAllDeckCards(decks);
      }
    } else {
      const { data, error } = await supabase
        .from('deck_cards')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        if (deckIdToUse === activeDeck?.id) {
          setActiveDeckCards((prev) => [...prev, data]);
        }
        await fetchAllDeckCards(decks);
      }
    }
  };

  // Assign or unset a card as the commander of a deck in Supabase (`board = 'commander'`)
  const handleSetCommanderCard = async (card, targetDeckId = null) => {
    const deckIdToUse = targetDeckId || activeDeck?.id;
    if (!deckIdToUse || !card) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    if (!scryfallId) return;

    try {
      const { data: currentRows, error: fetchErr } = await supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', deckIdToUse);

      if (fetchErr) throw fetchErr;
      const rows = Array.isArray(currentRows) ? currentRows : [];

      const existingCommanderRows = rows.filter(
        (r) => String(r.board || '').toLowerCase() === 'commander'
      );
      const isAlreadyThisCommander = existingCommanderRows.some(
        (r) => String(r.scryfall_id || '').trim().toLowerCase() === scryfallId
      );

      // Move any previous commander card back to 'mainboard'
      for (const prevCmd of existingCommanderRows) {
        const { error: revertErr } = await supabase
          .from('deck_cards')
          .update({ board: 'mainboard' })
          .eq('id', prevCmd.id);
        if (revertErr) throw revertErr;
      }

      if (!isAlreadyThisCommander) {
        const matchingMainboardRow = rows.find(
          (r) =>
            String(r.scryfall_id || '').trim().toLowerCase() === scryfallId &&
            String(r.board || 'mainboard').toLowerCase() === 'mainboard'
        );

        if (matchingMainboardRow) {
          const { error: promoteErr } = await supabase
            .from('deck_cards')
            .update({ board: 'commander', quantity: 1 })
            .eq('id', matchingMainboardRow.id);
          if (promoteErr) throw promoteErr;
        } else {
          const { error: insertErr } = await supabase.from('deck_cards').insert([
            {
              deck_id: deckIdToUse,
              scryfall_id: scryfallId,
              card_name: card.name || card.card_name,
              set_name: card.set_name || '',
              image_url:
                card.image_uris?.normal ||
                card.card_faces?.[0]?.image_uris?.normal ||
                card.image_url ||
                null,
              quantity: 1,
              board: 'commander',
              is_foil: Boolean(card.is_foil),
            },
          ]);
          if (insertErr) throw insertErr;
        }
      }

      await fetchDeckCards(deckIdToUse);
      await fetchAllDeckCards(decks);
    } catch (err) {
      console.error('Error setting commander card:', err.message);
    }
  };

  // One-click: Send missing active deck cards directly to Wishlist
  const handleExportMissingToWishlist = async (libraryMap, fetchWishlist) => {
    const cards = Array.isArray(activeDeckCards) ? activeDeckCards : [];
    if (!cards.length || !session?.user?.id) return;

    const missingItems = [];

    cards.forEach((dc) => {
      const libraryEntry = (libraryMap && libraryMap[dc.scryfall_id]) || { reg: 0, foil: 0 };
      const totalOwned = (libraryEntry.reg || 0) + (libraryEntry.foil || 0);

      if (totalOwned < dc.quantity) {
        const missingCount = dc.quantity - totalOwned;
        missingItems.push({
          user_id: session.user.id,
          scryfall_id: dc.scryfall_id,
          card_name: dc.card_name,
          set_name: dc.set_name,
          image_url: dc.image_url,
          desired_quantity: missingCount,
        });
      }
    });

    if (missingItems.length === 0) {
      alert('You already own all the cards required for this deck!');
      return;
    }

    try {
      const { error } = await supabase.from('user_wishlist').upsert(missingItems, {
        onConflict: 'user_id,scryfall_id',
      });

      if (error) throw error;
      alert(`Added ${missingItems.length} missing card types to your Wishlist!`);
      if (fetchWishlist) fetchWishlist(session.user.id);
    } catch (err) {
      console.error('Error sending missing cards to Wishlist:', err.message);
    }
  };

  return {
    decks: Array.isArray(decks) ? decks : [],
    activeDeck,
    setActiveDeck,
    activeDeckCards: Array.isArray(activeDeckCards) ? activeDeckCards : [],
    cardDecksMap,
    loading,
    fetchDecks,
    fetchDeckCards,
    handleCreateDeck,
    handleDeleteDeck,
    handleUpdateDeckCard,
    handleSetCommanderCard,
    handleExportMissingToWishlist,
  };
}