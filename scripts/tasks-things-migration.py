#!/usr/bin/env python3
"""Build a private BathOS Tasks schema-13 replacement from a Things snapshot.

The script never writes Things and never emits task content to stdout. Real
snapshots, generated envelopes, and detailed reconciliation stay outside the
repository with owner-only permissions.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import plistlib
import sqlite3
import sys
import uuid
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from zoneinfo import ZoneInfo


COLLECTIONS = [
    "tasks_areas",
    "tasks_todos",
    "tasks_checklist_items",
    "tasks_history_events",
    "tasks_hierarchy_operations",
    "tasks_hierarchy_history_events",
    "tasks_user_settings",
    "tasks_mail_sources",
    "tasks_mail_source_events",
    "tasks_templates",
    "tasks_template_revisions",
    "tasks_template_instantiations",
    "tasks_recurrence_definitions",
    "tasks_recurrence_revisions",
    "tasks_recurrence_occurrences",
    "tasks_recurrence_evaluations",
    "tasks_recurrence_status_events",
    "tasks_reminders",
    "tasks_reminder_occurrences",
]

REQUIRED_SCHEMA = {
    "TMTask": {
        "uuid",
        "creationDate",
        "userModificationDate",
        "type",
        "status",
        "trashed",
        "title",
        "notes",
        "start",
        "startDate",
        "startBucket",
        "reminderTime",
        "deadline",
        "index",
        "todayIndex",
        "area",
        "project",
        "heading",
        "rt1_repeatingTemplate",
        "rt1_recurrenceRule",
        "rt1_afterCompletionReferenceDate",
        "rt1_nextInstanceStartDate",
    },
    "TMArea": {"uuid", "title", "index"},
    "TMTag": {"uuid", "title"},
    "TMTaskTag": {"tasks", "tags"},
    "TMChecklistItem": {
        "uuid",
        "userModificationDate",
        "creationDate",
        "title",
        "status",
        "stopDate",
        "index",
        "task",
    },
}

MIGRATION_NAMESPACE = uuid.UUID("c195e06d-b24b-5f55-8acd-e20f458c55e5")
APPLE_START_KIND_ANYTIME = 1
APPLE_START_KIND_SCHEDULED = 2
APPLE_TODAY_INDEX_VISIBLE_SENTINEL = -100_000
THINGS_FREQUENCIES = {
    16: "daily",
    256: "weekly",
    8: "monthly",
    4: "yearly",
}
UTC = dt.timezone.utc


class MigrationError(RuntimeError):
    """Raised when private source data cannot be converted unambiguously."""


@dataclass(frozen=True)
class ConvertedRule:
    mode: str
    frequency: str
    interval: int
    rule_config: dict[str, Any]
    deadline_offset_days: int | None


def stable_uuid(kind: str, source_identity: str) -> str:
    return str(uuid.uuid5(MIGRATION_NAMESPACE, f"{kind}:{source_identity}"))


def postgres_timestamp(value: dt.datetime) -> str:
    normalized = value.astimezone(UTC)
    rendered = normalized.strftime("%Y-%m-%dT%H:%M:%S")
    if normalized.microsecond:
        rendered += "." + f"{normalized.microsecond:06d}".rstrip("0")
    return rendered + "+00:00"


def iso_timestamp(value: float | int | None, fallback: str) -> str:
    if value is None:
        parsed_fallback = dt.datetime.fromisoformat(
            fallback.replace("Z", "+00:00")
        )
        if parsed_fallback.tzinfo is None:
            parsed_fallback = parsed_fallback.replace(tzinfo=UTC)
        return postgres_timestamp(parsed_fallback)
    return postgres_timestamp(dt.datetime.fromtimestamp(float(value), tz=UTC))


def decode_things_date(value: int | None) -> dt.date | None:
    if value is None:
        return None
    packed = int(value)
    year = packed >> 16
    month = (packed >> 12) & 0xF
    day = (packed >> 7) & 0x1F
    if not (1 <= year <= 9999 and 1 <= month <= 12 and 1 <= day <= 31):
        raise MigrationError("Things contains an invalid packed calendar date")
    try:
        return dt.date(year, month, day)
    except ValueError as error:
        raise MigrationError("Things contains an impossible packed calendar date") from error


def decode_things_time(value: int | None) -> dt.time | None:
    if value is None:
        return None
    packed = int(value)
    hour = (packed >> 26) & 0x1F
    minute = (packed >> 20) & 0x3F
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise MigrationError("Things contains an invalid packed reminder time")
    return dt.time(hour, minute)


def postgres_jsonb_text(value: Any) -> str:
    """Serialize the JSON shapes used here the same way PostgreSQL jsonb::text does."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not value.is_integer():
            raise MigrationError("Nonintegral JSON numbers are unsupported in migration output")
        return str(int(value))
    if isinstance(value, list):
        return "[" + ", ".join(postgres_jsonb_text(child) for child in value) + "]"
    if isinstance(value, dict):
        # PostgreSQL jsonb orders object keys by UTF-8 byte length, then bytes.
        keys = sorted(value, key=lambda key: (len(key.encode("utf-8")), key.encode("utf-8")))
        return "{" + ", ".join(
            f"{json.dumps(key, ensure_ascii=False)}: {postgres_jsonb_text(value[key])}"
            for key in keys
        ) + "}"
    raise MigrationError(f"Unsupported JSON value type: {type(value).__name__}")


def export_checksum(value: Any) -> str:
    return hashlib.sha256(postgres_jsonb_text(value).encode("utf-8")).hexdigest()


def snapshot_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def private_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
    finally:
        os.chmod(path, 0o600)


