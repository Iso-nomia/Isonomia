import os
import subprocess
import time
from datetime import datetime

import pandas as pd
import pytest
from feast import FeatureStore


@pytest.fixture(scope="module")
def redis_server():
    proc = subprocess.Popen(["redis-server", "--port", "6379", "--save", ""], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(0.5)
    yield proc
    proc.terminate()
    proc.wait()


def test_ingest_and_retrieve(redis_server):
    repo_path = os.path.join(os.path.dirname(__file__), "..")
    registry_path = os.path.join(repo_path, "data", "registry.db")
    if not os.path.exists(registry_path):
        os.makedirs(os.path.dirname(registry_path), exist_ok=True)
        open(registry_path, "wb").close()
    store = FeatureStore(repo_path=repo_path)
    import importlib.util
    spec = importlib.util.spec_from_file_location("feature_repo", os.path.join(repo_path, "feature_repo.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    store.apply([module.user, module.user_features])
    store.materialize_incremental(end_date=datetime.utcnow())

    resp = store.get_online_features(
        features=["user_features:avg_session_dwell_sec_7d"],
        entity_rows=[{"user_id": 1}],
    ).to_dict()
    assert resp["avg_session_dwell_sec_7d"][0] == 12.5
