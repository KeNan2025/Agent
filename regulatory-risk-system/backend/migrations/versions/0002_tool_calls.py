"""add agent_name / turn_index to skill_calls; create agent_turn_log

Revision ID: 0002_tool_calls
Revises: 0001_initial
Create Date: 2026-06-06
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0002_tool_calls"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("skill_calls", sa.Column("agent_name", sa.String(64), nullable=True))
    op.add_column("skill_calls", sa.Column("turn_index", sa.Integer(), nullable=True))
    op.add_column("skill_calls", sa.Column("is_tool_call", sa.Boolean(), nullable=True))
    op.create_index("ix_skill_calls_agent_name", "skill_calls", ["agent_name"])

    op.create_table(
        "agent_turn_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("scan_id", sa.String(64), index=True, nullable=False),
        sa.Column("agent_name", sa.String(64), index=True, nullable=False),
        sa.Column("turn_index", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(32), nullable=True),
        sa.Column("content_excerpt", sa.Text(), default=""),
        sa.Column("tool_calls_json", sa.Text(), default="[]"),
        sa.Column("tool_results_json", sa.Text(), default="[]"),
        sa.Column("latency_ms", sa.Integer(), default=0),
        sa.Column("prompt_tokens", sa.Integer(), default=0),
        sa.Column("completion_tokens", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("agent_turn_log")
    op.drop_index("ix_skill_calls_agent_name", table_name="skill_calls")
    op.drop_column("skill_calls", "is_tool_call")
    op.drop_column("skill_calls", "turn_index")
    op.drop_column("skill_calls", "agent_name")
