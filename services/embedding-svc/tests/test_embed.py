import os
import subprocess
import time

import pytest
import requests


@pytest.fixture(scope="module")
def server():
    svc_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    proc = subprocess.Popen(["python", "app.py"], cwd=svc_path)
    time.sleep(1.5)
    yield
    proc.terminate()
    proc.wait()


def test_embed_empty_input(server):
    resp = requests.get("http://localhost:8000/embed")
    assert resp.status_code == 422


def test_embed_valid_user(server):
    resp = requests.get("http://localhost:8000/embed", params={"user_id": "1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == "1"
    assert len(body["vector"]) == 256
