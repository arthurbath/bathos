#!/usr/bin/env python3
"""Synthetic coverage for the private Things-to-Tasks migration."""

from __future__ import annotations

import datetime as dt
import importlib.util
import json
import plistlib
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("tasks-things-migration.py")
SPEC = importlib.util.spec_from_file_location("tasks_things_migration", SCRIPT_PATH)
assert SPEC and SPEC.loader
MIGRATION = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MIGRATION
SPEC.loader.exec_module(MIGRATION)

UTC = dt.timezone.utc
PLANNING_DATE = dt.date(2026, 7, 28)
CREATED_AT = dt.datetime(2026, 7, 1, tzinfo=UTC).timestamp()
UPDATED_AT = dt.datetime(2026, 7, 28, tzinfo=UTC).timestamp()
NEVER_ENDS = dt.datetime(4001, 1, 1, tzinfo=UTC).timestamp()


def packed_date(value: dt.date | None) -> int | None:
    if value is None:
        return None
    return (value.year << 16) | (value.month << 12) | (value.day << 7)


def recurrence_rule(
    frequency: int,
    options: list[dict[str, int]],
    schedule_date: dt.date,
    *,
    mode: int = 0,
    interval: int = 1,
    start_offset: int = 0,
) -> bytes:
    timestamp = dt.datetime.combine(schedule_date, dt.time(), tzinfo=UTC).timestamp()
    return plistlib.dumps({
        "ed": NEVER_ENDS,
        "fa": interval,
        "fu": frequency,
        "ia": timestamp,
        "of": options,
        "rc": 0,
        "rrv": 4,
        "sr": timestamp,
        "tp": mode,
        "ts": -start_offset,
    })


def create_schema(connection: sqlite3.Connection, *, include_heading: bool = True) -> None:
    heading_column = "heading TEXT," if include_heading else ""
    connection.executescript(f"""
        CREATE TABLE TMTask (
          uuid TEXT PRIMARY KEY,
          creationDate REAL,
          userModificationDate REAL,
          type INTEGER,
          status INTEGER,
          trashed INTEGER,
          title TEXT,
          notes TEXT,
          start INTEGER,
          startDate INTEGER,
          startBucket INTEGER,
          reminderTime INTEGER,
          deadline INTEGER,
          "index" INTEGER,
          todayIndex INTEGER,
          area TEXT,
          project TEXT,
          {heading_column}
          rt1_repeatingTemplate TEXT,
          rt1_recurrenceRule BLOB,
          rt1_afterCompletionReferenceDate REAL,
          rt1_nextInstanceStartDate INTEGER
        );
        CREATE TABLE TMArea (uuid TEXT PRIMARY KEY, title TEXT, "index" INTEGER);
        CREATE TABLE TMTag (uuid TEXT PRIMARY KEY, title TEXT);
        CREATE TABLE TMTaskTag (tasks TEXT, tags TEXT);
        CREATE TABLE TMChecklistItem (
          uuid TEXT PRIMARY KEY,
          userModificationDate REAL,
          creationDate REAL,
          title TEXT,
          status INTEGER,
          stopDate REAL,
          "index" INTEGER,
          task TEXT,
          leavesTombstone INTEGER,
          experimental BLOB
        );
    """)


def insert_task(
    connection: sqlite3.Connection,
    identity: str,
    *,
    task_type: int = 0,
    title: str = "Synthetic Task",
    notes: str = "",
    start: int = 1,
    start_date: dt.date | None = None,
    deadline: dt.date | None = None,
    index: int = 0,
    today_index: int = 0,
    area: str | None = None,
    project: str | None = None,
    heading: str | None = None,
    repeating_template: str | None = None,
    rule: bytes | None = None,
    next_start: dt.date | None = None,
    reminder_time: int | None = None,
) -> None:
    connection.execute(
        """
        INSERT INTO TMTask (
          uuid, creationDate, userModificationDate, type, status, trashed,
          title, notes, start, startDate, startBucket, reminderTime, deadline,
          "index", todayIndex, area, project, heading, rt1_repeatingTemplate,
          rt1_recurrenceRule, rt1_afterCompletionReferenceDate,
          rt1_nextInstanceStartDate
        ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        """,
        (
            identity,
            CREATED_AT,
            UPDATED_AT,
            task_type,
            title,
            notes,
            start,
            packed_date(start_date),
            reminder_time,
            packed_date(deadline),
            index,
            today_index,
            area,
            project,
            heading,
            repeating_template,
            rule,
            packed_date(next_start),
        ),
    )


