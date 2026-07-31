from __future__ import annotations

import random
from collections import defaultdict
from typing import Any, Iterable

import math

from .feature_fields import TEAM_FEATURE_FIELDS, default_for_feature


class WorldCupPredictor:
    def __init__(self) -> None:
        self.feature_names = TEAM_FEATURE_FIELDS.copy()
        self.goal_scale = 1.0
        self.feature_weights = self._build_feature_weights()

    def _build_feature_weights(self) -> dict[str, float]:
        weights = {name: 1.0 for name in self.feature_names}
        for name in ["fifa_ranking", "fifa_ranking_12m_ago", "squad_value", "avg_elo_top11", "avg_elo_squad"]:
            weights[name] = 2.3
        for name in self.feature_names:
            if name.startswith("manager_") or name.startswith("h2h_"):
                weights[name] = 1.45
            if name in {"venue_altitude", "climate_similarity", "timezone_diff", "travel_distance", "rest_days", "avg_km_per_game", "avg_sprints", "squad_injury_rate"}:
                weights[name] = 0.75
        return weights

    def _value(self, obj: Any, name: str) -> float:
        value = obj.get(name) if isinstance(obj, dict) else getattr(obj, name, None)
        if value is None:
            return default_for_feature(name)
        try:
            return float(value)
        except (TypeError, ValueError):
            return default_for_feature(name)

    def build_feature_vector(self, team_data: Any, opponent_data: Any, context_data: dict[str, Any] | None = None) -> list[float]:
        context_data = context_data or {}
        values: list[float] = []
        for name in self.feature_names:
            if name in context_data and context_data[name] is not None:
                raw = float(context_data[name])
            elif name.startswith("opponent_"):
                raw = self._value(opponent_data, name.replace("opponent_", ""))
            else:
                raw = self._value(team_data, name)
            # Lower FIFA ranking is better, invert to an ability score.
            if name in {"fifa_ranking", "fifa_ranking_12m_ago"}:
                raw = max(0.0, 211.0 - raw) / 210.0
            elif name in {"squad_value"}:
                raw = min(raw / 1_500_000_000.0, 1.5)
            elif abs(raw) > 10:
                raw = raw / 100.0
            values.append(raw * self.feature_weights.get(name, 1.0))
        return values

    def _rating(self, team: Any) -> float:
        rank = self._value(team, "fifa_ranking")
        squad = self._value(team, "squad_value") / 1_000_000_000.0
        form = self._value(team, "win_rate_last10") - self._value(team, "loss_rate_last10") * 0.35
        elo = (self._value(team, "avg_elo_top11") or 50.0) / 100.0
        return max(0.25, (211.0 - rank) / 210.0 * 2.0 + squad * 0.4 + form + elo * 0.25)

    def predict_match(self, team_a_data: Any, team_b_data: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
        context = context or {}
        rating_a = self._rating(team_a_data)
        rating_b = self._rating(team_b_data)
        total = max(rating_a + rating_b, 0.1)
        form_a = 0.85 + self._value(team_a_data, "win_rate_last10") * 0.45 + self._value(team_a_data, "xg_last10") * 0.08
        form_b = 0.85 + self._value(team_b_data, "win_rate_last10") * 0.45 + self._value(team_b_data, "xg_last10") * 0.08
        h2h_a = 0.9 + self._value(team_a_data, "h2h_last5_winrate") * 0.2
        h2h_b = 0.9 + self._value(team_b_data, "h2h_last5_winrate") * 0.2
        venue_a = 1.0 + (self._value(team_a_data, "home_win_rate") - 0.5) * 0.12 + float(context.get("crowd_support", 0.5)) * 0.05
        venue_b = 1.0 + (self._value(team_b_data, "away_win_rate") - 0.5) * 0.08
        base_goals = 2.65
        lambda_a = min(max(base_goals * self.goal_scale * (rating_a / total) * form_a * h2h_a * venue_a, 0.15), 4.5)
        lambda_b = min(max(base_goals * self.goal_scale * (rating_b / total) * form_b * h2h_b * venue_b, 0.15), 4.5)

        matrix = [[0.0 for _ in range(7)] for _ in range(7)]
        for a in range(6):
            for b in range(6):
                matrix[a][b] = self._poisson(a, lambda_a) * self._poisson(b, lambda_b)
        matrix_total = sum(sum(row) for row in matrix) or 1.0
        matrix = [[value / matrix_total for value in row] for row in matrix]
        win_prob_a = sum(matrix[a][b] for a in range(7) for b in range(7) if a > b)
        draw_prob = sum(matrix[i][i] for i in range(7))
        win_prob_b = sum(matrix[a][b] for a in range(7) for b in range(7) if b > a)
        best = max(((a, b) for a in range(7) for b in range(7)), key=lambda pair: matrix[pair[0]][pair[1]])
        predicted_winner = "Draw"
        if win_prob_a > max(draw_prob, win_prob_b):
            predicted_winner = getattr(team_a_data, "name", None) or team_a_data.get("name")
        elif win_prob_b > max(draw_prob, win_prob_a):
            predicted_winner = getattr(team_b_data, "name", None) or team_b_data.get("name")
        if context.get("stage") not in {None, "group"}:
            # A knockout match must produce an advancing team. Split regulation
            # draw probability evenly as a deliberately simple extra-time proxy.
            predicted_winner = (
                getattr(team_a_data, "name", None) or team_a_data.get("name")
                if win_prob_a >= win_prob_b
                else getattr(team_b_data, "name", None) or team_b_data.get("name")
            )
        confidence = float(max(win_prob_a, draw_prob, win_prob_b) - sorted([win_prob_a, draw_prob, win_prob_b])[-2])
        return {
            "predicted_score_a": round(float(lambda_a), 2),
            "predicted_score_b": round(float(lambda_b), 2),
            "win_prob_a": round(win_prob_a, 4),
            "draw_prob": round(draw_prob, 4),
            "win_prob_b": round(win_prob_b, 4),
            "confidence_score": round(confidence, 4),
            "predicted_winner": predicted_winner,
            "most_likely_scoreline": f"{best[0]}-{best[1]}",
        }

    @staticmethod
    def _poisson(goals: int, expected: float) -> float:
        return math.exp(-expected) * expected**goals / math.factorial(goals)

    def simulate_tournament(self, all_teams: Iterable[Any], all_matches: Iterable[Any], iterations: int = 1000) -> dict[str, dict[str, float]]:
        teams = list(all_teams)
        matches = list(all_matches)
        if not teams:
            return {}
        iterations = min(max(iterations, 100), 5000)
        counts = {self._team_name(t): defaultdict(int) for t in teams}
        team_by_name = {self._team_name(t): t for t in teams}
        group_map: dict[str, list[str]] = defaultdict(list)
        for team in teams:
            group_map[getattr(team, "group_name", None) or team.get("group_name") or "All"].append(self._team_name(team))

        for _ in range(iterations):
            standings: dict[str, dict[str, Any]] = {name: {"pts": 0, "gd": 0, "gf": 0} for name in team_by_name}
            for match in [m for m in matches if getattr(m, "stage", "group") == "group"]:
                a, b = match.team_a, match.team_b
                if a not in team_by_name or b not in team_by_name:
                    continue
                res = self.predict_match(team_by_name[a], team_by_name[b], {})
                score_a = self._sample_poisson(res["predicted_score_a"])
                score_b = self._sample_poisson(res["predicted_score_b"])
                standings[a]["gf"] += score_a
                standings[b]["gf"] += score_b
                standings[a]["gd"] += score_a - score_b
                standings[b]["gd"] += score_b - score_a
                if score_a > score_b:
                    standings[a]["pts"] += 3
                elif score_b > score_a:
                    standings[b]["pts"] += 3
                else:
                    standings[a]["pts"] += 1
                    standings[b]["pts"] += 1
            qualifiers: list[str] = []
            thirds: list[str] = []
            for names in group_map.values():
                ranked = sorted(names, key=lambda n: (standings[n]["pts"], standings[n]["gd"], standings[n]["gf"], random.random()), reverse=True)
                qualifiers.extend(ranked[:2])
                thirds.extend(ranked[2:3])
            qualifiers.extend(sorted(thirds, key=lambda n: (standings[n]["pts"], standings[n]["gd"], standings[n]["gf"]), reverse=True)[:8])
            qualifiers = qualifiers[:32]
            for q in qualifiers:
                counts[q]["advanced"] += 1
            alive = qualifiers
            while len(alive) > 1:
                next_round = []
                for i in range(0, len(alive), 2):
                    if i + 1 >= len(alive):
                        next_round.append(alive[i])
                        continue
                    winner = self._simulate_knockout(team_by_name[alive[i]], team_by_name[alive[i + 1]])
                    next_round.append(winner)
                alive = next_round
                if len(alive) == 4:
                    for team in alive:
                        counts[team]["semifinalist"] += 1
                if len(alive) == 2:
                    for team in alive:
                        counts[team]["finalist"] += 1
            if alive:
                counts[alive[0]]["winner"] += 1
        return {team: {
            "win_probability": counts[team]["winner"] / iterations,
            "finalist_probability": counts[team]["finalist"] / iterations,
            "semifinalist_probability": counts[team]["semifinalist"] / iterations,
            "group_exit_probability": 1.0 - counts[team]["advanced"] / iterations,
        } for team in counts}

    @staticmethod
    def _sample_poisson(expected: float) -> int:
        threshold = math.exp(-expected)
        product = 1.0
        value = -1
        while product > threshold:
            value += 1
            product *= random.random()
        return max(value, 0)

    def _team_name(self, team: Any) -> str:
        return getattr(team, "name", None) or team.get("name")

    def _simulate_knockout(self, a: Any, b: Any) -> str:
        pred = self.predict_match(a, b, {})
        probs = [pred["win_prob_a"], pred["draw_prob"], pred["win_prob_b"]]
        draw_split = probs[1] / 2.0
        return self._team_name(a) if random.random() < probs[0] + draw_split else self._team_name(b)

    def get_feature_importance(self) -> dict[str, float]:
        total = sum(self.feature_weights.values()) or 1.0
        return {name: weight / total for name, weight in self.feature_weights.items()}

    def apply_bias(self, prediction: dict[str, Any], user_confidence: float, user_gut: str, emotional_investment: float) -> dict[str, Any]:
        shift = 0.0 if user_confidence < 5 else (0.07 if user_confidence < 8 else 0.15)
        shift *= 1.0 + min(max(emotional_investment, 0), 10) / 50.0
        probs = {
            "A": float(prediction["win_prob_a"]),
            "Draw": float(prediction["draw_prob"]),
            "B": float(prediction["win_prob_b"]),
        }
        gut = user_gut if user_gut in probs else {"home": "A", "draw": "Draw", "away": "B"}.get(user_gut.lower(), "Draw")
        before = probs[gut]
        for key in probs:
            probs[key] *= 1.0 - shift
        probs[gut] += shift
        total = sum(probs.values()) or 1.0
        probs = {key: value / total for key, value in probs.items()}
        return {
            **prediction,
            "win_prob_a": round(probs["A"], 4),
            "draw_prob": round(probs["Draw"], 4),
            "win_prob_b": round(probs["B"], 4),
            "bias_delta": round(probs[gut] - before, 4),
        }
