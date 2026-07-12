import argparse
import json
import os
from datetime import date

import lightgbm as lgb
import mlflow
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import ndcg_score


def group_counts(groups, indices):
    uniques, counts = np.unique(groups[indices], return_counts=True)
    return counts.tolist()


def compute_ndcg(groups, labels, preds, k=10):
    scores = []
    for g in np.unique(groups):
        mask = groups == g
        scores.append(ndcg_score([labels[mask]], [preds[mask]], k=k))
    return float(np.mean(scores))


def train_ranker(df: pd.DataFrame):
    labels = df.pop("label").to_numpy()
    viewer_ids = df.pop("viewer_id").to_numpy()
    df.pop("candidate_id")
    feature_map = {c: i for i, c in enumerate(df.columns)}
    X = df.to_numpy(dtype=np.float32)

    splitter = GroupShuffleSplit(test_size=0.2, n_splits=1, random_state=42)
    train_idx, val_idx = next(splitter.split(X, labels, groups=viewer_ids))

    train_group = group_counts(viewer_ids, train_idx)
    val_group = group_counts(viewer_ids, val_idx)

    model = lgb.LGBMRanker(
        objective="lambdarank",
        metric="ndcg@10",
        num_leaves=255,
        n_estimators=300,
        learning_rate=0.05,
        max_depth=-1,
        min_data_in_bin=1,
        min_data_in_leaf=1,
    )
    model.fit(
        X[train_idx],
        labels[train_idx],
        group=train_group,
        eval_set=[(X[val_idx], labels[val_idx])],
        eval_group=[val_group],
    )
    preds = model.predict(X[val_idx])
    ndcg = compute_ndcg(viewer_ids[val_idx], labels[val_idx], preds)
    return model.booster_, feature_map, ndcg


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="/data/training/features.parquet")
    parser.add_argument("--output", default="models")
    args = parser.parse_args()

    df = pd.read_parquet(args.input)
    model, feature_map, ndcg = train_ranker(df)

    baseline = float(os.getenv("BASELINE_NDCG", "0"))
    if baseline and ndcg < baseline * 1.01:
        raise SystemExit(f"NDCG@10 {ndcg:.3f} below required improvement over {baseline:.3f}")

    os.makedirs(args.output, exist_ok=True)
    today = date.today().isoformat()
    model_path = os.path.join(args.output, f"ranker_v{today}.txt")
    model.save_model(model_path)
    fmap_path = os.path.join(args.output, "feature_map.json")
    with open(fmap_path, "w") as f:
        json.dump(feature_map, f)

    mlflow.set_experiment("DiscoveryRanker")
    with mlflow.start_run() as run:
        mlflow.log_metric("ndcg_at_10", ndcg)
        mlflow.log_artifact(model_path)
        mlflow.log_artifact(fmap_path)
        mlflow.set_tag("model_path", model_path)

    print(f"Saved model to {model_path} with NDCG@10={ndcg:.3f}")


if __name__ == "__main__":
    main()
