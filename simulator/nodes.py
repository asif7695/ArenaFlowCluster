"""Canonical node roster for ArenaFlowCluster.

64 nodes laid out as an 8x8 matrix (rows A-H, columns 1-8), split into four
regional quadrants exactly as the dashboard design shows:

    cols 1-4      cols 5-8
  +------------+------------+
  | us-east-1  | eu-west-1  |   rows A-D
  +------------+------------+
  | ap-south-1 | us-west-2  |   rows E-H
  +------------+------------+

This module is the base dependency shared by the ML and backend packages so the
whole system agrees on node identity, region and capacity.
"""
from __future__ import annotations

from dataclasses import dataclass

ROWS = "ABCDEFGH"
COLS = 8
NODE_COUNT = ROWS.__len__() * COLS  # 64

REGIONS = ["us-east-1", "eu-west-1", "ap-south-1", "us-west-2"]


@dataclass(frozen=True)
class NodeSpec:
    index: int          # 0..63
    node_id: str        # canonical id, e.g. "node-12"
    label: str          # matrix label, e.g. "C4"
    region: str
    capacity: int       # max concurrent sessions the node can host


def _region_for(row: int, col: int) -> str:
    """Top/bottom half + left/right half -> one of four regional quadrants."""
    return REGIONS[(0 if row < 4 else 2) + (0 if col < 4 else 1)]


def build_roster() -> list[NodeSpec]:
    roster: list[NodeSpec] = []
    for i in range(NODE_COUNT):
        row, col = divmod(i, COLS)
        roster.append(
            NodeSpec(
                index=i,
                node_id=f"node-{i}",
                label=f"{ROWS[row]}{col + 1}",
                region=_region_for(row, col),
                capacity=24 + (i % 5) * 4,  # 24..40, matches design's cap formula
            )
        )
    return roster


ROSTER: list[NodeSpec] = build_roster()
BY_ID: dict[str, NodeSpec] = {n.node_id: n for n in ROSTER}
