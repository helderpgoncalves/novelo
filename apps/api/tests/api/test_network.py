import httpx


async def test_data_routes_require_login(client: httpx.AsyncClient) -> None:
    for path in ("textile/baseline", "network/circuits", "network/fleet", "datasets/quality"):
        resp = await client.get(f"/api/v1/{path}")
        assert resp.status_code == 401 and resp.json()["code"] == "unauthenticated"


async def test_circuits_summary_matches_vitrus_file(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/network/circuits")).json()
    assert body["total"] == 40
    assert body["without_vehicle"] == 9
    assert body["vehicles"] == 29
    assert body["vehicles_never_assigned"] == ["29-48-XU", "74-HN-36"]
    c7 = next(c for c in body["circuits"] if c["code"] == "C7")
    assert c7["weekdays"] == [2, 4, 6]  # "3ª, 5ª & SAB"
    assert c7["typology"] == "undifferentiated" and c7["collection_type"] == "door_to_door"


async def test_fleet_matches_summary_sheet(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/network/fleet")).json()
    by_typology = {t["typology"]: t for t in body["typologies"]}
    organic = by_typology["organic"]
    assert organic["circuits"] == 7 and organic["circuits_without_vehicle"] == 1
    assert organic["vehicle_shifts_week"] == 8 and organic["crew_shifts_week"] == 23
    assert organic["fleet_vehicles"] == 6 and organic["fleet_crew"] == 12
    assert by_typology["undifferentiated"]["fleet_crew"] == 72
    assert body["total_assignments"] == 101
    assert body["total_crew_shifts_week"] == 101  # TOTAL de tripulantes-turno da folha Resumo
    never = {v["plate"] for v in body["vehicles"] if v["never_assigned"]}
    assert never == {"29-48-XU", "74-HN-36"}
    assert next(v for v in body["vehicles"] if v["plate"] == "60-93-ZG")["multi_typology"] is True


async def test_localities_expose_service_frequency(logged_in: httpx.AsyncClient) -> None:
    body = (await logged_in.get("/api/v1/network/localities")).json()
    assert len(body) >= 80
    ronfe = next(x for x in body if x["name"] == "Ronfe")
    assert "C18" in ronfe["circuits"] and ronfe["days_per_week"] >= 3


async def test_containers_empty_until_locations_arrive(logged_in: httpx.AsyncClient) -> None:
    assert (await logged_in.get("/api/v1/network/containers")).json() == {"items": [], "total": 0}


async def test_data_quality_alerts_workflow(logged_in: httpx.AsyncClient) -> None:
    quality = (await logged_in.get("/api/v1/datasets/quality")).json()
    assert len(quality["alerts"]) == 12 and quality["open_alerts"] == 12
    assert {s["key"] for s in quality["sources"]} == {"vitrus_textile_2025", "vitrus_circuits_2026_09"}
    alert = quality["alerts"][0]

    resolved = await logged_in.patch(
        f"/api/v1/datasets/alerts/{alert['id']}",
        json={"status": "resolved", "resolution_note": "Confirmado com a Vitrus"},
    )
    assert resolved.status_code == 200 and resolved.json()["status"] == "resolved" and resolved.json()["resolved_at"]
    reopened = await logged_in.patch(f"/api/v1/datasets/alerts/{alert['id']}", json={"status": "open"})
    assert reopened.json()["resolved_at"] is None
