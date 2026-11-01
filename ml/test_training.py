import json
from pathlib import Path
import unittest
from train import prepare, chronological_split, read_time


class TrainingBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(Path("outputs/ml-check/synthetic.json").read_text(encoding="utf-8"))

    def test_temporal_groups_and_delayed_labels_do_not_leak(self):
        _, rows = prepare(self.data)
        split, reason = chronological_split(rows)
        self.assertIsNone(reason)
        train, val, test = split
        self.assertLess(max(r["date"] for r in train), min(r["date"] for r in val))
        self.assertLess(max(r["date"] for r in val), min(r["date"] for r in test))
        self.assertLess(max(read_time(r["labelAvailableAt"]) for r in train), min(read_time(r["exposedAt"]) for r in val))
        self.assertLess(max(read_time(r["labelAvailableAt"]) for r in val), min(read_time(r["exposedAt"]) for r in test))
        group_sets = [{r["group"] for r in part} for part in split]
        self.assertFalse(group_sets[0] & group_sets[1] or group_sets[1] & group_sets[2] or group_sets[0] & group_sets[2])

    def test_duplicates_nonfinite_and_wrong_schema_are_rejected(self):
        self.data["rows"].append(self.data["rows"][0])
        with self.assertRaises(ValueError):
            prepare(self.data)
        self.data["rows"].pop()
        self.data["rows"][0]["features"][0] = float("nan")
        with self.assertRaises(ValueError):
            prepare(self.data)
        self.data["schema"] = "unversioned"
        with self.assertRaises(ValueError):
            prepare(self.data)

    def test_one_day_or_one_class_does_not_produce_a_model(self):
        _, rows = prepare(self.data)
        self.assertIsNone(chronological_split(rows[:15])[0])
        for row in rows:
            row["label"] = 1
        self.assertIsNone(chronological_split(rows)[0])


if __name__ == "__main__":
    unittest.main()
