# Routine recommendation ML pilot

## What is active

The website still serves the existing rule/statistics-based recommendation. Newly generated authenticated batches capture a numeric feature snapshot and can link an actual visible card to a later outcome. A local LightGBM training/evaluation pipeline and a small JavaScript tree evaluator are available. `models/routine-shadow.json` deliberately contains no model until real data has been evaluated. No synthetic model is deployed, and there is no online activation switch.

This first pilot targets **routine completion versus explicit rejection among observed, labeled recommendations**. It does not train on book registrations, genre clicks, or YouTube listening. Those remain separate category recommendation rules and need their own exposure/feedback data before a separate model experiment.

## Flow and storage

1. Existing time, safety, blocked-item, schedule and deduplication checks build the eligible pool.
2. The server issues a unique batch ID. For each selected candidate it records a versioned numeric feature vector, baseline score and existing conditional selection probability.
3. Browser visibility tracking (foreground, at least half visible for one second, no open dialog) sends the batch ID and actual displayed position. Retrying the same exposure is idempotent.
4. State and pet execution updates use the existing transaction to rebuild the linked outcome. Undoing completion, changing a rejection reason and restoring a removed routine change the exportable label as well. Superseded batches are conservatively excluded instead of attributing a later action to an older recommendation.
5. The authenticated training endpoint exports only the requesting account. No user ID is accepted from the query string. Feature snapshots never use later profile edits or later execution aggregates.

Snapshots live in the server-owned `recommendation_profiles` JSON under existing audits; no database migration or new paid service is required. The existing 90-day/180-batch retention and account-reset cascade apply. Only selected candidates retain feature vectors, keeping storage bounded. First plans generated before profile creation and historical audits without snapshots are not reconstructed as training data.

Feature contract: `routine-completion-v1`, ordered by `ML_FEATURES` in `lib/routine-ml.ts`. Inputs include prior aggregate scores, duration/preparation/budget, schedule linkage, planning style, reported-condition flag, energy, busy flag, Korean weekday/hour encodings, activity family and explicit interest flags. No names, emails, titles, free-text notes, body composition, medicines or diagnosis fields are exported. The file still contains personal activity patterns and must remain private.

## Label policy

- A recommendation must have its own verified exposure. A status already present before exposure is excluded.
- Outcome labels are not exportable before noon on the next Korean calendar day (36 hours after recommendation-day start), or before the latest recorded outcome correction, whichever is later.
- `1`: explicitly marked complete after exposure. This remains a self-reported outcome, not independently measured execution.
- `0`: an explicit unsuitable skip, or removal with dislike/never reason.
- Partial execution, generic removal, missing response, time shortage, fatigue, pain, forgotten activity, schedule changes, held routines, edited routine definitions and superseded batches are excluded from this binary target.
- Cleanup after completion preserves the completed label. Undo removes/rebuilds the label. An unselected candidate is never labeled negative.

This conservative dataset is selected by exposure and explicit response. A classifier sigmoid score is **not** a calibrated population-wide completion probability. Logged sequential selection probabilities are not examination propensities; no naive inverse-propensity weighting or causal uplift claim is made.

## User access

Settings → **추천 개선 실험** → **내 추천 기록과 실험 현황** offers a manual status check and private download:

- `GET /api/recommendations/training`: counts, collection/shadow status, and `serving: rules`.
- `GET /api/recommendations/training?download=1`: versioned JSON for the current account only.

Move the downloaded file to `data-exports/routine-fit-training.json` (gitignored). Account reset deletes server records; previously downloaded local files and any locally trained artifacts remain under the user's control.

## Local training

Run from the repository root, using Python 3.14 and Node 24 in this workspace. Install the pinned ML packages into a virtual environment, or use the existing ignored target directory:

```powershell
C:/Python314/python.exe -m pip install --target outputs/ml-deps -r ml/requirements.txt
C:/Python314/python.exe ml/train.py --input data-exports/routine-fit-training.json --out outputs/ml-real
```

Artifacts can only be written under this repository's ignored `outputs` directory. Insufficient data produces `report.json` with `status: insufficient_data` and no model. A stale model/parity file in that output folder is removed when the data gate fails.

The initial engineering gates are 100 labeled rows, 20 groups, 7 dates, and at least 10 rows/3 groups/both outcomes in each final partition. These are configurable design safeguards in the code, not a statistically justified universal minimum. Label balance, group coverage, learning curves and uncertainty matter beyond those counts.

The split uses whole dates in chronological order (60/20/20), never random candidate rows. Training labels must already have been available before validation exposure; validation labels must precede test exposure. This creates an embargo for delayed labels. This own-account experiment measures future behavior of a returning user; generalization to unseen users requires separately authorized multi-user data and a user-disjoint evaluation.

The script compares existing rule scores, a logistic baseline, and a small regularized LightGBM classifier. Validation chooses the tree count via early stopping; test data is evaluated afterward. Reports contain AUC and NDCG@3/@5 only for observed, explicitly labeled subsets, with the number of rankable groups. They do not measure how unshown candidates would have performed or prove an online improvement.

## Executable verification

```powershell
D:/node.exe scripts/test-engine.mjs
$env:ML_PYTHON='C:/Python314/python.exe'
D:/node.exe scripts/verify-ml.mjs
D:/node.exe --env-file=.env.local scripts/verify-recommendations.mjs
```

The ML smoke check creates a clearly marked synthetic dataset under `outputs/ml-check`, exercises the insufficient-real-data path, trains LightGBM locally, compares native Python predictions against JavaScript (including split boundaries), and confirms that synthetic models cannot be loaded for production shadow comparison. Its metrics are pipeline test results only. The authenticated integration check uses synthetic development accounts and cleans up only its fixtures.

## Later shadow comparison

Only a reviewed real-data artifact with matching feature order, passing Python/JS parity and reviewed offline results should be placed under `models/routine-shadow.json` as its `model` value. Keep data exports and parity probe files private. `evaluationOnly: true`, incompatible feature contracts, excessive trees/depth/nodes and malformed models are rejected. This file is currently empty by design.

When a real artifact is supplied, the server computes alternate top IDs from the already eligible pool and records model ID and inference duration. These IDs are a ranking diagnostic, not an executable alternate plan; a future live ranker must also satisfy the joint time and diversity constraints. Actual selected routines, exploration probabilities, time budgets, safety filtering and rewards still use the original algorithm. Any shadow prediction error falls back silently to normal rule serving. The lightweight evaluator uses numeric binary-GBDT trees only; no Python process, model API, GPU service, recurring training job or extra cloud infrastructure runs on Vercel.

Moving from shadow comparison to live ranking is a separate implementation and evaluation step. It needs measured latency, outcome metrics, diversity, rejection rate, new-user fallback and an appropriately sized online experiment. Model libraries have no API-call fee, but inference and logs still count toward the existing hosting/database allowances.

## Primary references

- [LightGBM classifier](https://lightgbm.readthedocs.io/en/stable/pythonapi/lightgbm.LGBMClassifier.html)
- [LightGBM model export](https://lightgbm.readthedocs.io/en/stable/pythonapi/lightgbm.Booster.html)
- [LightGBM tuning and early stopping](https://lightgbm.readthedocs.io/en/stable/Parameters-Tuning.html)
- [Ranking and position bias](https://xgboost.readthedocs.io/en/stable/tutorials/learning_to_rank.html)
