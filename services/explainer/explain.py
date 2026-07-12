import json
import os
import sys
import lightgbm as lgb
import shap
from services.ranker.feature_fetcher import fetch_features

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.txt")
FMAP_PATH = os.path.join(os.path.dirname(__file__), "feature_map.json")

model = lgb.Booster(model_file=MODEL_PATH)
with open(FMAP_PATH) as f:
    fmap = json.load(f)
reverse_map = {v: k for k, v in fmap.items()}
explainer = shap.TreeExplainer(model, feature_perturbation="tree_path_dependent")

def main():
    viewer = sys.argv[1]
    target = sys.argv[2]
    feats = fetch_features(viewer, [target])
    values = explainer.shap_values(feats)[0]
    out = {reverse_map[i]: float(values[i]) for i in range(len(values))}
    print(json.dumps(out))

if __name__ == "__main__":
    main()
