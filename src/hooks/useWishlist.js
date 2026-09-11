import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

export function useWishlist(session) {
  const [wishlistMap, setWishlistMap] = useState({});
  const [wishlistList, setWishlistList] = useState([]);

  const fetchWishlist = useCallback(async (userId) => {
    if (!userId) return;

    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('user_wishlist')
        .select('id, scryfall_id, card_name, set_name, image_url, desired_quantity')
        .eq('user_id', userId)
        .range(from, to);

      if (error) {
        console.error('Fetch Wishlist Error:', error.message, error.details);
        alert(`Fetch Wishlist Failed: ${error.message}`);
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

    const map = {};
    allData.forEach((item) => {
      const cleanSid = String(item.scryfall_id || '').trim().toLowerCase();
      if (cleanSid) {
        map[cleanSid] = item.desired_quantity || 1;
      }
    });

    setWishlistMap(map);
    setWishlistList(allData);
  }, []);

  const handleToggleWishlist = async (card) => {
    if (!session?.user?.id) return;

    const scryfallId = String(card.scryfall_id || card.id).trim().toLowerCase();
    const isWishlisted = !!wishlistMap[scryfallId];

    if (isWishlisted) {
      const { error } = await supabase
        .from('user_wishlist')
        .delete()
        .eq('user_id', session.user.id)
        .eq('scryfall_id', scryfallId);

      if (error) console.error('Wishlist Delete Error:', error);
    } else {
      const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || card.image_url;
      const { error } = await supabase
        .from('user_wishlist')
        .upsert(
          {
            user_id: session.user.id,
            scryfall_id: scryfallId,
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
      .eq('scryfall_id', scryfallId);

    if (error) {
      console.error('Wishlist Qty Error:', error);
      alert(`Wishlist Qty Error: ${error.message}`);
    } else {
      await fetchWishlist(session.user.id);
    }
  };

  return {
    wishlistMap,
    setWishlistMap,
    wishlistList,
    setWishlistList,
    fetchWishlist,
    handleToggleWishlist,
    handleUpdateWishlistQty,
  };
}