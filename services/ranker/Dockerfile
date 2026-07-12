FROM python:3.10-slim
RUN pip install lightgbm fastapi uvicorn[standard] grpcio prometheus-client redis mlflow
COPY services/ranker /app/
CMD ["python", "-m", "services.ranker.server"]
