import json
import os
import time
from typing import List

import lightgbm as lgb
import numpy as np
from fastapi import FastAPI
from prometheus_client import Counter, Histogram

from .feature_fetcher import fetch_features
from . import ranker_pb2, ranker_pb2_grpc
import grpc
from concurrent import futures

app = FastAPI()
model: lgb.Booster | None = None
feature_map: dict | None = None

rank_requests_total = Counter("rank_requests_total", "Total rank requests")
rank_latency_ms = Histogram("rank_latency_ms", "Rank latency in ms")
shadow_served_total = Counter("shadow_served_total", "Shadow traffic served")


@app.on_event("startup")
def load_model():
    global model, feature_map
    model_path = os.getenv("MODEL_PATH", "ranker.txt")
    model = lgb.Booster(model_file=model_path)
    fmap_path = os.getenv("FEATURE_MAP", os.path.join(os.path.dirname(model_path), "feature_map.json"))
    with open(fmap_path) as f:
        feature_map = json.load(f)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


class RankerServicer(ranker_pb2_grpc.RankerServicer):
    def Rank(self, request: ranker_pb2.RankRequest, context):
        start = time.time()
        cids = list(request.candidate_ids)
        feats = fetch_features(request.viewer_id, cids)
        scores = model.predict(feats)
        ranked = [cid for _, cid in sorted(zip(scores, cids), reverse=True)]
        rank_requests_total.inc()
        rank_latency_ms.observe((time.time() - start) * 1000)
        return ranker_pb2.RankResponse(ranked_ids=ranked)


def serve_grpc(port: int = 50051):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    ranker_pb2_grpc.add_RankerServicer_to_server(RankerServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    return server
