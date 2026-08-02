from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import event

from backend.app.database import engine
from backend.app.main import app, prediction_service, recalibration_service
from backend.app.seed import load_dataset


def test_offline_dataset_integrity() -> None:
    dataset = load_dataset()
    names = {team["name"] for team in dataset["teams"]}
    assert len(names) == 48
    assert len(dataset["matches"]) == 104
    assert {match["id"] for match in dataset["matches"]} == set(range(1, 105))
    assert all(match["a"] in names and match["b"] in names and match["a"] != match["b"] for match in dataset["matches"])
    for group in "ABCDEFGHIJKL":
        group_teams = {team["name"] for team in dataset["teams"] if team["group"] == group}
        group_matches = [match for match in dataset["matches"] if match.get("group") == group]
        assert len(group_teams) == 4
        assert len(group_matches) == 6
        assert {match["a"] for match in group_matches} | {match["b"] for match in group_matches} == group_teams


def test_health_and_metadata() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ok"
        assert payload["database"] == {"connected": True, "teams": 48, "matches": 104}
        assert payload["mode"] == "offline-ready"

        metadata = client.get("/meta").json()
        assert metadata["dataset_type"] == "verified_historical_results"
        assert "Independent" in metadata["disclaimer"]
        assert metadata["model_input_note"].startswith("strength_rank")

        allowed = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3001",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:3001"
        denied = client.options(
            "/health",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" not in denied.headers


def test_prediction_accuracy_and_team_flows() -> None:
    with TestClient(app) as client:
        teams = client.get("/teams")
        assert teams.status_code == 200
        assert len(teams.json()) == 48

        response = client.get("/predictions")
        assert response.status_code == 200
        predictions = response.json()
        assert len(predictions) == 104
        first = predictions[0]
        assert first["actual_score_a"] == 2
        assert first["actual_score_b"] == 0
        assert first["result_source"] == "FIFA verified historical result"
        assert abs(first["win_prob_a"] + first["draw_prob"] + first["win_prob_b"] - 1) < 0.001

        assert client.get(f"/predictions/{first['match_id']}").status_code == 200
        missing = client.get("/predictions/999999")
        assert missing.status_code == 404
        assert missing.json()["detail"] == "Match not found"

        accuracy = client.get("/accuracy")
        assert accuracy.status_code == 200
        assert accuracy.json()["total_predictions"] == 104


def test_prediction_generation_uses_bulk_match_and_team_queries() -> None:
    statements: list[str] = []

    def record_statement(
        _connection, _cursor, statement, _parameters, _context, _executemany
    ) -> None:
        statements.append(" ".join(statement.lower().split()))

    with TestClient(app) as client:
        prediction_service.invalidate_cache()
        recalibration_service.invalidate_cache()
        event.listen(engine, "before_cursor_execute", record_statement)
        try:
            response = client.get("/predictions")
        finally:
            event.remove(engine, "before_cursor_execute", record_statement)

    assert response.status_code == 200
    assert len(response.json()) == 104
    match_queries = [
        statement for statement in statements if " from matches " in statement
    ]
    team_queries = [
        statement for statement in statements if " from teams " in statement
    ]
    assert len(match_queries) == 1
    assert len(team_queries) == 1


def test_accuracy_reuses_predictions_already_generated() -> None:
    with TestClient(app) as client:
        prediction_service.invalidate_cache()
        recalibration_service.invalidate_cache()
        with patch.object(
            prediction_service.predictor,
            "predict_match",
            wraps=prediction_service.predictor.predict_match,
        ) as predict_match:
            predictions = client.get("/predictions")
            calls_after_predictions = predict_match.call_count
            accuracy = client.get("/accuracy")

    assert predictions.status_code == 200
    assert calls_after_predictions == 104
    assert accuracy.status_code == 200
    assert accuracy.json()["total_predictions"] == 104
    assert predict_match.call_count == calls_after_predictions


def test_bias_manual_result_recalibration_and_validation() -> None:
    with TestClient(app) as client:
        match = client.get("/predictions").json()[0]
        bias_payload = {
            "match_id": match["match_id"],
            "user_prediction": match["team_a"],
            "user_confidence": 8,
            "emotional_investment": 4,
        }
        saved = client.post("/bias", json=bias_payload)
        assert saved.status_code == 200
        assert saved.json()["user_prediction"] == match["team_a"]
        assert client.get("/bias").json()["total_bias_predictions"] >= 1

        invalid_pick = client.post("/bias", json={**bias_payload, "user_prediction": "Not a team"})
        assert invalid_pick.status_code == 422
        missing_match = client.post("/bias", json={**bias_payload, "match_id": 999999})
        assert missing_match.status_code == 404
        invalid_range = client.post("/bias", json={**bias_payload, "user_confidence": 11})
        assert invalid_range.status_code == 422

        manual = client.post(
            "/results/manual",
            json={"match_id": match["match_id"], "score_a": 1, "score_b": 2},
        )
        assert manual.status_code == 200
        assert manual.json()["actual_winner"] == match["team_b"]
        assert client.post("/results/manual", json={"match_id": 999999, "score_a": 0, "score_b": 0}).status_code == 404
        assert client.post("/results/manual", json={"match_id": match["match_id"], "score_a": -1, "score_b": 0}).status_code == 422

        recalibration = client.post("/recalibrate")
        assert recalibration.status_code == 200
        assert recalibration.json()["matches_used"] == 104


def test_simulation_cache_and_offline_sync_error() -> None:
    with TestClient(app) as client:
        first = client.get("/tournament/simulate?iterations=100")
        assert first.status_code == 200
        assert len(first.json()) == 48
        second = client.get("/tournament/simulate?iterations=100")
        assert second.json() == first.json()
        assert client.get("/tournament/simulate?iterations=99").status_code == 422

        sync = client.post("/results/sync")
        assert sync.status_code == 503
        assert "offline replay remains available" in sync.json()["detail"]
