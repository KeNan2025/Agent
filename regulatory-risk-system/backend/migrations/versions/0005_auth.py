"""add user / user_company_pool tables

Revision ID: 0005_auth
Revises: 0003_async_task
Create Date: 2026-06-06
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0005_auth"
down_revision = "0003_async_task"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(64), unique=True, index=True, nullable=False),
        sa.Column("password_hash", sa.String(256), nullable=False),
        sa.Column("role", sa.String(20), default="user"),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "user_company_pool",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), index=True),
        sa.Column("company_code", sa.String(20), index=True),
        sa.Column("added_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_company_pool")
    op.drop_table("user")
