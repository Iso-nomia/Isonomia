from fastapi.testclient import TestClient

import api.embed as embed


class DummyConn:
    def __init__(self, row):
        self.row = row
        self.saved = None

    async def fetchrow(self, *args, **kwargs):
        return self.row

    async def execute(self, *args):
        self.saved = args[1]

    async def close(self):
        pass


def test_embed_existing_returns_cached(monkeypatch):
    row = {"title": "t", "description": "d", "tags": ["x"], "embedding": [1.0]}
    conn = DummyConn(row)

    async def get_db():
        return conn

    monkeypatch.setattr(embed, "get_db", get_db)

    called = False

    async def create_embedding(text: str):
        nonlocal called
        called = True
        return [0.0]

    monkeypatch.setattr(embed, "create_embedding", create_embedding)

    client = TestClient(embed.app)
    resp = client.post("/api/embed", json={"mediaId": "1"})
    assert resp.status_code == 200
    assert resp.json()["cached"] is True
    assert resp.json()["embedding"] == [1.0]
    assert called is False


def test_embed_creates_and_saves(monkeypatch):
    row = {"title": "t", "description": "d", "tags": ["a", "b", "c"], "embedding": None}
    conn = DummyConn(row)

    async def get_db():
        return conn

    monkeypatch.setattr(embed, "get_db", get_db)

    async def create_embedding(text: str):
        return [0.1] * 768

    monkeypatch.setattr(embed, "create_embedding", create_embedding)

    client = TestClient(embed.app)
    resp = client.post("/api/embed", json={"mediaId": "1"})
    assert resp.status_code == 200
    assert resp.json()["cached"] is False
    assert isinstance(conn.saved, list) and len(conn.saved) == 768
