from fastapi.testclient import TestClient
from services.embedding.main import app

client = TestClient(app)

def test_health():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
