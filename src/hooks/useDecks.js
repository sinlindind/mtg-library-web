import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

export function useDecks(session) {
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [activeDeckCards, setActiveDeckCards] = useState([]);
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
      setDecks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching decks:', err.message);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

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
        setDecks((prev) => [data, ...(Array.isArray(prev) ? prev : [])]);
        setActiveDeck(data);
        setActiveDeckCards([]);
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

      setDecks((prev) => (Array.isArray(prev) ? prev.filter((d) => d.id !== deckId) : []));
      if (activeDeck?.id === deckId) {
        setActiveDeck(null);
        setActiveDeckCards([]);
      }
    } catch (err) {
      console.error('Error deleting deck:', err.message);
    }
  };

  // Add or update card quantity in active deck
  const handleUpdateDeckCard = async (card, delta, board = 'mainboard') => {
    if (!activeDeck) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const currentCards = Array.isArray(activeDeckCards) ? activeDeckCards : [];
    const existingIndex = currentCards.findIndex(
      (c) => c.scryfall_id === scryfallId && c.board === board
    );

    const existingCard = currentCards[existingIndex];
    const newQty = (existingCard?.quantity || 0) + delta;

    if (newQty <= 0) {
      if (existingCard) {
        const { error } = await supabase
          .from('deck_cards')
          .delete()
          .eq('id', existingCard.id);

        if (!error) {
          setActiveDeckCards((prev) =>
            Array.isArray(prev) ? prev.filter((c) => c.id !== existingCard.id) : []
          );
        }
      }
      return;
    }

    const payload = {
      deck_id: activeDeck.id,
      scryfall_id: scryfallId,
      card_name: card.name || card.card_name,
      set_name: card.set_name || '',
      image_url:
        card.image_uris?.normal ||
        card.card_faces?.[0]?.image_uris?.normal ||
        card.image_url,
      quantity: newQty,
      board: board,
    };

    if (existingCard) {
      const { data, error } = await supabase
        .from('deck_cards')
        .update({ quantity: newQty })
        .eq('id', existingCard.id)
        .select()
        .single();

      if (!error && data) {
        setActiveDeckCards((prev) =>
          Array.isArray(prev)
            ? prev.map((c) => (c.id === data.id ? data : c))
            : [data]
        );
      }
    } else {
      const { data, error } = await supabase
        .from('deck_cards')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        setActiveDeckCards((prev) => [...(Array.isArray(prev) ? prev : []), data]);
      }
    }
  };

  // One-click: Send missing deck cards directly to Wishlist
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
    loading,
    fetchDecks,
    fetchDeckCards,
    handleCreateDeck,
    handleDeleteDeck,
    handleUpdateDeckCard,
    handleExportMissingToWishlist,
  };
}