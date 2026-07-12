import uvicorn
from .main import app, serve_grpc

if __name__ == "__main__":
    grpc_server = serve_grpc()
    uvicorn.run(app, host="0.0.0.0", port=8000)
    grpc_server.stop(0)
