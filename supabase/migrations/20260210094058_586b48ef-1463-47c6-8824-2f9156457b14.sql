
CREATE OR REPLACE FUNCTION public.join_dice_roll_game(p_session_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Find the player index and update their status
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
