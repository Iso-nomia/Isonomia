import grpc
from concurrent import futures

from .grpc import embedder_pb2_grpc, embedder_pb2


class Embedder(embedder_pb2_grpc.EmbedderServicer):
    def Embed(self, request, context):
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details('not implemented')
        return embedder_pb2.EmbedReply()


def serve(port: int = 50051):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    embedder_pb2_grpc.add_EmbedderServicer_to_server(Embedder(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    return server
