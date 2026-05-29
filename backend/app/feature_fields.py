RATE_DEFAULT = 0.5
RANKING_DEFAULT = 50.0
COUNT_DEFAULT = 0.0

TEAM_FEATURE_FIELDS = [
    "win_rate_last10", "draw_rate_last10", "loss_rate_last10", "goals_scored_last10", "goals_conceded_last10", "xg_last10", "xga_last10", "clean_sheet_rate", "away_win_rate", "home_win_rate", "form_trend", "big_game_form", "scoring_first_rate", "win_when_scoring_first", "points_per_game",
    "fifa_ranking", "fifa_ranking_12m_ago", "avg_elo_top11", "avg_elo_squad", "bench_quality", "avg_squad_age", "players_top5_leagues", "players_cl_clubs", "squad_value", "top_scorer_goals", "top_scorer_available", "injured_players", "suspended_players", "goalkeeper_score", "set_piece_specialist",
    "manager_tournament_winrate", "manager_knockout_winrate", "manager_mustwin_rate", "manager_years_current", "manager_tournaments_total", "manager_vs_top20", "manager_tactical_flex", "manager_goals_scored_avg", "manager_goals_conceded_avg", "manager_wc_experience",
    "wc_appearances", "wc_last_result", "wc_winrate_last3", "wc_goals_scored_avg", "wc_goals_conceded_avg", "wc_clean_sheet_rate", "wc_vs_expectations", "wc_consecutive_appearances", "wc_best_finish", "wc_years_since_group_exit",
    "h2h_alltime_winrate", "h2h_last5_winrate", "h2h_goals_scored", "h2h_goals_conceded", "h2h_wc_winrate", "h2h_neutral_winrate", "h2h_last_result", "h2h_last_score", "h2h_psychological_edge", "h2h_trend",
    "group_difficulty", "rest_days", "opponent_rest_days", "travel_distance", "opponent_travel_distance", "venue_altitude", "climate_similarity", "timezone_diff", "match_importance", "elimination_pressure", "crowd_support", "venue_previous_matches", "group_position", "goal_difference", "points_needed",
    "avg_km_per_game", "avg_sprints", "squad_injury_rate", "days_since_last_match", "games_last30_days", "players_under23", "players_90caps", "players_0to10caps", "avg_club_minutes", "warmup_results",
    "avg_possession", "press_intensity", "counter_attack_rate", "set_piece_conversion", "set_piece_conceded", "avg_shots", "avg_shots_on_target", "avg_tackles", "avg_yellows", "penalty_shootout_record",
    "user_confidence", "user_gut_feeling", "bias_vs_model", "user_accuracy", "emotional_investment",
]

RATE_FIELDS = {name for name in TEAM_FEATURE_FIELDS if any(token in name for token in ["rate", "winrate", "clean_sheet", "conversion", "possession", "confidence", "feeling", "accuracy", "investment", "edge", "trend", "flex", "available", "similarity", "pressure", "support", "importance", "record", "form"])}
RANKING_FIELDS = {"fifa_ranking", "fifa_ranking_12m_ago"}

def default_for_feature(name: str) -> float:
    if name in RANKING_FIELDS:
        return RANKING_DEFAULT
    if name in RATE_FIELDS:
        return RATE_DEFAULT
    return COUNT_DEFAULT