def insert_checklist_item(
    connection: sqlite3.Connection,
    identity: str,
    task: str,
    title: str,
    *,
    index: int,
    completed: bool = False,
) -> None:
    connection.execute(
        """
        INSERT INTO TMChecklistItem (
          uuid, userModificationDate, creationDate, title, status, stopDate,
          "index", task, leavesTombstone, experimental
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
        """,
        (
            identity,
            UPDATED_AT,
            CREATED_AT,
            title,
            3 if completed else 0,
            UPDATED_AT if completed else None,
            index,
            task,
        ),
    )


def base_export() -> dict[str, object]:
    data = {collection: [] for collection in MIGRATION.COLLECTIONS}
    data["tasks_areas"] = [{
        "id": "10000000-0000-4000-8000-000000000001",
        "title": "Work",
        "revision": 3,
    }]
    data["tasks_user_settings"] = [{
        "id": "10000000-0000-4000-8000-000000000002",
        "planning_timezone": "America/Los_Angeles",
        "revision": 2,
    }]
    return {
        "format": "garden.bath.tasks.export",
        "schema_version": 13,
        "created_at": "2026-07-28T00:00:00Z",
        "manifest": {
            "collections": MIGRATION.COLLECTIONS,
            "counts": {
                collection: len(data[collection])
                for collection in MIGRATION.COLLECTIONS
            },
            "checksums": {"algorithm": "sha256"},
        },
        "data": data,
    }


class ThingsMigrationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.snapshot_path = Path(self.temporary.name) / "things.sqlite"
        self.connection = sqlite3.connect(self.snapshot_path)
        create_schema(self.connection)
        self.connection.executemany(
            'INSERT INTO TMArea (uuid, title, "index") VALUES (?, ?, ?)',
            [("area-work", "Work", 0), ("area-home", "Home", 1)],
        )
        self.connection.executemany(
            "INSERT INTO TMTag (uuid, title) VALUES (?, ?)",
            [("tag-waiting", "⏳"), ("tag-rechecking", "🔄")],
        )

    def tearDown(self) -> None:
        self.connection.close()
        self.temporary.cleanup()

    def test_order_keys_match_fractional_indexing_append_sequence(self) -> None:
        self.assertEqual(MIGRATION.order_key(0), "a0")
        self.assertEqual(MIGRATION.order_key(9), "a9")
        self.assertEqual(MIGRATION.order_key(10), "aA")
        self.assertEqual(MIGRATION.order_key(61), "az")
        self.assertEqual(MIGRATION.order_key(62), "b00")
        self.assertEqual(MIGRATION.order_key(128), "b14")
        with self.assertRaisesRegex(MIGRATION.MigrationError, "negative"):
            MIGRATION.order_key(-1)

    def add_recurrence(
        self,
        identity: str,
        frequency: int,
        options: list[dict[str, int]],
        schedule_date: dt.date,
        *,
        mode: int = 0,
        interval: int = 1,
        start_offset: int = 0,
        linked: bool = False,
        index: int = 0,
        today_index: int = 0,
    ) -> None:
        next_start = None if linked else schedule_date - dt.timedelta(days=start_offset)
        insert_task(
            self.connection,
            identity,
            title=f"Synthetic Recurrence {identity}",
            rule=recurrence_rule(
                frequency,
                options,
                schedule_date,
                mode=mode,
                interval=interval,
                start_offset=start_offset,
            ),
            next_start=next_start,
            area="area-work",
            index=index,
            today_index=today_index,
        )
        if linked:
            insert_task(
                self.connection,
                f"{identity}-instance",
                title=f"Synthetic Instance {identity}",
                start=2,
                start_date=schedule_date - dt.timedelta(days=start_offset),
                deadline=schedule_date if start_offset else None,
                repeating_template=identity,
                area="area-work",
                index=index,
                today_index=today_index,
            )

    def populate_supported_fixture(self) -> None:
        insert_task(
            self.connection,
            "today-task",
            title="Today Task",
            notes="Synthetic notes",
            start=2,
            start_date=PLANNING_DATE,
            deadline=PLANNING_DATE + dt.timedelta(days=2),
            today_index=-200001,
            area="area-work",
        )
        self.connection.execute(
            "INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)",
            ("today-task", "tag-waiting"),
        )
        insert_task(
            self.connection,
            "project-template",
            task_type=1,
            title="Project Template",
            area="area-home",
        )
        insert_task(
            self.connection,
            "project-direct-child",
            title="Direct Checklist Item",
            project="project-template",
            index=1,
        )
        insert_task(
            self.connection,
            "project-heading",
            task_type=2,
            title="Heading Not Imported",
            project="project-template",
            index=2,
        )
        insert_task(
            self.connection,
            "project-heading-child",
            title="Nested Checklist Item",
            notes="Intentionally omitted child notes",
            heading="project-heading",
            index=1,
        )

        self.add_recurrence(
            "daily-after-completion",
            16,
            [{"dy": 0}],
            PLANNING_DATE,
            mode=1,
            linked=True,
        )
        self.add_recurrence(
            "weekly-calendar",
            256,
            [{"wd": 1}, {"wd": 5}],
            dt.date(2026, 7, 31),
        )
        self.add_recurrence(
            "monthly-date",
            8,
            [{"dy": 0}],
            dt.date(2026, 8, 1),
        )
        self.add_recurrence(
            "monthly-last",
            8,
            [{"dy": -1}],
            dt.date(2026, 7, 31),
        )
        self.add_recurrence(
            "monthly-ordinal",
            8,
            [{"wd": 4, "wdo": 1}],
            dt.date(2026, 8, 6),
        )
        self.add_recurrence(
            "yearly-fixed",
            4,
            [{"mo": 0, "dy": 24}],
            dt.date(2027, 1, 25),
        )
        self.add_recurrence(
            "yearly-last",
            4,
            [{"mo": 9, "dy": -1}],
            dt.date(2026, 10, 31),
        )
        self.add_recurrence(
            "yearly-ordinal",
            4,
            [{"mo": 4, "wd": 0, "wdo": 2}],
            dt.date(2027, 5, 9),
        )
        self.connection.execute(
            "INSERT INTO TMTaskTag (tasks, tags) VALUES (?, ?)",
            ("weekly-calendar", "tag-rechecking"),
        )
        insert_checklist_item(
            self.connection,
            "today-native-open",
            "today-task",
            "  Verbatim native item  ",
            index=2,
        )
        insert_checklist_item(
            self.connection,
            "today-native-completed",
            "today-task",
            "Completed native item",
            index=4,
            completed=True,
        )
        insert_checklist_item(
            self.connection,
            "linked-native-completed",
            "daily-after-completion-instance",
            "Current occurrence item",
            index=0,
            completed=True,
        )
        insert_checklist_item(
            self.connection,
            "linked-template-native",
            "daily-after-completion",
            "Future occurrence item",
            index=0,
        )
        insert_checklist_item(
            self.connection,
            "waiting-template-native",
            "weekly-calendar",
            "Waiting recurrence item",
            index=0,
        )
        self.connection.commit()

    def build(self) -> tuple[dict[str, object], dict[str, object]]:
        self.connection.close()
        immutable = MIGRATION.open_snapshot(self.snapshot_path)
        try:
            envelope, report = MIGRATION.build_migration(
                immutable,
                source_path=self.snapshot_path,
                planning_date=PLANNING_DATE,
                planning_timezone="America/Los_Angeles",
                base_export=base_export(),
            )
            assert envelope is not None
            return envelope, report
        finally:
            immutable.close()

    def test_builds_deterministic_schema_13_graph_for_supported_shapes(self) -> None:
        self.populate_supported_fixture()
        envelope, report = self.build()

        self.assertEqual(report["source"]["selected_rows"], 11)
        self.assertEqual(report["source"]["expected_target_tasks"], 10)
        self.assertEqual(report["source"]["project_children"], 2)
        self.assertEqual(report["source"]["native_checklist_items"], 4)
        self.assertEqual(report["source"]["native_checklist_items_completed"], 2)
        self.assertEqual(report["source"]["native_checklist_tasks"], 3)
        self.assertEqual(report["source"]["recurrence_template_checklist_items"], 2)
        self.assertEqual(
            report["source"]["project_children_with_intentionally_omitted_notes"],
            1,
        )
        self.assertEqual(report["recurrence"]["next_dates_verified"], 7)
        self.assertEqual(report["recurrence"]["linked_without_stored_next"], 1)
        self.assertEqual(report["recurrence"]["unsupported_shapes"], 0)
        self.assertTrue(all(report["invariants"].values()))

        data = envelope["data"]
        self.assertEqual(len(data["tasks_todos"]), 10)
        self.assertEqual(len(data["tasks_history_events"]), 10)
        self.assertEqual(len(data["tasks_checklist_items"]), 6)
        self.assertEqual(len(data["tasks_recurrence_definitions"]), 8)
        self.assertEqual(len(data["tasks_recurrence_revisions"]), 8)
        self.assertEqual(len(data["tasks_recurrence_occurrences"]), 8)
        today = next(task for task in data["tasks_todos"] if task["title"] == "Today Task")
        self.assertIsNone(today["start_date"])
        self.assertEqual(today["today_section"], "inbox")
        self.assertEqual(today["actionability"], "waiting")
        self.assertEqual(today["area_id"], "10000000-0000-4000-8000-000000000001")
        self.assertEqual(data["tasks_areas"][0]["revision"], 1)
        self.assertEqual(data["tasks_user_settings"][0]["revision"], 1)

        project = next(
            task for task in data["tasks_todos"] if task["title"] == "Project Template"
        )
        self.assertEqual(project["destination"], "someday")
        self.assertEqual(
            [
                item["title"]
                for item in sorted(
                    [
                        item
                        for item in data["tasks_checklist_items"]
                        if item["task_id"] == project["id"]
                    ],
                    key=lambda item: item["order_key"],
                )
            ],
            ["Direct Checklist Item", "Nested Checklist Item"],
        )
        today_items = sorted(
            [
                item
                for item in data["tasks_checklist_items"]
                if item["task_id"] == today["id"]
            ],
            key=lambda item: item["order_key"],
        )
        self.assertEqual(
            [item["title"] for item in today_items],
            ["  Verbatim native item  ", "Completed native item"],
        )
        self.assertEqual(
            [item["completed"] for item in today_items],
            [False, True],
        )
        self.assertIsNone(today_items[0]["completed_at"])
        self.assertIsNotNone(today_items[1]["completed_at"])
        daily_revision = next(
            revision
            for revision in data["tasks_template_revisions"]
            if revision["name"] == "Synthetic Instance daily-after-completion"
        )
        self.assertEqual(
            [
                item["title"]
                for item in daily_revision["snapshot"]["root"]["checklist"]
            ],
            ["Future occurrence item"],
        )
        weekly_revision = next(
            revision
            for revision in data["tasks_template_revisions"]
            if revision["name"] == "Synthetic Recurrence weekly-calendar"
        )
        self.assertEqual(
            [
                item["title"]
                for item in weekly_revision["snapshot"]["root"]["checklist"]
            ],
            ["Waiting recurrence item"],
        )
        self.assertEqual(
            {
                revision["rule_config"].get("yearly_kind")
                for revision in data["tasks_recurrence_revisions"]
                if revision["frequency"] == "yearly"
            },
            {"fixed_date", "last_day", "ordinal_weekday"},
        )
        self.assertFalse(any(
            task["source_kind"]
            or task["source_url"]
            or task["source_title"]
            or task["source_external_id"]
            for task in data["tasks_todos"]
        ))
        self.assertTrue(all(
            event["transition"] == "baseline"
            and event["result_revision"] == 1
            and event["before_state"] is None
            for event in data["tasks_history_events"]
        ))

        first_digest = report["target"]["target_digest"]
        rebuilt, rebuilt_report = self.build()
        self.assertEqual(rebuilt_report["target"]["target_digest"], first_digest)
        self.assertEqual(
            json.dumps(rebuilt, sort_keys=True),
            json.dumps(envelope, sort_keys=True),
        )

    def test_rejects_unmapped_reminders(self) -> None:
        insert_task(
            self.connection,
            "reminder-task",
            start=2,
            start_date=PLANNING_DATE,
            reminder_time=(9 << 26) | (30 << 20),
        )
        self.connection.commit()
        self.connection.close()
        immutable = MIGRATION.open_snapshot(self.snapshot_path)
        try:
            with self.assertRaisesRegex(
                MIGRATION.MigrationError,
                "unsupported reminder",
            ):
                MIGRATION.build_migration(
                    immutable,
                    source_path=self.snapshot_path,
                    planning_date=PLANNING_DATE,
                    planning_timezone="America/Los_Angeles",
                    base_export=None,
                )
        finally:
            immutable.close()

    def test_maps_a_start_crossing_midnight_to_today_inbox(self) -> None:
        insert_task(
            self.connection,
            "crossed-start",
            title="Crossed Start",
            start=2,
            start_date=PLANNING_DATE - dt.timedelta(days=1),
        )
        self.connection.commit()

        envelope, report = self.build()
        crossed = next(
            task
            for task in envelope["data"]["tasks_todos"]
            if task["title"] == "Crossed Start"
        )
        self.assertIsNone(crossed["start_date"])
        self.assertEqual(crossed["today_section"], "inbox")
        self.assertEqual(report["mapped"]["planning"]["today_inbox"], 1)

    def test_preserves_manual_order_across_one_off_and_recurrence_tasks(self) -> None:
        insert_task(
            self.connection,
            "later-one-off",
            title="Later One-Off",
            index=20,
            area="area-work",
        )
        self.add_recurrence(
            "earlier-recurrence",
            256,
            [{"wd": 2}],
            dt.date(2026, 8, 4),
            index=10,
        )
        self.connection.commit()

        envelope, _ = self.build()
        tasks_by_title = {
            task["title"]: task
            for task in envelope["data"]["tasks_todos"]
        }
        self.assertLess(
            tasks_by_title["Synthetic Recurrence earlier-recurrence"]["order_key"],
            tasks_by_title["Later One-Off"]["order_key"],
        )

    def test_rejects_unsupported_recurrence_shapes(self) -> None:
        insert_task(
            self.connection,
            "unsupported-recurrence",
            rule=recurrence_rule(999, [{"dy": 0}], PLANNING_DATE),
            next_start=PLANNING_DATE,
        )
        self.connection.commit()
        self.connection.close()
        immutable = MIGRATION.open_snapshot(self.snapshot_path)
        try:
            with self.assertRaisesRegex(
                MIGRATION.MigrationError,
                "unsupported fields",
            ):
                MIGRATION.build_migration(
                    immutable,
                    source_path=self.snapshot_path,
                    planning_date=PLANNING_DATE,
                    planning_timezone="America/Los_Angeles",
                    base_export=None,
                )
        finally:
            immutable.close()

    def test_rejects_incompatible_snapshot_schema(self) -> None:
        self.connection.close()
        self.snapshot_path.unlink()
        connection = sqlite3.connect(self.snapshot_path)
        create_schema(connection, include_heading=False)
        connection.close()
        with self.assertRaisesRegex(
            MIGRATION.MigrationError,
            "missing required columns",
        ):
            MIGRATION.open_snapshot(self.snapshot_path)


if __name__ == "__main__":
    unittest.main()