def open_snapshot(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise MigrationError("Things snapshot does not exist")
    connection = sqlite3.connect(f"file:{path}?immutable=1", uri=True)
    connection.row_factory = sqlite3.Row
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if integrity != "ok":
        connection.close()
        raise MigrationError("Things snapshot integrity verification failed")
    validate_source_schema(connection)
    return connection


def validate_source_schema(connection: sqlite3.Connection) -> None:
    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    for table, required_columns in REQUIRED_SCHEMA.items():
        if table not in tables:
            raise MigrationError(f"Things snapshot is missing required table {table}")
        actual = {
            row[1]
            for row in connection.execute(f'PRAGMA table_info("{table}")')
        }
        missing = required_columns - actual
        if missing:
            raise MigrationError(
                f"Things snapshot table {table} is missing required columns"
            )


def selected_root_predicate(alias: str = "task") -> str:
    # The visibility sentinel was cross-checked against Things' read-only
    # Anytime, Someday, Upcoming, and Today AppleScript lists. It excludes
    # non-list internal rows while retaining owner-visible Today work.
    return f"""
      {alias}.status = 0
      AND {alias}.trashed = 0
      AND {alias}.project IS NULL
      AND {alias}.type IN (0, 1)
      AND (
        {alias}.rt1_recurrenceRule IS NOT NULL
        OR {alias}.type = 1
        OR {alias}.area IS NOT NULL
        OR {alias}.startDate IS NOT NULL
        OR {alias}.deadline IS NOT NULL
        OR {alias}.start = {APPLE_START_KIND_SCHEDULED}
        OR {alias}.todayIndex < {APPLE_TODAY_INDEX_VISIBLE_SENTINEL}
      )
    """


def load_selected_roots(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    return connection.execute(
        f"""
        SELECT task.*
        FROM TMTask AS task
        WHERE {selected_root_predicate("task")}
        ORDER BY task.uuid
        """
    ).fetchall()


def load_tags(connection: sqlite3.Connection) -> dict[str, set[str]]:
    tags: dict[str, set[str]] = {}
    for row in connection.execute(
        """
        SELECT relation.tasks AS task_id, tag.title
        FROM TMTaskTag AS relation
        JOIN TMTag AS tag ON tag.uuid = relation.tags
        """
    ):
        tags.setdefault(str(row["task_id"]), set()).add(str(row["title"]))
    return tags


def actionability_for(*tag_sets: Iterable[str]) -> str:
    combined = set().union(*tag_sets)
    waiting = "⏳" in combined
    rechecking = "🔄" in combined
    if waiting and rechecking:
        raise MigrationError("A task has conflicting actionability tags")
    if waiting:
        return "waiting"
    if rechecking:
        return "rechecking"
    return "actionable"


def convert_rule(blob: bytes) -> ConvertedRule:
    try:
        rule = plistlib.loads(blob)
    except Exception as error:
        raise MigrationError("A Things recurrence rule cannot be decoded") from error
    if not isinstance(rule, dict):
        raise MigrationError("A Things recurrence rule is not a dictionary")
    frequency_code = rule.get("fu")
    frequency = THINGS_FREQUENCIES.get(frequency_code)
    interval = rule.get("fa")
    mode_code = rule.get("tp")
    offset = rule.get("ts")
    options = rule.get("of")
    interval_anchor = rule.get("ia")
    end_date = rule.get("ed")
    repeat_count = rule.get("rc")
    if (
        frequency is None
        or not isinstance(interval, int)
        or interval < 1
        or mode_code not in (0, 1)
        or not isinstance(offset, int)
        or offset > 0
        or not isinstance(options, list)
        or not all(isinstance(option, dict) for option in options)
        or not isinstance(interval_anchor, (int, float))
        or not isinstance(end_date, (int, float))
        or dt.datetime.fromtimestamp(float(end_date), tz=UTC).year != 4001
        or repeat_count != 0
    ):
        raise MigrationError("A Things recurrence rule has unsupported fields")
    config: dict[str, Any] = {}
    if frequency == "weekly":
        weekdays = sorted({
            7 if option.get("wd") == 0 else int(option["wd"])
            for option in options
            if isinstance(option.get("wd"), int)
        })
        if not weekdays or any(day < 1 or day > 7 for day in weekdays):
            raise MigrationError("A weekly Things recurrence has invalid weekdays")
        config = {"weekdays": weekdays}
    elif frequency == "monthly":
        if len(options) != 1:
            raise MigrationError("A monthly Things recurrence has ambiguous options")
        option = options[0]
        if set(option) == {"dy"} and isinstance(option["dy"], int):
            if option["dy"] == -1:
                config = {"monthly_kind": "last_day"}
            elif 0 <= option["dy"] <= 30:
                config = {
                    "monthly_kind": "day_of_month",
                    "month_day": option["dy"] + 1,
                }
            else:
                raise MigrationError("A monthly Things calendar day is invalid")
        elif (
            set(option) == {"wd", "wdo"}
            and isinstance(option["wd"], int)
            and isinstance(option["wdo"], int)
        ):
            weekday = 7 if option["wd"] == 0 else option["wd"]
            ordinal = option["wdo"]
            if weekday not in range(1, 8) or ordinal not in (-1, 1, 2, 3, 4, 5):
                raise MigrationError("A monthly Things ordinal weekday is invalid")
            config = {
                "monthly_kind": "ordinal_weekday",
                "ordinal": ordinal,
                "weekday": weekday,
            }
        else:
            raise MigrationError("A monthly Things recurrence shape is unsupported")
    elif frequency == "yearly":
        if len(options) != 1:
            raise MigrationError("A yearly Things recurrence has ambiguous options")
        option = options[0]
        if (
            set(option) == {"dy", "mo"}
            and isinstance(option["dy"], int)
            and isinstance(option["mo"], int)
        ):
            month = option["mo"] + 1
            if month not in range(1, 13):
                raise MigrationError("A yearly Things calendar date is invalid")
            if option["dy"] == -1:
                config = {
                    "yearly_kind": "last_day",
                    "month": month,
                }
            else:
                month_day = option["dy"] + 1
                if month_day not in range(1, 32):
                    raise MigrationError("A yearly Things calendar date is invalid")
                config = {
                    "yearly_kind": "fixed_date",
                    "month": month,
                    "month_day": month_day,
                }
        elif (
            set(option) == {"mo", "wd", "wdo"}
            and all(isinstance(option[key], int) for key in ("mo", "wd", "wdo"))
        ):
            month = option["mo"] + 1
            weekday = 7 if option["wd"] == 0 else option["wd"]
            ordinal = option["wdo"]
            if (
                month not in range(1, 13)
                or weekday not in range(1, 8)
                or ordinal not in (-1, 1, 2, 3, 4, 5)
            ):
                raise MigrationError("A yearly Things ordinal weekday is invalid")
            config = {
                "yearly_kind": "ordinal_weekday",
                "month": month,
                "ordinal": ordinal,
                "weekday": weekday,
            }
        else:
            raise MigrationError("A yearly Things recurrence shape is unsupported")
    deadline_offset = -offset if offset < 0 else None
    return ConvertedRule(
        mode="calendar" if mode_code == 0 else "after_completion",
        frequency=frequency,
        interval=interval,
        rule_config=config,
        deadline_offset_days=deadline_offset,
    )


def last_day(year: int, month: int) -> int:
    following = dt.date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    return (following - dt.timedelta(days=1)).day


def matches_rule_date(candidate: dt.date, anchor: dt.date, rule: ConvertedRule) -> bool:
    if rule.mode == "after_completion":
        return True
    config = rule.rule_config
    if rule.frequency == "daily":
        return (candidate - anchor).days % rule.interval == 0
    if rule.frequency == "weekly":
        anchor_week = anchor - dt.timedelta(days=anchor.isoweekday() - 1)
        candidate_week = candidate - dt.timedelta(days=candidate.isoweekday() - 1)
        return (
            (candidate_week - anchor_week).days // 7
        ) % rule.interval == 0 and candidate.isoweekday() in config["weekdays"]
    if rule.frequency == "monthly":
        month_delta = (candidate.year - anchor.year) * 12 + candidate.month - anchor.month
        if month_delta < 0 or month_delta % rule.interval:
            return False
        kind = config.get("monthly_kind")
        if kind == "last_day":
            return candidate.day == last_day(candidate.year, candidate.month)
        if kind == "day_of_month":
            return candidate.day == min(
                config["month_day"],
                last_day(candidate.year, candidate.month),
            )
        return ordinal_weekday_matches(candidate, config["ordinal"], config["weekday"])
    year_delta = candidate.year - anchor.year
    if year_delta < 0 or year_delta % rule.interval:
        return False
    if candidate.month != config["month"]:
        return False
    if config.get("yearly_kind") == "ordinal_weekday":
        return ordinal_weekday_matches(candidate, config["ordinal"], config["weekday"])
    if config.get("yearly_kind") == "last_day":
        return candidate.day == last_day(candidate.year, candidate.month)
    return candidate.day == min(
        config["month_day"],
        last_day(candidate.year, candidate.month),
    )


def ordinal_weekday_matches(candidate: dt.date, ordinal: int, weekday: int) -> bool:
    if candidate.isoweekday() != weekday:
        return False
    if ordinal == -1:
        return candidate.day + 7 > last_day(candidate.year, candidate.month)
    return ((candidate.day - 1) // 7) + 1 == ordinal


def recurrence_anchor(rule: Mapping[str, Any]) -> dt.date:
    value = rule.get("ia")
    if not isinstance(value, (int, float)):
        raise MigrationError("A Things recurrence lacks its interval anchor")
    return dt.datetime.fromtimestamp(float(value), tz=UTC).date()


def verify_recurrence_next(
    template: sqlite3.Row,
    converted: ConvertedRule,
) -> bool:
    raw_rule = plistlib.loads(template["rt1_recurrenceRule"])
    next_start = decode_things_date(template["rt1_nextInstanceStartDate"])
    if next_start is None:
        return False
    schedule = next_start + dt.timedelta(days=converted.deadline_offset_days or 0)
    if not matches_rule_date(schedule, recurrence_anchor(raw_rule), converted):
        raise MigrationError("A converted recurrence does not match Things' stored next date")
    return True


def resolve_planning(
    source: sqlite3.Row,
    planning_date: dt.date,
    *,
    forced_start: dt.date | None = None,
    forced_deadline: dt.date | None = None,
    force_someday: bool | None = None,
) -> tuple[str, str | None, str | None, str | None]:
    start_date = forced_start if forced_start is not None else decode_things_date(source["startDate"])
    deadline = (
        forced_deadline if forced_deadline is not None else decode_things_date(source["deadline"])
    )
    someday = force_someday if force_someday is not None else (
        source["type"] == 1
        or (
            source["start"] == APPLE_START_KIND_SCHEDULED
            and start_date is None
            and deadline is None
            and source["rt1_repeatingTemplate"] is None
        )
    )
    if someday:
        return "someday", None, None, deadline.isoformat() if deadline else None
    # A private snapshot can cross the owner's local midnight before the guarded
    # replacement runs. Apply the same reached-Start policy as Tasks itself:
    # reached and elapsed Starts enter Today Inbox rather than becoming an
    # invalid past Start in the replacement envelope.
    today_section = (
        "inbox"
        if start_date is not None and start_date <= planning_date
        else None
    )
    persisted_start_date = None if today_section is not None else start_date
    return (
        "anytime",
        persisted_start_date.isoformat() if persisted_start_date else None,
        today_section,
        deadline.isoformat() if deadline else None,
    )


def sorted_source_rows(rows: Iterable[sqlite3.Row]) -> list[sqlite3.Row]:
    return sorted(
        rows,
        key=lambda row: (
            int(row["todayIndex"] or 0),
            int(row["index"] or 0),
            str(row["uuid"]),
        ),
    )


def order_key(position: int) -> str:
    if position < 0:
        raise MigrationError("Order-key position cannot be negative")
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    if position < len(alphabet):
        return f"a{alphabet[position]}"
    offset = position - len(alphabet)
    if offset >= len(alphabet) ** 2:
        raise MigrationError("Migration contains too many ordered records")
    return f"b{alphabet[offset // len(alphabet)]}{alphabet[offset % len(alphabet)]}"


def base_record(
    *,
    source_id: str,
    created_at: str,
    updated_at: str,
) -> dict[str, Any]:
    return {
        "client_mutation_id": stable_uuid("mutation", source_id),
        "created_at": created_at,
        "last_actor_type": "import",
        "last_mutation_channel": "import",
        "updated_at": updated_at,
    }


def make_task_record(
    source: sqlite3.Row,
    *,
    source_identity: str,
    position: int,
    planning_date: dt.date,
    migration_timestamp: str,
    area_id: str | None,
    actionability: str,
    recurrence: tuple[str, str, str, int] | None = None,
    forced_start: dt.date | None = None,
    forced_deadline: dt.date | None = None,
    force_someday: bool | None = None,
) -> dict[str, Any]:
    task_id = stable_uuid("task", source_identity)
    created_at = iso_timestamp(source["creationDate"], migration_timestamp)
    updated_at = iso_timestamp(source["userModificationDate"], created_at)
    destination, start_date, today_section, deadline = resolve_planning(
        source,
        planning_date,
        forced_start=forced_start,
        forced_deadline=forced_deadline,
        force_someday=force_someday,
    )
    recurrence_definition_id = recurrence[0] if recurrence else None
    recurrence_occurrence_id = recurrence[1] if recurrence else None
    recurrence_logical_key = recurrence[2] if recurrence else None
    recurrence_revision = recurrence[3] if recurrence else None
    return {
        **base_record(
            source_id=f"task:{source_identity}",
            created_at=created_at,
            updated_at=updated_at,
        ),
        "id": task_id,
        "title": str(source["title"] or "").strip() or "New Task",
        "notes": str(source["notes"] or ""),
        "lifecycle": "open",
        "completed_at": None,
        "canceled_at": None,
        "disposition": "present",
        "deleted_at": None,
        "deletion_root_id": None,
        "destination": destination,
        "today_section": today_section,
        "order_key": order_key(position),
        "area_id": area_id,
        "hierarchy_order_key": order_key(position),
        "start_date": start_date,
        "deadline": deadline,
        "source_kind": None,
        "source_url": None,
        "source_title": None,
        "source_external_id": None,
        "primary_link": None,
        "actionability": actionability,
        "entry_channel": "import",
        "revision": 1,
        "last_operation_id": stable_uuid("operation", source_identity),
        "undo_source_event_id": None,
        "template_definition_id": None,
        "template_revision": None,
        "template_instantiation_id": None,
        "template_node_id": None,
        "recurrence_definition_id": recurrence_definition_id,
        "recurrence_revision": recurrence_revision,
        "recurrence_occurrence_id": recurrence_occurrence_id,
        "recurrence_logical_key": recurrence_logical_key,
    }


def task_history_snapshot(task: Mapping[str, Any]) -> dict[str, Any]:
    return {
        field: task[field]
        for field in (
            "title",
            "notes",
            "lifecycle",
            "completed_at",
            "canceled_at",
            "disposition",
            "deleted_at",
            "deletion_root_id",
            "destination",
            "today_section",
            "order_key",
            "area_id",
            "hierarchy_order_key",
            "start_date",
            "deadline",
            "source_kind",
            "source_url",
            "source_title",
            "source_external_id",
            "primary_link",
            "actionability",
        )
    }


def make_baseline_history_record(task: Mapping[str, Any]) -> dict[str, Any]:
    identity = str(task["id"])
    return {
        "id": stable_uuid("history", identity),
        "task_id": identity,
        "client_mutation_id": task["client_mutation_id"],
        "operation_id": task["last_operation_id"],
        "actor_type": "import",
        "mutation_channel": "import",
        "affected_ids": [identity],
        "base_revision": task["revision"],
        "result_revision": task["revision"],
        "transition": "baseline",
        "occurred_at": task["updated_at"],
        "outcome": "accepted",
        "code": "history_started",
        "before_state": None,
        "after_state": task_history_snapshot(task),
    }


def make_project_child_checklist_records(
    connection: sqlite3.Connection,
    project: sqlite3.Row,
    task_id: str,
    migration_timestamp: str,
) -> tuple[list[dict[str, Any]], int]:
    children = load_project_children(connection, project)
    records = []
    dropped_notes = 0
    for position, child in enumerate(children):
        if str(child["notes"] or "").strip():
            dropped_notes += 1
        identity = f"{project['uuid']}:{child['uuid']}"
        created_at = iso_timestamp(child["creationDate"], migration_timestamp)
        updated_at = iso_timestamp(child["userModificationDate"], created_at)
        records.append({
            **base_record(
                source_id=f"checklist:{identity}",
                created_at=created_at,
                updated_at=updated_at,
            ),
            "id": stable_uuid("checklist", identity),
            "task_id": task_id,
            "title": str(child["title"] or "").strip() or "Item",
            "completed": False,
            "completed_at": None,
            "order_key": order_key(position),
            "entry_channel": "import",
            "revision": 1,
            "disposition": "present",
            "deleted_at": None,
            "deletion_root_id": None,
            "template_definition_id": None,
            "template_revision": None,
            "template_instantiation_id": None,
            "template_node_id": None,
        })
    return records, dropped_notes


def load_native_checklist_items(
    connection: sqlite3.Connection,
    source_task_id: str,
) -> list[sqlite3.Row]:
    rows = connection.execute(
        """
        SELECT *
        FROM TMChecklistItem
        WHERE task = ?
        ORDER BY "index", uuid
        """,
        (source_task_id,),
    ).fetchall()
    for row in rows:
        if int(row["status"]) not in (0, 3):
            raise MigrationError("A native checklist item has an unsupported status")
        if not str(row["title"] or "").strip():
            raise MigrationError("A native checklist item has an empty title")
        if int(row["status"]) == 3 and row["stopDate"] is None:
            raise MigrationError(
                "A completed native checklist item has no completion date"
            )
    return rows


def make_native_checklist_records(
    connection: sqlite3.Connection,
    source_task_id: str,
    task_id: str,
    migration_timestamp: str,
    *,
    start_position: int = 0,
) -> list[dict[str, Any]]:
    records = []
    for offset, item in enumerate(
        load_native_checklist_items(connection, source_task_id)
    ):
        identity = str(item["uuid"])
        created_at = iso_timestamp(item["creationDate"], migration_timestamp)
        updated_at = iso_timestamp(item["userModificationDate"], created_at)
        completed = int(item["status"]) == 3
        records.append({
            **base_record(
                source_id=f"native-checklist:{identity}",
                created_at=created_at,
                updated_at=updated_at,
            ),
            "id": stable_uuid("native-checklist", identity),
            "task_id": task_id,
            "title": str(item["title"]),
            "completed": completed,
            "completed_at": (
                iso_timestamp(item["stopDate"], updated_at)
                if completed
                else None
            ),
            "order_key": order_key(start_position + offset),
            "entry_channel": "import",
            "revision": 1,
            "disposition": "present",
            "deleted_at": None,
            "deletion_root_id": None,
            "template_definition_id": None,
            "template_revision": None,
            "template_instantiation_id": None,
            "template_node_id": None,
        })
    return records


def load_project_children(
    connection: sqlite3.Connection,
    project: sqlite3.Row,
) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT child.*
        FROM TMTask AS child
        LEFT JOIN TMTask AS heading
          ON heading.uuid = child.heading
         AND heading.project = ?
         AND heading.type = 2
        WHERE (child.project = ? OR heading.uuid IS NOT NULL)
          AND child.type = 0
          AND child.status = 0
          AND child.trashed = 0
        ORDER BY
          COALESCE(heading."index", child."index"),
          CASE WHEN heading.uuid IS NULL THEN 0 ELSE 1 END,
          child."index",
          child.uuid
        """,
        (project["uuid"], project["uuid"]),
    ).fetchall()


def load_base_export(path: Path) -> dict[str, Any]:
    try:
        envelope = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MigrationError("Base Tasks export cannot be read") from error
    if (
        envelope.get("format") != "garden.bath.tasks.export"
        or envelope.get("schema_version") != 13
        or envelope.get("manifest", {}).get("collections") != COLLECTIONS
        or set(envelope.get("data", {})) != set(COLLECTIONS)
    ):
        raise MigrationError("Base Tasks export is not schema 13")
    return envelope


def source_areas(
    connection: sqlite3.Connection,
    roots: Sequence[sqlite3.Row],
) -> list[sqlite3.Row]:
    identifiers = sorted({
        str(row["area"])
        for row in roots
        if row["area"] is not None
    })
    if not identifiers:
        return []
    placeholders = ",".join("?" for _ in identifiers)
    rows = connection.execute(
        f"""
        SELECT * FROM TMArea
        WHERE uuid IN ({placeholders})
        ORDER BY "index", uuid
        """,
        identifiers,
    ).fetchall()
    if len(rows) != len(identifiers):
        raise MigrationError("A selected task references a missing Things Area")
    return rows


def merge_areas(
    base_areas: Sequence[dict[str, Any]],
    things_areas: Sequence[sqlite3.Row],
    migration_timestamp: str,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    by_title: dict[str, dict[str, Any]] = {}
    for record in base_areas:
        title = str(record.get("title", "")).strip()
        if not title or title in by_title:
            raise MigrationError("Base Tasks Areas are ambiguous")
        normalized = dict(record)
        normalized["revision"] = 1
        by_title[title] = normalized
    area_map: dict[str, str] = {}
    merged = [by_title[str(record.get("title", "")).strip()] for record in base_areas]
    for source in things_areas:
        title = str(source["title"] or "").strip()
        if not title:
            raise MigrationError("A referenced Things Area has no name")
        existing = by_title.get(title)
        if existing is not None:
            area_map[str(source["uuid"])] = str(existing["id"])
            continue
        identity = str(source["uuid"])
        record = {
            **base_record(
                source_id=f"area:{identity}",
                created_at=migration_timestamp,
                updated_at=migration_timestamp,
            ),
            "id": stable_uuid("area", identity),
            "title": title,
            "order_key": order_key(len(merged)),
            "entry_channel": "import",
            "revision": 1,
            "disposition": "present",
            "deleted_at": None,
            "deletion_root_id": None,
        }
        by_title[title] = record
        merged.append(record)
        area_map[identity] = str(record["id"])
    return merged, area_map


def template_snapshot(
    task: Mapping[str, Any],
    schedule_date: dt.date,
    checklist: Sequence[Mapping[str, Any]],
    deadline_offset_days: int | None,
) -> dict[str, Any]:
    start_date = (
        dt.date.fromisoformat(task["start_date"])
        if task["start_date"] is not None
        else None
    )
    return {
        "version": 1,
        "kind": "todo",
        "root": {
            "node_id": task["id"],
            "title": task["title"],
            "notes": task["notes"],
            "actionability": task["actionability"],
            "destination": "anytime",
            "today_section": None,
            "order_key": task["order_key"],
            "start_offset_days": (
                (start_date - schedule_date).days if start_date else 0
            ),
            "deadline_offset_days": 0 if deadline_offset_days is not None else None,
            "checklist": [
                {
                    "node_id": item["id"],
                    "title": item["title"],
                    "order_key": item["order_key"],
                }
                for item in checklist
            ],
        },
    }


def build_migration(
    connection: sqlite3.Connection,
    *,
    source_path: Path,
    planning_date: dt.date,
    planning_timezone: str,
    base_export: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    roots = load_selected_roots(connection)
    templates = [row for row in roots if row["rt1_recurrenceRule"] is not None]
    linked_instances = {
        str(row["rt1_repeatingTemplate"]): row
        for row in roots
        if row["rt1_repeatingTemplate"] is not None
    }
    if len(linked_instances) != sum(
        row["rt1_repeatingTemplate"] is not None for row in roots
    ):
        raise MigrationError("A recurrence has multiple open linked occurrences")
    one_off = [
        row
        for row in roots
        if row["type"] == 0
        and row["rt1_recurrenceRule"] is None
        and row["rt1_repeatingTemplate"] is None
    ]
    projects = [row for row in roots if row["type"] == 1]
    template_ids = {str(row["uuid"]) for row in templates}
    if set(linked_instances) - template_ids:
        raise MigrationError("An open recurrence occurrence has no live template")
    if any(row["type"] != 0 for row in templates):
        raise MigrationError("A non-task recurrence template is unsupported")

    migration_timestamp = iso_timestamp(
        max(float(row["userModificationDate"] or 0) for row in roots),
        f"{planning_date.isoformat()}T00:00:00Z",
    )
    tags = load_tags(connection)
    ignored_tag_links = 0
    for row in roots:
        ignored_tag_links += len(
            tags.get(str(row["uuid"]), set()) - {"⏳", "🔄"}
        )

    recurrence_frequency_counts: Counter[str] = Counter()
    recurrence_mode_counts: Counter[str] = Counter()
    recurrence_with_open_occurrence = 0
    recurrence_next_dates_verified = 0
    converted_rules: dict[str, ConvertedRule] = {}
    for template in templates:
        converted = convert_rule(template["rt1_recurrenceRule"])
        recurrence_next_dates_verified += verify_recurrence_next(template, converted)
        converted_rules[str(template["uuid"])] = converted
        recurrence_frequency_counts[converted.frequency] += 1
        recurrence_mode_counts[converted.mode] += 1
        recurrence_with_open_occurrence += str(template["uuid"]) in linked_instances

    things_areas = source_areas(connection, roots)
    project_children = [
        child
        for project in projects
        for child in load_project_children(connection, project)
    ]
    native_checklist_by_source = {
        str(source["uuid"]): load_native_checklist_items(
            connection,
            str(source["uuid"]),
        )
        for source in [*one_off, *projects, *linked_instances.values()]
    }
    for template in templates:
        native_checklist_by_source.setdefault(
            str(template["uuid"]),
            load_native_checklist_items(connection, str(template["uuid"])),
        )
    mapped_native_checklist_items = [
        item
        for source_id, items in native_checklist_by_source.items()
        if (
            source_id in {
                str(source["uuid"])
                for source in [*one_off, *projects, *linked_instances.values()]
            }
            or source_id in {
                str(template["uuid"])
                for template in templates
                if str(template["uuid"]) not in linked_instances
            }
        )
        for item in items
    ]
    recurrence_template_checklist_items = [
        item
        for template in templates
        for item in native_checklist_by_source[str(template["uuid"])]
    ]
    mapped_planning: Counter[str] = Counter()
    mapped_actionability: Counter[str] = Counter()
    mapped_content: Counter[str] = Counter()

    def count_mapped_source(
        source: sqlite3.Row,
        *,
        tag_sets: Sequence[Iterable[str]],
        area_source: Any,
        forced_start: dt.date | None = None,
        forced_deadline: dt.date | None = None,
        force_someday: bool | None = None,
        reminder_source: sqlite3.Row | None = None,
    ) -> None:
        destination, start_date_text, today_section, deadline_text = resolve_planning(
            source,
            planning_date,
            forced_start=forced_start,
            forced_deadline=forced_deadline,
            force_someday=force_someday,
        )
        start_date = (
            dt.date.fromisoformat(start_date_text)
            if start_date_text is not None
            else None
        )
        if destination == "someday":
            planning_bucket = "someday"
        elif today_section == "inbox":
            planning_bucket = "today_inbox"
        elif start_date is None:
            planning_bucket = "anytime"
        elif start_date > planning_date:
            planning_bucket = "future"
        else:
            planning_bucket = "past_start"
        mapped_planning[planning_bucket] += 1
        mapped_actionability[actionability_for(*tag_sets)] += 1
        mapped_content["notes"] += bool(str(source["notes"] or "").strip())
        mapped_content["deadlines"] += deadline_text is not None
        mapped_content["area_assignments"] += area_source is not None
        reminder_row = reminder_source or source
        mapped_content["reminders"] += reminder_row["reminderTime"] is not None

    for source in [*one_off, *projects]:
        identity = str(source["uuid"])
        count_mapped_source(
            source,
            tag_sets=[tags.get(identity, set())],
            area_source=source["area"],
        )
    for template in templates:
        template_identity = str(template["uuid"])
        source = linked_instances.get(template_identity, template)
        converted = converted_rules[template_identity]
        next_start = decode_things_date(template["rt1_nextInstanceStartDate"])
        if source is template:
            if next_start is None:
                raise MigrationError("A waiting recurrence has no open or next occurrence")
            forced_start = next_start
            forced_deadline = (
                next_start + dt.timedelta(days=converted.deadline_offset_days)
                if converted.deadline_offset_days is not None
                else None
            )
        else:
            forced_start = decode_things_date(source["startDate"])
            forced_deadline = decode_things_date(source["deadline"])
        count_mapped_source(
            source,
            tag_sets=[
                tags.get(str(source["uuid"]), set()),
                tags.get(template_identity, set()),
            ],
            area_source=source["area"] or template["area"],
            forced_start=forced_start,
            forced_deadline=forced_deadline,
            force_someday=False,
            reminder_source=(
                source if source["reminderTime"] is not None else template
            ),
        )

    if mapped_planning["past_start"]:
        raise MigrationError("A selected task has an unsupported past Start")
    if mapped_content["reminders"]:
        raise MigrationError("A selected task has an unsupported reminder")
    dropped_project_child_notes = sum(
        bool(str(child["notes"] or "").strip())
        for child in project_children
    )
    expected_target_tasks = len(one_off) + len(projects) + len(templates)
    report: dict[str, Any] = {
        "source": {
            "snapshot_sha256": snapshot_digest(source_path),
            "selected_rows": len(roots),
            "expected_target_tasks": expected_target_tasks,
            "one_off_tasks": len(one_off),
            "projects": len(projects),
            "project_children": len(project_children),
            "project_children_with_intentionally_omitted_notes": (
                dropped_project_child_notes
            ),
            "native_checklist_items": len(mapped_native_checklist_items),
            "native_checklist_items_completed": sum(
                int(item["status"]) == 3
                for item in mapped_native_checklist_items
            ),
            "native_checklist_tasks": sum(
                bool(items)
                for source_id, items in native_checklist_by_source.items()
                if (
                    source_id in {
                        str(source["uuid"])
                        for source in [*one_off, *projects, *linked_instances.values()]
                    }
                    or source_id in {
                        str(template["uuid"])
                        for template in templates
                        if str(template["uuid"]) not in linked_instances
                    }
                )
            ),
            "recurrence_template_checklist_items": len(
                recurrence_template_checklist_items
            ),
            "recurrence_templates": len(templates),
            "open_linked_recurrence_occurrences": recurrence_with_open_occurrence,
            "materialized_waiting_recurrences": len(templates)
            - recurrence_with_open_occurrence,
            "areas_referenced": len(things_areas),
            "ignored_non_actionability_tag_links": ignored_tag_links,
        },
        "mapped": {
            "planning": dict(sorted(mapped_planning.items())),
            "actionability": dict(sorted(mapped_actionability.items())),
            "content": {
                **dict(sorted(mapped_content.items())),
                "primary_links": 0,
            },
        },
        "recurrence": {
            "frequencies": dict(sorted(recurrence_frequency_counts.items())),
            "modes": dict(sorted(recurrence_mode_counts.items())),
            "next_dates_verified": recurrence_next_dates_verified,
            "linked_without_stored_next": len(templates) - recurrence_next_dates_verified,
            "unsupported_shapes": 0,
        },
        "invariants": {
            "snapshot_integrity": True,
            "selected_rows_partitioned": (
                len(roots)
                == len(one_off)
                + len(projects)
                + len(templates)
                + len(linked_instances)
            ),
            "one_open_occurrence_maximum": True,
            "no_conflicting_actionability": True,
            "no_things_provenance_in_target": True,
            "expected_target_partitioned": (
                sum(mapped_planning.values()) == expected_target_tasks
                and sum(mapped_actionability.values()) == expected_target_tasks
            ),
            "all_available_recurrence_next_dates_verified": (
                recurrence_next_dates_verified
                + (len(templates) - recurrence_next_dates_verified)
                == len(templates)
            ),
            "no_unmapped_reminders": mapped_content["reminders"] == 0,
        },
    }
    if not all(report["invariants"].values()):
        raise MigrationError("Things source invariants failed")
    if base_export is None:
        return None, report

    data = {collection: [] for collection in COLLECTIONS}
    data["tasks_user_settings"] = [
        dict(record) | {"revision": 1}
        for record in base_export["data"]["tasks_user_settings"]
    ]
    merged_areas, area_map = merge_areas(
        base_export["data"]["tasks_areas"],
        things_areas,
        migration_timestamp,
    )
    data["tasks_areas"] = merged_areas
    tasks: list[dict[str, Any]] = []
    checklist_items: list[dict[str, Any]] = []
    task_templates: list[dict[str, Any]] = []
    template_revisions: list[dict[str, Any]] = []
    recurrence_definitions: list[dict[str, Any]] = []
    recurrence_revisions: list[dict[str, Any]] = []
    recurrence_occurrences: list[dict[str, Any]] = []
    built_dropped_project_child_notes = 0

    ordered_target_sources = [
        (str(source["uuid"]), source)
        for source in [*one_off, *projects]
    ] + [
        (
            f"recurrence:{template['uuid']}",
            linked_instances.get(str(template["uuid"]), template),
        )
        for template in templates
    ]
    ordered_target_sources.sort(
        key=lambda entry: (
            int(entry[1]["todayIndex"] or 0),
            int(entry[1]["index"] or 0),
            str(entry[1]["uuid"]),
            entry[0],
        ),
    )
    position_by_source_identity = {
        identity: position
        for position, (identity, _) in enumerate(ordered_target_sources)
    }

    for source in sorted_source_rows([*one_off, *projects]):
        identity = str(source["uuid"])
        area_id = area_map.get(str(source["area"])) if source["area"] else None
        task = make_task_record(
            source,
            source_identity=identity,
            position=position_by_source_identity[identity],
            planning_date=planning_date,
            migration_timestamp=migration_timestamp,
            area_id=area_id,
            actionability=actionability_for(tags.get(identity, set())),
        )
        tasks.append(task)
        project_item_count = 0
        if source["type"] == 1:
            children, dropped_notes = make_project_child_checklist_records(
                connection,
                source,
                task["id"],
                migration_timestamp,
            )
            checklist_items.extend(children)
            project_item_count = len(children)
            built_dropped_project_child_notes += dropped_notes
        checklist_items.extend(make_native_checklist_records(
            connection,
            identity,
            task["id"],
            migration_timestamp,
            start_position=project_item_count,
        ))

    for template in sorted_source_rows(templates):
        template_identity = str(template["uuid"])
        source = linked_instances.get(template_identity, template)
        converted = converted_rules[template_identity]
        next_start = decode_things_date(template["rt1_nextInstanceStartDate"])
        if source is template:
            if next_start is None:
                raise MigrationError("A waiting recurrence has no open or next occurrence")
            forced_start = next_start
            forced_deadline = (
                next_start + dt.timedelta(days=converted.deadline_offset_days)
                if converted.deadline_offset_days is not None
                else None
            )
        else:
            forced_start = decode_things_date(source["startDate"])
            forced_deadline = decode_things_date(source["deadline"])
        schedule_date = forced_deadline or forced_start
        if schedule_date is None:
            raise MigrationError("A recurrence occurrence has no usable schedule date")

        definition_id = stable_uuid("recurrence", template_identity)
        occurrence_id = stable_uuid("recurrence-occurrence", template_identity)
        logical_key = (
            ("calendar:" if converted.mode == "calendar" else "initial:")
            + schedule_date.isoformat()
        )
        recurrence = (definition_id, occurrence_id, logical_key, 1)
        area_source = source["area"] or template["area"]
        area_id = area_map.get(str(area_source)) if area_source else None
        task = make_task_record(
            source,
            source_identity=f"recurrence:{template_identity}",
            position=position_by_source_identity[
                f"recurrence:{template_identity}"
            ],
            planning_date=planning_date,
            migration_timestamp=migration_timestamp,
            area_id=area_id,
            actionability=actionability_for(
                tags.get(str(source["uuid"]), set()),
                tags.get(template_identity, set()),
            ),
            recurrence=recurrence,
            forced_start=forced_start,
            forced_deadline=forced_deadline,
            force_someday=False,
        )
        tasks.append(task)
        current_checklist = make_native_checklist_records(
            connection,
            str(source["uuid"]),
            task["id"],
            migration_timestamp,
        )
        checklist_items.extend(current_checklist)
        template_checklist = make_native_checklist_records(
            connection,
            template_identity,
            task["id"],
            migration_timestamp,
        )

        template_id = stable_uuid("template", template_identity)
        template_revision_id = stable_uuid("template-revision", template_identity)
        created_at = iso_timestamp(template["creationDate"], migration_timestamp)
        updated_at = iso_timestamp(template["userModificationDate"], created_at)
        task_templates.append({
            **base_record(
                source_id=f"template:{template_identity}",
                created_at=created_at,
                updated_at=updated_at,
            ),
            "id": template_id,
            "kind": "todo",
            "name": task["title"],
            "current_revision": 1,
            "record_revision": 1,
            "archived_at": None,
        })
        template_revisions.append({
            "id": template_revision_id,
            "template_id": template_id,
            "revision": 1,
            "name": task["title"],
            "source_type": "todo",
            "source_id": task["id"],
            "source_revision": 1,
            "anchor_date": schedule_date.isoformat(),
            "snapshot": template_snapshot(
                task,
                schedule_date,
                template_checklist,
                converted.deadline_offset_days,
            ),
            "client_mutation_id": stable_uuid(
                "template-revision-mutation",
                template_identity,
            ),
            "created_at": created_at,
        })
        recurrence_definitions.append({
            **base_record(
                source_id=f"recurrence-definition:{template_identity}",
                created_at=created_at,
                updated_at=updated_at,
            ),
            "id": definition_id,
            "name": task["title"],
            "status": "active",
            "current_revision": 1,
            "record_revision": 1,
            "evaluated_through_date": schedule_date.isoformat(),
            "archived_at": None,
        })
        recurrence_revisions.append({
            "id": stable_uuid("recurrence-revision", template_identity),
            "recurrence_id": definition_id,
            "revision": 1,
            "name": task["title"],
            "template_id": template_id,
            "template_revision": 1,
            "rule_mode": converted.mode,
            "frequency": converted.frequency,
            "interval_count": converted.interval,
            "start_date": schedule_date.isoformat(),
            "planning_timezone": planning_timezone,
            "missed_policy": "all",
            "catch_up_limit": 100,
            "target_area_id": area_id,
            "client_mutation_id": stable_uuid(
                "recurrence-revision-mutation",
                template_identity,
            ),
            "created_at": created_at,
            "rule_config": converted.rule_config,
            "end_mode": "never",
            "end_after_count": None,
            "end_on_date": None,
            "reminder_local_time": None,
            "deadline_offset_days": converted.deadline_offset_days,
        })
        recurrence_occurrences.append({
            "id": occurrence_id,
            "recurrence_id": definition_id,
            "recurrence_revision": 1,
            "logical_key": logical_key,
            "scheduled_date": schedule_date.isoformat(),
            "predecessor_occurrence_id": None,
            "template_instantiation_id": None,
            "root_type": "todo",
            "root_id": task["id"],
            "client_mutation_id": stable_uuid(
                "recurrence-occurrence-mutation",
                template_identity,
            ),
            "generated_at": migration_timestamp,
            "origin": "adopted",
        })

    if (
        len(checklist_items)
        != len(project_children) + len(mapped_native_checklist_items)
        or built_dropped_project_child_notes != dropped_project_child_notes
    ):
        raise MigrationError("Checklist extraction did not reconcile")
    data["tasks_areas"] = sorted(
        data["tasks_areas"],
        key=lambda record: str(record["id"]),
    )
    data["tasks_todos"] = sorted(tasks, key=lambda record: str(record["id"]))
    data["tasks_history_events"] = sorted(
        [make_baseline_history_record(task) for task in tasks],
        key=lambda record: str(record["id"]),
    )
    data["tasks_checklist_items"] = sorted(
        checklist_items,
        key=lambda record: str(record["id"]),
    )
    data["tasks_templates"] = sorted(task_templates, key=lambda record: str(record["id"]))
    data["tasks_template_revisions"] = sorted(
        template_revisions,
        key=lambda record: str(record["id"]),
    )
    data["tasks_recurrence_definitions"] = sorted(
        recurrence_definitions,
        key=lambda record: str(record["id"]),
    )
    data["tasks_recurrence_revisions"] = sorted(
        recurrence_revisions,
        key=lambda record: str(record["id"]),
    )
    data["tasks_recurrence_occurrences"] = sorted(
        recurrence_occurrences,
        key=lambda record: str(record["id"]),
    )
    validate_target_graph(data)
    counts = {collection: len(data[collection]) for collection in COLLECTIONS}
    checksums = {"algorithm": "sha256"} | {
        collection: export_checksum(data[collection])
        for collection in COLLECTIONS
    }
    envelope = {
        "format": "garden.bath.tasks.export",
        "schema_version": 13,
        "created_at": migration_timestamp,
        "manifest": {
            "collections": COLLECTIONS,
            "counts": counts,
            "checksums": checksums,
        },
        "data": data,
    }
    report["target"] = {
        "counts": counts,
        "target_digest": export_checksum(envelope),
    }
    report["invariants"]["one_task_per_recurrence"] = (
        len(recurrence_definitions)
        == len(recurrence_revisions)
        == len(recurrence_occurrences)
        == len(templates)
    )
    return envelope, report


def validate_target_graph(data: Mapping[str, Sequence[Mapping[str, Any]]]) -> None:
    task_ids = {str(record["id"]) for record in data["tasks_todos"]}
    area_ids = {str(record["id"]) for record in data["tasks_areas"]}
    template_ids = {str(record["id"]) for record in data["tasks_templates"]}
    recurrence_ids = {
        str(record["id"]) for record in data["tasks_recurrence_definitions"]
    }
    occurrence_ids = {
        str(record["id"]) for record in data["tasks_recurrence_occurrences"]
    }
    all_ids: list[str] = []
    for collection in COLLECTIONS:
        all_ids.extend(
            str(record["id"])
            for record in data[collection]
            if "id" in record
        )
    if len(all_ids) != len(set(all_ids)):
        raise MigrationError("Target identifiers are not globally unique")
    for task in data["tasks_todos"]:
        if task["area_id"] is not None and task["area_id"] not in area_ids:
            raise MigrationError("A target task references a missing Area")
        recurrence_id = task["recurrence_definition_id"]
        occurrence_id = task["recurrence_occurrence_id"]
        if (recurrence_id is None) != (occurrence_id is None):
            raise MigrationError("A target task has incomplete recurrence provenance")
        if recurrence_id is not None and (
            recurrence_id not in recurrence_ids or occurrence_id not in occurrence_ids
        ):
            raise MigrationError("A target task references a missing recurrence")
        if any(task[field] is not None for field in (
            "source_kind",
            "source_url",
            "source_title",
            "source_external_id",
        )):
            raise MigrationError("A target task contains prohibited source provenance")
    for item in data["tasks_checklist_items"]:
        if str(item["task_id"]) not in task_ids:
            raise MigrationError("A target checklist item references a missing task")
    final_history_by_task = {
        str(event["task_id"]): event
        for event in data["tasks_history_events"]
        if event["transition"] == "baseline"
        and int(event["result_revision"]) == 1
    }
    if set(final_history_by_task) != task_ids:
        raise MigrationError("A target task is missing baseline history")
    for task in data["tasks_todos"]:
        history = final_history_by_task[str(task["id"])]
        if history["after_state"] != task_history_snapshot(task):
            raise MigrationError("A target task baseline does not match its final state")
    for revision in data["tasks_template_revisions"]:
        if str(revision["template_id"]) not in template_ids:
            raise MigrationError("A target template revision references a missing template")
        if str(revision["source_id"]) not in task_ids:
            raise MigrationError("A target template revision references a missing task")
    for revision in data["tasks_recurrence_revisions"]:
        if str(revision["recurrence_id"]) not in recurrence_ids:
            raise MigrationError("A target recurrence revision references a missing definition")
        if str(revision["template_id"]) not in template_ids:
            raise MigrationError("A target recurrence revision references a missing template")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("inspect", "build"))
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--planning-date", required=True, type=dt.date.fromisoformat)
    parser.add_argument("--planning-timezone", default="America/Los_Angeles")
    parser.add_argument("--base-export", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", required=True, type=Path)
    arguments = parser.parse_args(argv)
    if arguments.command == "build" and (
        arguments.base_export is None or arguments.output is None
    ):
        parser.error("build requires --base-export and --output")
    return arguments


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parse_args(argv or sys.argv[1:])
    try:
        ZoneInfo(arguments.planning_timezone)
        connection = open_snapshot(arguments.source)
        try:
            base_export = (
                load_base_export(arguments.base_export)
                if arguments.command == "build"
                else None
            )
            envelope, report = build_migration(
                connection,
                source_path=arguments.source,
                planning_date=arguments.planning_date,
                planning_timezone=arguments.planning_timezone,
                base_export=base_export,
            )
        finally:
            connection.close()
        private_write_json(arguments.report, report)
        if envelope is not None:
            private_write_json(arguments.output, envelope)
        print(json.dumps({
            "outcome": "accepted",
            "report": str(arguments.report),
            "output": str(arguments.output) if envelope is not None else None,
            "source_counts": report["source"],
            "target_counts": report.get("target", {}).get("counts"),
            "invariants": report["invariants"],
        }, sort_keys=True))
        return 0
    except (MigrationError, ValueError, OSError, sqlite3.Error) as error:
        print(
            json.dumps({
                "outcome": "rejected",
                "code": type(error).__name__,
                "message": str(error),
            }),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
