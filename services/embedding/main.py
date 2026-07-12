from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, UUID4
from typing import List
import numpy as np

from . import model

app = FastAPI()


class EmbedRequest(BaseModel):
    user_id: UUID4
    interests: List[str]


class EmbedResponse(BaseModel):
    vector: List[float]


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not req.interests:
        raise HTTPException(status_code=422, detail="interests required")
    vec = model.interests_to_vector(req.interests)
    return {"vector": vec.tolist()}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
