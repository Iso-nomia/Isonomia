import numpy as np
import pandas as pd
from ml import offline_train_ranker as train


def build_df():
    data = []
    for vid in range(3):
        for cid in range(5):
            label = 1 if cid == 0 else 0
            data.append({
                "viewer_id": vid,
                "candidate_id": f"c{vid}-{cid}",
                "label": label,
                "f1": float(cid),
                "f2": float(cid % 2),
            })
    return pd.DataFrame(data)


def test_training_high_ndcg():
    df = build_df()
    model, fmap, ndcg = train.train_ranker(df)
    assert ndcg > 0.9
    assert "f1" in fmap
