feature-store-local-up:
	docker-compose up feature-store redis

train:
	python ml/offline_train_ranker.py --input data/train.parquet --output models

serve-shadow:
	python -m services.ranker.server

test:
	pytest services/ranker/tests
