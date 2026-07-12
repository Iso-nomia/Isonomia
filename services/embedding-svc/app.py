import json
import hashlib
from typing import List

import numpy as np
from fastapi import FastAPI, HTTPException, Query
import uvicorn
import grpc
from concurrent import futures

import embedding_pb2
import embedding_pb2_grpc

# Dummy user interests lookup
USER_INTERESTS = {
    "1": ["music", "ai", "sports"],
    "2": ["cooking", "travel", "photography"],
}

VECTOR_DIM = 256


def word_to_vec(word: str) -> np.ndarray:
    # Simple deterministic hashing to vector
    h = hashlib.sha256(word.encode()).digest()
    np.random.seed(int.from_bytes(h[:4], "little"))
    return np.random.rand(VECTOR_DIM)


def embed_user(user_id: str) -> List[float]:
    interests = USER_INTERESTS.get(user_id)
    if not interests:
        raise KeyError("user not found")
    vecs = [word_to_vec(w) for w in interests]
    mean_vec = np.mean(vecs, axis=0)
    return mean_vec.astype(float).tolist()


app = FastAPI()


@app.get("/embed")
def embed(user_id: str = Query(...)):
    try:
        vec = embed_user(user_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="user not found")
    return {"user_id": user_id, "vector": vec}


@app.get("/health")
def health():
    return {"status": "ok"}


class EmbedderServicer(embedding_pb2_grpc.EmbedderServicer):
    def EmbedBatch(self, request, context):
        resp = embedding_pb2.EmbedResponse()
        for uid in request.user_ids:
            try:
                vec = embed_user(uid)
                emb = embedding_pb2.Embedding(user_id=uid, vector=vec)
                resp.embeddings.append(emb)
            except KeyError:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details(f"user {uid} not found")
                return resp
        return resp


def serve_grpc():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    embedding_pb2_grpc.add_EmbedderServicer_to_server(EmbedderServicer(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    return server


if __name__ == "__main__":
    grpc_server = serve_grpc()
    uvicorn.run(app, host="0.0.0.0", port=8000)
    grpc_server.stop(0)
