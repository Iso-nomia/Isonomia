import grpc
from multiprocessing import Process
import time

from services.ranker import main, server, ranker_pb2, ranker_pb2_grpc


def start_server():
    grpc_server = main.serve_grpc(port=50055)
    return grpc_server


def test_rank_response_order(tmp_path, monkeypatch):
    # Patch feature fetcher to deterministic output
    def fetch(viewer_id, candidate_ids):
        return [[i] for i in range(len(candidate_ids))]
    monkeypatch.setattr(main, "fetch_features", fetch)
    class Dummy:
        def predict(self, X):
            return [row[0] for row in X]
    main.model = Dummy()

    grpc_server = start_server()
    channel = grpc.insecure_channel("localhost:50055")
    stub = ranker_pb2_grpc.RankerStub(channel)
    time.sleep(0.1)
    req = ranker_pb2.RankRequest(viewer_id="v1", candidate_ids=["a", "b", "c"])
    resp1 = stub.Rank(req)
    resp2 = stub.Rank(req)
    assert resp1.ranked_ids == ["c", "b", "a"]
    assert resp1.ranked_ids == resp2.ranked_ids
    grpc_server.stop(0)
