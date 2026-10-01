from datetime import datetime, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.database import LocalDatabase

ORIGIN = "https://church.test"
PASSWORD = "Test-only-password-2026"


@pytest.fixture
def church(tmp_path, monkeypatch):
    monkeypatch.setenv("SETUP_TOKEN", "disposable-setup-secret")
    monkeypatch.setenv("APP_ORIGIN", ORIGIN)
    from backend.security import launch_allowed

    monkeypatch.setattr(
        "backend.app.launch_allowed",
        lambda deadline: launch_allowed(
            deadline, datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
        ),
    )
    db = LocalDatabase(tmp_path / "test.sqlite")
    db.migrate()
    app = create_app(db)
    with TestClient(app, base_url=ORIGIN) as admin:
        post = lambda client, body: client.post(
            "/api/system", json=body, headers={"origin": ORIGIN}
        )
        result = post(
            admin,
            {
                "action": "setup",
                "token": "disposable-setup-secret",
                "email": "owner@example.test",
                "name": "Owner",
                "password": PASSWORD,
            },
        )
        assert result.status_code == 200, result.text
        yield app, admin, post
    db.connection.close()


def save(admin, post, kind, data, ministry=""):
    response = post(
        admin, {"action": "save", "kind": kind, "ministry": ministry, "data": data}
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def account(app, admin, post, role, ministry="", allowed=False):
    email = f"{role}-{ministry[:5]}@example.test"
    response = post(
        admin,
        {
            "action": "user",
            "data": {
                "name": role,
                "email": email,
                "password": PASSWORD,
                "role": role,
                "ministry": ministry,
                "financeAccess": allowed,
            },
        },
    )
    assert response.status_code == 200, response.text
    user = next(
        u for u in admin.get("/api/system").json()["users"] if u["email"] == email
    )
    client = TestClient(app, base_url=ORIGIN)
    assert (
        post(
            client, {"action": "login", "email": email, "password": PASSWORD}
        ).status_code
        == 200
    )
    return user, client


def test_private_api_and_csrf(church):
    app, admin, post = church
    guest = TestClient(app, base_url=ORIGIN)
    assert guest.get("/api/system").json() == {"user": None, "setup": False}
    assert (
        post(
            guest, {"action": "save", "kind": "ministries", "data": {"name": "Test"}}
        ).status_code
        == 401
    )
    assert (
        admin.post(
            "/api/system",
            json={"action": "logout"},
            headers={"origin": "https://attacker.test"},
        ).status_code
        == 403
    )
    assert guest.get("/openapi.json").status_code != 200
    assert "httponly" in admin.cookies.__repr__().lower() or admin.cookies.get(
        "church_session"
    )
    assert admin.get("/api/system").headers["cache-control"] == "no-store"


def test_individual_authorization_scope_and_revocation(church):
    app, admin, post = church
    m1 = save(admin, post, "ministries", {"name": "Louvor"})
    m2 = save(admin, post, "ministries", {"name": "Jovens"})
    save(
        admin,
        post,
        "incomes",
        {
            "name": "Doações",
            "date": "2026-09-30",
            "amount": 10000,
            "category": "Ofertas",
        },
        m1,
    )
    save(
        admin,
        post,
        "incomes",
        {
            "name": "Outra entrada",
            "date": "2026-09-30",
            "amount": 50000,
            "category": "Ofertas",
        },
        m2,
    )
    for role in ["treasury", "presbytery", "member", "ministry"]:
        u, c = account(app, admin, post, role, m1)
        state = c.get("/api/system").json()
        assert not state["user"]["canFinance"] and state["data"]["incomes"] == []
        assert (
            post(
                c, {"action": "setFinanceAccess", "id": u["id"], "allowed": True}
            ).status_code
            == 403
        )
        assert (
            post(
                admin, {"action": "setFinanceAccess", "id": u["id"], "allowed": True}
            ).status_code
            == 200
        )
        assert c.get("/api/system").json()["user"] is None
        assert (
            post(
                c, {"action": "login", "email": u["email"], "password": PASSWORD}
            ).status_code
            == 200
        )
        state = c.get("/api/system").json()
        assert len(state["data"]["incomes"]) == (
            2 if role in ["treasury", "presbytery"] else 1
        )
        if role in ["member", "ministry"]:
            assert {r["ministry"] for r in state["data"]["incomes"]} == {m1}
        assert (
            post(
                admin, {"action": "setFinanceAccess", "id": u["id"], "allowed": False}
            ).status_code
            == 200
        )
        assert c.get("/api/system").json()["user"] is None


def test_only_owner_manages_permissions(church):
    app, admin, post = church
    u, c = account(app, admin, post, "admin")
    assert c.get("/api/system").json()["users"] == []
    assert post(c, {"action": "user", "data": {}}).status_code == 403
    owner = admin.get("/api/system").json()["user"]
    assert post(admin, {"action": "disableUser", "id": owner["id"]}).status_code == 403


def test_itemized_request_approval_reservation_and_expense_cap(church):
    app, admin, post = church
    ministry = save(admin, post, "ministries", {"name": "Louvor"})
    save(admin, post, "settings", {"deadline": 31})
    save(
        admin,
        post,
        "budgets",
        {"year": 2026, "month": 9, "area": "Equipamentos", "amount": 10000},
        ministry,
    )
    u, c = account(app, admin, post, "ministry", ministry, True)
    payload = {
        "name": "Microfone",
        "date": "2026-09-30",
        "area": "Equipamentos",
        "amount": 7000,
        "justification": "Reposição para uso nos cultos da igreja.",
        "objective": "Melhorar o áudio nos cultos.",
        "items": [{"description": "Microfone", "category": "Som", "amount": 7000}],
    }
    bad = {**payload, "amount": 6000}
    assert (
        post(
            c, {"action": "save", "kind": "requests", "ministry": ministry, "data": bad}
        ).status_code
        == 400
    )
    request = save(c, post, "requests", payload, ministry)
    assert (
        post(
            c, {"action": "decideRequest", "id": request, "decision": "Aprovado"}
        ).status_code
        == 403
    )
    assert (
        post(
            admin, {"action": "decideRequest", "id": request, "decision": "Aprovado"}
        ).status_code
        == 200
    )
    request2 = save(c, post, "requests", payload, ministry)
    assert (
        post(
            admin, {"action": "decideRequest", "id": request2, "decision": "Aprovado"}
        ).status_code
        == 409
    )
    assert (
        post(
            admin, {"action": "decideRequest", "id": request, "decision": "Aprovado"}
        ).status_code
        == 409
    )
    expense = {
        "name": "Compra microfone",
        "date": "2026-09-30",
        "area": "Equipamentos",
        "amount": 5000,
        "justification": "Compra conforme pedido autorizado.",
        "requestId": request,
        "items": [{"description": "Microfone", "category": "Som", "amount": 5000}],
    }
    save(admin, post, "expenses", expense, ministry)
    assert (
        post(
            admin,
            {
                "action": "save",
                "kind": "expenses",
                "ministry": ministry,
                "data": expense,
            },
        ).status_code
        == 409
    )
    assert (
        post(
            admin,
            {
                "action": "decideRequest",
                "id": request2,
                "decision": "Rejeitado",
                "comment": "Fora do orçamento disponível.",
            },
        ).status_code
        == 200
    )
    assert len(admin.get("/api/system").json()["data"]["expenses"]) == 1


def test_cutoff_and_hidden_event_amount(church):
    app, admin, post = church
    ministry = save(admin, post, "ministries", {"name": "Louvor"})
    event = {
        "name": "Culto especial",
        "date": "2026-09-30",
        "responsible": "Equipe",
        "amount": 7000,
    }
    save(admin, post, "events", event, ministry)
    u, c = account(app, admin, post, "ministry", ministry)
    assert "amount" not in c.get("/api/system").json()["data"]["events"][0]
    save(admin, post, "settings", {"deadline": 1})
    assert (
        post(
            c,
            {
                "action": "save",
                "kind": "events",
                "ministry": ministry,
                "data": {**event, "amount": 0},
            },
        ).status_code
        == 403
    )


def test_login_rate_limit(church):
    app, admin, post = church
    guest = TestClient(app, base_url=ORIGIN)
    for _ in range(5):
        assert (
            post(
                guest,
                {"action": "login", "email": "owner@example.test", "password": "wrong"},
            ).status_code
            == 401
        )
    assert (
        post(
            guest,
            {"action": "login", "email": "owner@example.test", "password": PASSWORD},
        ).status_code
        == 429
    )


def test_annual_cap_applies_even_when_monthly_budget_exists(church):
    app, admin, post = church
    ministry = save(admin, post, "ministries", {"name": "Jovens"})
    save(admin, post, "settings", {"deadline": 31})
    save(
        admin,
        post,
        "budgets",
        {"year": 2026, "month": 9, "area": "Culto", "amount": 10000},
        ministry,
    )
    save(
        admin,
        post,
        "budgets",
        {"year": 2026, "month": 0, "area": "Culto", "amount": 5000},
        ministry,
    )
    u, c = account(app, admin, post, "ministry", ministry, True)
    request = save(
        c,
        post,
        "requests",
        {
            "name": "Encontro",
            "date": "2026-09-30",
            "area": "Culto",
            "amount": 6000,
            "justification": "Materiais para a realização do encontro de jovens.",
            "objective": "Apoiar o encontro de jovens.",
            "items": [
                {"description": "Material", "category": "Papelaria", "amount": 6000}
            ],
        },
        ministry,
    )
    assert (
        post(
            admin, {"action": "decideRequest", "id": request, "decision": "Aprovado"}
        ).status_code
        == 409
    )
    state = admin.get("/api/system").json()
    assert state["data"]["requests"][0]["status"] == "Pendente"
    assert not any(a["action"] == "decidiu pedido" for a in state["audit"])
