import unittest
from datetime import datetime, timedelta

from time_merge import SpanLike, plan_connectable_timespan_merges


class TestTimeMergePlanner(unittest.TestCase):
    def test_overlap_merges_and_prefers_keeper_id(self):
        t0 = datetime(2026, 1, 1, 10, 0, 0)
        spans = [
            SpanLike(id=1, start_timestamp=t0, end_timestamp=t0 + timedelta(minutes=30)),
            SpanLike(
                id=2,
                start_timestamp=t0 + timedelta(minutes=15),
                end_timestamp=t0 + timedelta(minutes=45),
            ),
        ]

        plans = plan_connectable_timespan_merges(spans, prefer_timespan_id=2)
        self.assertEqual(len(plans), 1)
        plan = plans[0]
        self.assertEqual(plan.keeper_id, 2)
        self.assertEqual(plan.merged_start, t0)
        self.assertEqual(plan.merged_end, t0 + timedelta(minutes=45))
        self.assertEqual(plan.delete_ids, (1,))

    def test_touching_spans_merge(self):
        t0 = datetime(2026, 1, 1, 9, 0, 0)
        spans = [
            SpanLike(id=10, start_timestamp=t0, end_timestamp=t0 + timedelta(minutes=15)),
            SpanLike(
                id=11,
                start_timestamp=t0 + timedelta(minutes=15),
                end_timestamp=t0 + timedelta(minutes=30),
            ),
        ]

        plans = plan_connectable_timespan_merges(spans)
        self.assertEqual(len(plans), 1)
        plan = plans[0]
        self.assertEqual(plan.merged_start, t0)
        self.assertEqual(plan.merged_end, t0 + timedelta(minutes=30))

    def test_gap_exactly_15_minutes_merges_but_16_does_not(self):
        t0 = datetime(2026, 1, 1, 10, 0, 0)
        a = SpanLike(id=1, start_timestamp=t0, end_timestamp=t0 + timedelta(minutes=15))

        # Gap 15m from 10:15 -> 10:30 should merge with default gap_minutes=15
        b_merge = SpanLike(
            id=2,
            start_timestamp=t0 + timedelta(minutes=30),
            end_timestamp=t0 + timedelta(minutes=45),
        )
        plans_merge = plan_connectable_timespan_merges([a, b_merge])
        self.assertEqual(len(plans_merge), 1)

        # Gap 16m from 10:15 -> 10:31 should not merge
        b_no = SpanLike(
            id=3,
            start_timestamp=t0 + timedelta(minutes=31),
            end_timestamp=t0 + timedelta(minutes=46),
        )
        plans_no = plan_connectable_timespan_merges([a, b_no])
        self.assertEqual(len(plans_no), 0)

    def test_open_span_does_not_absorb_future_spans(self):
        t0 = datetime(2026, 1, 1, 10, 0, 0)
        spans = [
            SpanLike(id=1, start_timestamp=t0, end_timestamp=t0 + timedelta(minutes=15)),
            # Open span: treated as end=reference_now for connectability
            SpanLike(id=2, start_timestamp=t0 + timedelta(minutes=20), end_timestamp=None),
            # Subsequent span is far enough in the future to remain separate
            SpanLike(
                id=3,
                start_timestamp=t0 + timedelta(minutes=60),
                end_timestamp=t0 + timedelta(minutes=75),
            ),
        ]

        reference_now = t0 + timedelta(minutes=30)
        plans = plan_connectable_timespan_merges(spans, reference_now=reference_now)
        self.assertEqual(len(plans), 1)
        plan = plans[0]
        # Only the first two spans should merge into an open span.
        self.assertEqual(plan.merged_start, t0)
        self.assertIsNone(plan.merged_end)
        self.assertEqual(plan.delete_ids, (1,))

    def test_min_duration_fix_when_merged_end_not_after_start(self):
        # Two spans that collapse to a zero-length merged window should be fixed to +15m.
        t0 = datetime(2026, 1, 1, 10, 0, 0)
        spans = [
            SpanLike(id=1, start_timestamp=t0, end_timestamp=t0),
            SpanLike(id=2, start_timestamp=t0, end_timestamp=t0),
        ]

        plans = plan_connectable_timespan_merges(spans)
        self.assertEqual(len(plans), 1)
        plan = plans[0]
        self.assertEqual(plan.merged_start, t0)
        self.assertEqual(plan.merged_end, t0 + timedelta(minutes=15))

    def test_multiple_disjoint_groups_produce_multiple_plans(self):
        t0 = datetime(2026, 1, 1, 10, 0, 0)
        # Group 1: overlaps
        a1 = SpanLike(id=1, start_timestamp=t0, end_timestamp=t0 + timedelta(minutes=30))
        a2 = SpanLike(
            id=2,
            start_timestamp=t0 + timedelta(minutes=15),
            end_timestamp=t0 + timedelta(minutes=45),
        )
        # Group 2: overlaps, far away
        b0 = datetime(2026, 1, 1, 12, 0, 0)
        b1 = SpanLike(id=3, start_timestamp=b0, end_timestamp=b0 + timedelta(minutes=30))
        b2 = SpanLike(
            id=4,
            start_timestamp=b0 + timedelta(minutes=15),
            end_timestamp=b0 + timedelta(minutes=45),
        )

        plans = plan_connectable_timespan_merges([a1, a2, b1, b2])
        self.assertEqual(len(plans), 2)
        self.assertEqual({p.merged_start for p in plans}, {t0, b0})


if __name__ == "__main__":
    unittest.main()

