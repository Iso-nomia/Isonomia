import pytest
from fastapi.testclient import TestClient
import numpy as np

from services.embedding import main, model


@pytest.fixture(autouse=True)
def patch_model(monkeypatch):
    class Dummy:
        def __getitem__(self, key):
            return np.ones(300)
        wv = property(lambda self: self)
    model.fasttext_model = Dummy()
    yield
    model.fasttext_model = None

client = TestClient(main.app)


def test_embed_empty():
    resp = client.post("/embed", json={"user_id": "123e4567-e89b-42d3-a456-426614174000", "interests": []})
    assert resp.status_code == 422


def test_embed_valid():
    resp = client.post(
        "/embed",
        json={"user_id": "123e4567-e89b-42d3-a456-426614174000", "interests": ["ai", "music"]},
    )
    assert resp.status_code == 200
    vec = resp.json()["vector"]
    assert len(vec) == 256
    assert all(-1 <= v <= 1 for v in vec)
