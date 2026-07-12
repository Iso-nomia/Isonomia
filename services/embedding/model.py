import os
from functools import lru_cache
from typing import List

import numpy as np
from gensim.models.fasttext import load_facebook_model

FASTTEXT_PATH = os.getenv("FASTTEXT_MODEL_PATH", "/models/cc.en.300.bin")

fasttext_model = None


def load_model():
    """Load FastText model lazily."""
    global fasttext_model
    if fasttext_model is None:
        fasttext_model = load_facebook_model(FASTTEXT_PATH)
    return fasttext_model


def interests_to_vector(interests: List[str]) -> np.ndarray:
    if not interests:
        raise ValueError("no interests provided")
    model = load_model()
    vecs = []
    for w in interests:
        vecs.append(model.wv[w])
    mean = np.mean(vecs, axis=0)
    norm = np.linalg.norm(mean)
    if norm > 0:
        mean = mean / norm
    if mean.size < 256:
        mean = np.pad(mean, (0, 256 - mean.size))
    else:
        mean = mean[:256]
    return mean
