"""add async_task / scheduled_job / experience_event tables

Revision ID: 0003_async_task
Revises: 0002_tool_calls
Create Date: 2026-06-06
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0003_async_task"
down_revision = "0002_tool_calls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "async_task",
        sa.Column("task_id", sa.String(64), primary_key=True),
        sa.Column("scan_id", sa.String(64), index=True, nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),  # scan / train / review
        sa.Column("status", sa.String(16), default="pending", index=True),
        sa.Column("input_json", sa.Text(), default="{}"),
        sa.Column("output_json", sa.Text(), default="{}"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "scheduled_job",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("trigger_type", sa.String(16), nullable=False),  # cron / interval
        sa.Column("trigger_args_json", sa.Text(), default="{}"),
        sa.Column("enabled", sa.Boolean(), default=True),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "experience_event",
        sa.Column("event_id", sa.String(64), primary_key=True),
        sa.Column("scan_id", sa.String(64), index=True, nullable=False),
        sa.Column("company_code", sa.String(20), index=True, nullable=False),
        sa.Column("window_days", sa.Integer(), default=60),
        sa.Column("scan_date", sa.Date(), nullable=True),
        sa.Column("due_at", sa.Date(), index=True, nullable=True),
        sa.Column("predicted_probability", sa.Float(), default=0.0),
        sa.Column("predicted_risk_level", sa.String(20), default=""),
        sa.Column("label", sa.Integer(), nullable=True),  # 1=hit, 0=miss
        sa.Column("ground_truth_inquiry_id", sa.String(64), nullable=True),
        sa.Column("state", sa.String(20), default="pending_review"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("experience_event")
    op.drop_table("scheduled_job")
    op.drop_table("async_task")
