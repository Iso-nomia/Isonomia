# mesh-lite/import.sh
set -euo pipefail
TARBALL="${1:?Usage: ./import.sh room_<id>.tar.zst}"

# 1) unpack
mkdir -p /tmp/room && tar --zstd -xf "$TARBALL" -C /tmp/room

# 2) restore db.sql
psql "postgres://mesh:mesh@localhost:5433/mesh" -v ON_ERROR_STOP=1 -f /tmp/room/db.sql

# 3) upload media/* to MinIO (mc required: brew install mc)
mc alias set local http://127.0.0.1:9000 mesh meshmesh
mc mb -p local/room-media || true
mc mirror /tmp/room/media local/room-media

echo "Imported. Point your mesh-lite API to postgres://mesh:mesh@localhost:5433/mesh and s3/minio local/room-media."
