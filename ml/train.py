"""Local-only pilot. No network calls; artifacts stay in gitignored outputs/."""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
local_dependencies = ROOT / "outputs" / "ml-deps"
if local_dependencies.is_dir():
    sys.path.insert(0, str(local_dependencies))


def read_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def prepare(data):
    if data.get("schema") != "routine-completion-v1" or data.get("task") != "routine_completion":
        raise ValueError("Unsupported feature/target schema")
    names = data.get("featureNames", [])
    if not names or len(set(names)) != len(names) or len(names) > 100:
        raise ValueError("Invalid feature contract")
    groups, seen = {}, set()
    for row in data.get("rows", []):
        key = (row["group"], row["candidateId"])
        if key in seen:
            raise ValueError("Duplicate candidate in a recommendation group")
        seen.add(key)
        values = row["features"]
        import math
        if len(values) != len(names) or any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in values):
            raise ValueError("Non-finite or incompatible features")
        if row["label"] not in (0, 1):
            raise ValueError("Only explicit binary outcomes are supported")
        if read_time(row["labelAvailableAt"]) < read_time(row["exposedAt"]):
            raise ValueError("Label precedes exposure")
        if row["group"] in groups and groups[row["group"]] != row["date"]:
            raise ValueError("A group cannot span multiple dates")
        groups[row["group"]] = row["date"]
    return names, data.get("rows", [])


def chronological_split(rows):
    dates = sorted({r["date"] for r in rows})
    if len(dates) < 7:
        return None, "At least 7 distinct dates are required for this pilot policy"
    val_day, test_day = dates[int(len(dates) * .6)], dates[int(len(dates) * .8)]
    val_start = min(read_time(r["exposedAt"]) for r in rows if r["date"] >= val_day)
    test_start = min(read_time(r["exposedAt"]) for r in rows if r["date"] >= test_day)
    train = [r for r in rows if r["date"] < val_day and read_time(r["labelAvailableAt"]) < val_start]
    val = [r for r in rows if val_day <= r["date"] < test_day and read_time(r["labelAvailableAt"]) < test_start]
    test = [r for r in rows if r["date"] >= test_day]
    for label, part in [("train", train), ("validation", val), ("test", test)]:
        if len(part) < 10 or len({r["group"] for r in part}) < 3 or {r["label"] for r in part} != {0, 1}:
            return None, f"More groups and both outcomes are required in {label}"
    return (train, val, test), None


def evaluate(rows, predictions):
    import numpy as np
    from sklearn.metrics import ndcg_score, roc_auc_score
    groups = {}
    for i, row in enumerate(rows):
        groups.setdefault(row["group"], []).append(i)
    ndcg = {3: [], 5: []}
    for indices in groups.values():
        y = [rows[i]["label"] for i in indices]
        if len(y) < 2 or len(set(y)) < 2:
            continue
        scores = [float(predictions[i]) for i in indices]
        for k in ndcg:
            ndcg[k].append(float(ndcg_score([y], [scores], k=k)))
    return {"auc": float(roc_auc_score([r["label"] for r in rows], predictions)),
            "ndcg_at_3": float(np.mean(ndcg[3])) if ndcg[3] else None,
            "ndcg_at_5": float(np.mean(ndcg[5])) if ndcg[5] else None,
            "rankable_groups": len(ndcg[3]), "rows": len(rows)}


def convert_tree(node):
    if "leaf_value" in node:
        return {"leaf": node["leaf_value"]}
    if node["decision_type"] != "<=" or node.get("missing_type") not in ("None", "NaN", "Zero"):
        raise ValueError("Only numeric GBDT splits can be exported")
    return {"feature": node["split_feature"], "threshold": node["threshold"],
            "missingLeft": node["default_left"], "zeroMissing": node["missing_type"] == "Zero",
            "left": convert_tree(node["left_child"]), "right": convert_tree(node["right_child"])}


