from typing import List
import numpy as np


def fetch_features(viewer_id: str, candidate_ids: List[str]) -> np.ndarray:
    """Placeholder feature store lookup.

    Production implementation should query Redis. Tests may monkeypatch this
    function to provide deterministic features.
    """
    rng = np.random.default_rng(abs(hash(viewer_id)) % 2**32)
    return rng.random((len(candidate_ids), 4), dtype=np.float32)
