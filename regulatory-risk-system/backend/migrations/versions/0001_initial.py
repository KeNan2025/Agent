"""baseline — initial schema baseline (managed by SQLAlchemy create_all)

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-06

The Phase 1 release uses SQLAlchemy `create_all` for table provisioning,
which keeps the bootstrap path zero-config. This stub revision exists to
anchor the Alembic migration chain; subsequent revisions (0002, 0003, ...)
modify or add tables.
"""
from __future__ import annotations

from alembic import op


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: tables are created by Base.metadata.create_all in app.database.session.init_db()
    pass


def downgrade() -> None:
    pass