def run(data, out):
    names, rows = prepare(data)
    summary = {"rows": len(rows), "groups": len({r["group"] for r in rows}), "days": len({r["date"] for r in rows})}
    report = {"schema": data["schema"], "synthetic": data.get("synthetic", False), "summary": summary,
              "serving": "rules", "limitations": [
                  "Offline metrics describe explicitly labeled, exposed candidates only.",
                  "They do not estimate causal uplift, population execution probability, or health benefits.",
                  "Logged conditional selection probabilities are diagnostics, not examination propensities.",
                  "These data-count gates are engineering safeguards, not a proof of statistical power.",
                  "Future online testing is required; no automatic model promotion is performed."]}
    split, reason = chronological_split(rows) if len(rows) >= 100 and summary["groups"] >= 20 else (None, "This pilot requires at least 100 labeled rows and 20 groups")
    if split is None:
        report.update(status="insufficient_data", reason=reason)
        return report
    import numpy as np
    import lightgbm as lgb
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    train, val, test = split
    array = lambda part: np.asarray([r["features"] for r in part], dtype=np.float64)
    x_train, x_val, x_test = array(train), array(val), array(test)
    y_train, y_val = [r["label"] for r in train], [r["label"] for r in val]
    model = lgb.LGBMClassifier(n_estimators=150, num_leaves=7, max_depth=3, min_child_samples=15,
                              learning_rate=.05, reg_lambda=1, n_jobs=1, verbosity=-1,
                              random_state=20261101, deterministic=True, force_col_wise=True)
    model.fit(x_train, y_train, eval_set=[(x_val, y_val)], callbacks=[lgb.early_stopping(15, verbose=False)])
    logistic = make_pipeline(StandardScaler(), LogisticRegression(max_iter=500, random_state=20261101))
    logistic.fit(x_train, y_train)
    metrics = {}
    for name, part, x in [("validation", val, x_val), ("test", test, x_test)]:
        metrics[name] = {"rules": evaluate(part, [r["ruleScore"] for r in part]),
                         "logistic": evaluate(part, logistic.predict_proba(x)[:, 1]),
                         "lightgbm": evaluate(part, model.booster_.predict(x))}
    dump = model.booster_.dump_model()
    if not dump["objective"].startswith("binary sigmoid:1") or dump.get("average_output"):
        raise ValueError("Incompatible objective for the web runtime")
    model_id = "lgbm-" + hashlib.sha256(json.dumps(dump, sort_keys=True).encode()).hexdigest()[:16]
    artifact = {"schema": data["schema"], "modelId": model_id, "featureNames": names,
                "evaluationOnly": bool(data.get("synthetic", False)),
                "trees": [convert_tree(t["tree_structure"]) for t in dump["tree_info"]]}
    (out / "model.json").write_text(json.dumps(artifact, ensure_ascii=False), encoding="utf-8")
    # Native predictions verify the exported JS evaluator, including split boundaries.
    probes = [list(v) for v in x_test[:50]] + [[0.] * len(names)]
    def boundaries(node):
        if "leaf_value" in node:
            return
        for delta in (-1e-10, 0, 1e-10):
            probe = list(x_test[0]); probe[node["split_feature"]] = float(node["threshold"]) + delta; probes.append(probe)
        boundaries(node["left_child"]); boundaries(node["right_child"])
    for tree in dump["tree_info"]:
        boundaries(tree["tree_structure"])
    expected = model.booster_.predict(np.asarray(probes, dtype=np.float64)).tolist()
    (out / "parity.json").write_text(json.dumps({"features": probes, "expected": expected}), encoding="utf-8")
    report.update(status="evaluated", modelId=model_id, lightgbmVersion=lgb.__version__,
                  split={n: {"rows": len(p), "firstDate": min(r["date"] for r in p), "lastDate": max(r["date"] for r in p)} for n, p in [("train", train), ("validation", val), ("test", test)]},
                  metrics=metrics, featureImportance=dict(zip(names, map(float, model.feature_importances_))),
                  requiresParityCheck=True, automaticPromotion=False)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", default="outputs/ml")
    parser.add_argument("--allow-synthetic", action="store_true")
    args = parser.parse_args()
    out = Path(args.out).resolve()
    if not out.is_relative_to(ROOT / "outputs"):
        parser.error("Artifacts must stay inside this project's gitignored outputs directory")
    out.mkdir(parents=True, exist_ok=True)
    data = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
    if data.get("synthetic") and not args.allow_synthetic:
        parser.error("Synthetic smoke data requires --allow-synthetic and cannot serve users")
    report = run(data, out)
    if report["status"] != "evaluated":
        (out / "model.json").unlink(missing_ok=True)
        (out / "parity.json").unlink(missing_ok=True)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": report["status"], "synthetic": report["synthetic"], "summary": report["summary"]}))


if __name__ == "__main__":
    main()
