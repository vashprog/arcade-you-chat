
-- Create atomic card draw function similar to roll_dice_game
CREATE OR REPLACE FUNCTION public.draw_card_game(p_session_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_game_state JSONB;
  v_current_turn UUID;
  v_draws JSONB;
  v_players JSONB;
  v_all_drawn BOOLEAN;
  v_next_turn UUID;
  v_max_val INT;
  v_winners UUID[];
  v_idx INT;
  v_player JSONB;
  v_player_id TEXT;
  v_draw_val INT;
  v_card_value INT;
  v_card_suit INT;
BEGIN
  -- Lock the row
  SELECT game_state, current_turn INTO v_game_state, v_current_turn
  FROM game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_game_state IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Check it's this player's turn
  IF v_current_turn IS NULL OR v_current_turn != p_user_id THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Generate random card: value 2-14 (14=Ace), suit 0-3
  v_card_value := 2 + floor(random() * 13)::INT;  -- 2 to 14
  v_card_suit := floor(random() * 4)::INT;         -- 0 to 3

  -- Record the draw
  v_draws := COALESCE(v_game_state->'currentDraws', '{}'::JSONB);
  v_draws := v_draws || jsonb_build_object(p_user_id::text, jsonb_build_object('value', v_card_value, 'suit', v_card_suit));
  v_game_state := jsonb_set(v_game_state, '{currentDraws}', v_draws);

  -- Build list of joined players
  v_players := v_game_state->'players';
  
  -- Check if all joined players have drawn
  v_all_drawn := TRUE;
  v_next_turn := NULL;
  
  FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
    v_player := v_players->v_idx;
    IF v_player->>'status' = 'joined' THEN
      v_player_id := v_player->>'id';
      IF NOT v_draws ? v_player_id THEN
        v_all_drawn := FALSE;
        IF v_next_turn IS NULL THEN
          v_next_turn := v_player_id::UUID;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_all_drawn THEN
    -- Find winner(s) with highest card value
    v_max_val := 0;
    v_winners := ARRAY[]::UUID[];
    
    FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
      v_player := v_players->v_idx;
      IF v_player->>'status' = 'joined' THEN
        v_player_id := v_player->>'id';
        v_draw_val := ((v_draws->v_player_id)->>'value')::INT;
        IF v_draw_val > v_max_val THEN
          v_max_val := v_draw_val;
          v_winners := ARRAY[v_player_id::UUID];
        ELSIF v_draw_val = v_max_val THEN
          v_winners := v_winners || v_player_id::UUID;
        END IF;
      END IF;
    END LOOP;

    -- Award point if single winner
    IF array_length(v_winners, 1) = 1 THEN
      FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
        v_player := v_players->v_idx;
        IF (v_player->>'id')::UUID = v_winners[1] THEN
          v_players := jsonb_set(v_players, ARRAY[v_idx::text, 'score'], to_jsonb(((v_player->>'score')::INT) + 1));
          EXIT;
        END IF;
      END LOOP;
      v_game_state := jsonb_set(v_game_state, '{players}', v_players);
    END IF;

    UPDATE game_sessions
    SET game_state = v_game_state, current_turn = NULL
    WHERE id = p_session_id;
  ELSE
    -- Find next undrawn player in rotation order
    v_next_turn := NULL;
    DECLARE
      v_current_idx INT := -1;
      v_count INT := 0;
      v_joined_count INT := 0;
      v_joined_ids TEXT[];
    BEGIN
      FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
        v_player := v_players->v_idx;
        IF v_player->>'status' = 'joined' THEN
          v_joined_ids := v_joined_ids || (v_player->>'id');
          IF (v_player->>'id') = p_user_id::text THEN
            v_current_idx := v_joined_count;
          END IF;
          v_joined_count := v_joined_count + 1;
        END IF;
      END LOOP;

      FOR v_count IN 1..v_joined_count LOOP
        v_idx := (v_current_idx + v_count) % v_joined_count;
        IF NOT v_draws ? v_joined_ids[v_idx + 1] THEN
          v_next_turn := v_joined_ids[v_idx + 1]::UUID;
          EXIT;
        END IF;
      END LOOP;
    END;

    UPDATE game_sessions
    SET game_state = v_game_state, current_turn = v_next_turn
    WHERE id = p_session_id;
  END IF;

  RETURN v_game_state;
END;
$$;

-- Also add card-game to the RLS policy for game_sessions update
DROP POLICY IF EXISTS "Users can update game sessions they're part of" ON game_sessions;

CREATE POLICY "Users can update game sessions they're part of"
ON game_sessions
FOR UPDATE
USING (
  (created_by = auth.uid())
  OR (callee_id = auth.uid())
  OR (
    (game_type = ANY (ARRAY['trivia'::text, 'word-chain'::text, 'dice-roll'::text, 'rock-paper-scissors'::text, 'card-game'::text]))
    AND (EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = game_sessions.conversation_id
        AND conversation_participants.user_id = auth.uid()
    ))
  )
);

-- Create a join function for card game similar to dice roll
CREATE OR REPLACE FUNCTION public.join_card_game(p_session_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_game_state JSONB;
  v_players JSONB;
  v_idx INT;
BEGIN
  SELECT game_state INTO v_game_state
  FROM game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_game_state IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_players := v_game_state->'players';

  FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
    IF (v_players->v_idx->>'id') = p_user_id::text THEN
      v_players := jsonb_set(v_players, ARRAY[v_idx::text, 'status'], '"joined"');
      EXIT;
    END IF;
  END LOOP;

  v_game_state := jsonb_set(v_game_state, '{players}', v_players);

  UPDATE game_sessions
  SET game_state = v_game_state
  WHERE id = p_session_id;

  RETURN v_game_state;
END;
$$;
