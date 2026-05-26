
CREATE OR REPLACE FUNCTION public.roll_dice_game(p_session_id UUID, p_user_id UUID, p_value INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_state JSONB;
  v_current_turn UUID;
  v_rolls JSONB;
  v_players JSONB;
  v_joined_players JSONB;
  v_all_rolled BOOLEAN;
  v_next_turn UUID;
  v_max_val INT;
  v_winners UUID[];
  v_idx INT;
  v_player JSONB;
  v_player_id TEXT;
  v_roll_val INT;
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

  -- Record the roll
  v_rolls := COALESCE(v_game_state->'currentRolls', '{}'::JSONB);
  v_rolls := v_rolls || jsonb_build_object(p_user_id::text, p_value);
  v_game_state := jsonb_set(v_game_state, '{currentRolls}', v_rolls);

  -- Build list of joined players
  v_players := v_game_state->'players';
  
  -- Check if all joined players have rolled
  v_all_rolled := TRUE;
  v_next_turn := NULL;
  
  FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
    v_player := v_players->v_idx;
    IF v_player->>'status' = 'joined' THEN
      v_player_id := v_player->>'id';
      IF NOT v_rolls ? v_player_id THEN
        v_all_rolled := FALSE;
        -- Pick the first unrolled player after current player as next turn
        IF v_next_turn IS NULL THEN
          v_next_turn := v_player_id::UUID;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_all_rolled THEN
    -- Find winner(s) with highest roll
    v_max_val := 0;
    v_winners := ARRAY[]::UUID[];
    
    FOR v_idx IN 0..jsonb_array_length(v_players) - 1 LOOP
      v_player := v_players->v_idx;
      IF v_player->>'status' = 'joined' THEN
        v_player_id := v_player->>'id';
        v_roll_val := (v_rolls->>v_player_id)::INT;
        IF v_roll_val > v_max_val THEN
          v_max_val := v_roll_val;
          v_winners := ARRAY[v_player_id::UUID];
        ELSIF v_roll_val = v_max_val THEN
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

    -- Set current_turn to null (round complete)
    UPDATE game_sessions
    SET game_state = v_game_state, current_turn = NULL
    WHERE id = p_session_id;
  ELSE
    -- Find next unrolled player in order starting after current player
    -- We need proper rotation, so find current player index first
    v_next_turn := NULL;
    DECLARE
      v_current_idx INT := -1;
      v_count INT := 0;
      v_joined_count INT := 0;
      v_joined_ids TEXT[];
    BEGIN
      -- Collect joined player IDs in order
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

      -- Find next unrolled starting after current
      FOR v_count IN 1..v_joined_count LOOP
        v_idx := (v_current_idx + v_count) % v_joined_count;
        IF NOT v_rolls ? v_joined_ids[v_idx + 1] THEN
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
