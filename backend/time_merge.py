from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Sequence

DEFAULT_GAP_MINUTES = 15
MIN_DURATION_MINUTES = 15


@dataclass(frozen=True, slots=True)
class SpanLike:
    """Minimal span shape needed for merge planning."""

    id: int
    start_timestamp: datetime
    end_timestamp: datetime | None


@dataclass(frozen=True, slots=True)
class MergePlan:
    """Instructions to merge a connectable group of spans."""

    keeper_id: int
    merged_start: datetime
    merged_end: datetime | None
    delete_ids: tuple[int, ...]


def plan_connectable_timespan_merges(
    spans: Sequence[SpanLike] | Iterable[SpanLike],
    gap_minutes: int = DEFAULT_GAP_MINUTES,
    prefer_timespan_id: int | None = None,
    reference_now: datetime | None = None,
) -> list[MergePlan]:
    """Plan merges for connectable spans using the same rules as backend CRUD.

    Connectable rule (inclusive): next.start <= current.end + gap
    - Overlaps included
    - Touching spans included
    - Small gaps up to gap_minutes included

    Open/running spans (end is None) are treated as end=reference_now for
    connectability checks (default: current UTC time). This prevents open spans
    from absorbing future spans. If any span in a group is open, the merged
    result is also open (merged_end=None).
    """
    spans_list = list(spans)
    if len(spans_list) <= 1:
        return []

    if reference_now is None:
        reference_now = datetime.utcnow()

    # Match DB ordering used by merge_connectable_timespans_for_entry():
    # order_by(start_timestamp asc, id asc)
    spans_list.sort(key=lambda s: (s.start_timestamp, s.id))

    gap = timedelta(minutes=gap_minutes)

    def effective_end(span: SpanLike) -> datetime:
        # Treat open span as current time for connectability checks.
        if span.end_timestamp is None:
            return max(reference_now, span.start_timestamp)
        return span.end_timestamp

    groups: list[list[SpanLike]] = []
    current_group: list[SpanLike] = [spans_list[0]]
    current_end = effective_end(spans_list[0])

    for span in spans_list[1:]:
        if span.start_timestamp <= current_end + gap:
            current_group.append(span)
            current_end = max(current_end, effective_end(span))
        else:
            groups.append(current_group)
            current_group = [span]
            current_end = effective_end(span)
    groups.append(current_group)

    plans: list[MergePlan] = []
    for group in groups:
        if len(group) == 1:
            continue

        keeper: SpanLike | None = None
        if prefer_timespan_id is not None:
            keeper = next((s for s in group if s.id == prefer_timespan_id), None)
        if keeper is None:
            keeper = min(group, key=lambda s: s.id)

        merged_start = min(s.start_timestamp for s in group)

        any_open = any(s.end_timestamp is None for s in group)
        if any_open:
            merged_end: datetime | None = None
        else:
            merged_end = max(
                s.end_timestamp for s in group if s.end_timestamp is not None
            )
            if merged_end <= merged_start:
                merged_end = merged_start + timedelta(minutes=MIN_DURATION_MINUTES)

        delete_ids = tuple(sorted((s.id for s in group if s.id != keeper.id)))
        plans.append(
            MergePlan(
                keeper_id=keeper.id,
                merged_start=merged_start,
                merged_end=merged_end,
                delete_ids=delete_ids,
            )
        )

    return plans
