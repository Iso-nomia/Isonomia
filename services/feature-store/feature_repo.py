from datetime import timedelta
import pandas as pd
from feast import Entity, Field, FeatureView, FileSource
from feast.types import Float32, Int64

user = Entity(name="user_id", join_keys=["user_id"])

user_stats_source = FileSource(
    path="data/user_stats.parquet",
    timestamp_field="event_timestamp",
)

user_features = FeatureView(
    name="user_features",
    entities=[user],
    ttl=timedelta(days=7),
    schema=[
        Field(name="avg_session_dwell_sec_7d", dtype=Float32),
    ],
    online=True,
    source=user_stats_source,
)
