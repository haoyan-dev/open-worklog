from __future__ import annotations

import json
import logging
import os
from datetime import date
from enum import Enum
from typing import Any, cast

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.types import CallToolResult, TextContent
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

API_BASE_URL = os.getenv("OPEN_WORKLOG_API_BASE_URL", "http://localhost:8000/api/v1")
CHARACTER_LIMIT = 25_000
DEFAULT_TIMEOUT = httpx.Timeout(20.0, connect=5.0)

mcp = FastMCP("open_worklog_mcp")


class ResponseFormat(str, Enum):
    """Supported response formats for MCP tools."""

    MARKDOWN = "markdown"
    JSON = "json"


class DailyReportInput(BaseModel):
    """Input parameters for fetching a daily report."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    report_date: date = Field(
        ...,
        description="Report date in ISO format (YYYY-MM-DD).",
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Response format: markdown or json.",
    )


class WeeklyReportInput(BaseModel):
    """Input parameters for fetching a weekly report."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    week_start: date = Field(
        ...,
        description="Week start date (YYYY-MM-DD), typically a Monday.",
    )
    author: str | None = Field(
        default=None,
        description="Optional author name to include in the report.",
    )
    summary_qualitative: str | None = Field(
        default=None,
        description="Optional qualitative summary to include in the report.",
    )
    summary_quantitative: str | None = Field(
        default=None,
        description="Optional quantitative summary to include in the report.",
    )
    next_week_plan: list[str] | None = Field(
        default=None,
        description="Optional list of next-week plan items.",
        max_items=20,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Response format: markdown or json.",
    )


async def _fetch_report(path: str, params: dict[str, Any]) -> dict[str, Any]:
    url = f"{API_BASE_URL.rstrip('/')}{path}"
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


def _format_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        status = cast(httpx.HTTPStatusError, exc).response.status_code
        if status == 404:
            return "Error: Report not found. Check the requested date and try again."
        if status == 422:
            return "Error: Invalid parameters. Ensure dates are YYYY-MM-DD."
        if status == 429:
            return "Error: Rate limit exceeded. Please wait before retrying."
        return f"Error: API request failed with status {status}."
    if isinstance(exc, httpx.TimeoutException):
        return "Error: Request timed out. Please try again."
    return f"Error: Unexpected error ({type(exc).__name__})."


def _error_result(message: str) -> CallToolResult:
    return CallToolResult(
        is_error=True,
        content=[TextContent(type="text", text=message)],
    )


def _truncate_text(value: str) -> str:
    if len(value) <= CHARACTER_LIMIT:
        return value
    suffix = "\n\n[Truncated to fit size limits. Refine the request if needed.]"
    return value[: CHARACTER_LIMIT - len(suffix)] + suffix


def _truncate_daily_report(report: dict[str, Any]) -> dict[str, Any]:
    entries = list(report.get("entries") or [])
    original_count = len(entries)
    if not entries:
        return report

    serialized = json.dumps(report, default=str)
    if len(serialized) <= CHARACTER_LIMIT:
        return report

    truncated_entries = entries
    while len(truncated_entries) > 1:
        truncated_entries = truncated_entries[: max(1, len(truncated_entries) // 2)]
        report["entries"] = truncated_entries
        if len(json.dumps(report, default=str)) <= CHARACTER_LIMIT:
            break

    report["truncated"] = True
    report["truncated_count"] = original_count - len(truncated_entries)
    report["truncation_message"] = (
        "Report truncated to fit size limits. "
        "Consider narrowing the report scope if fewer entries are needed."
    )
    return report


def _truncate_weekly_report(report: dict[str, Any]) -> dict[str, Any]:
    categories = report.get("categories") or {}
    serialized = json.dumps(report, default=str)
    if len(serialized) <= CHARACTER_LIMIT:
        return report

    category_keys = ["routine_work", "okr", "team_contribution", "company_contribution"]
    truncation_counts: dict[str, int] = {key: 0 for key in category_keys}

    while len(serialized) > CHARACTER_LIMIT:
        reduced_any = False
        for key in category_keys:
            entries = list(categories.get(key) or [])
            if len(entries) <= 1:
                continue
            new_entries = entries[: max(1, len(entries) // 2)]
            truncation_counts[key] += len(entries) - len(new_entries)
            categories[key] = new_entries
            reduced_any = True

        report["categories"] = categories
        serialized = json.dumps(report, default=str)
        if not reduced_any:
            break

    report["truncated"] = True
    report["truncation_message"] = (
        "Weekly report truncated to fit size limits. "
        "Consider reducing the report scope if fewer entries are needed."
    )
    report["truncation_counts"] = {k: v for k, v in truncation_counts.items() if v}
    return report


def _format_totals(totals: dict[str, Any] | None) -> str:
    if not totals:
        return ""
    lines = [f"Total Hours: {totals.get('total_hours', 0):.2f}"]
    by_category = totals.get("by_category") or {}
    if by_category:
        lines.append("By Category:")
        for category, hours in by_category.items():
            lines.append(f"- {category}: {float(hours):.2f}")
    return "\n".join(lines)


def _format_entry(entry: dict[str, Any]) -> str:
    project_name = entry.get("project_name") or f"Project {entry.get('project_id')}"
    task = entry.get("task", "")
    hours = entry.get("hours", 0)
    additional_hours = entry.get("additional_hours", 0)
    category = entry.get("category")
    status = entry.get("status")
    notes = entry.get("notes")
    uuid = entry.get("uuid")

    lines = [f"- {project_name}: {task}"]
    lines.append(
        f"  - Hours: {float(hours):.2f} (+{float(additional_hours):.2f} additional)"
    )
    if category:
        lines.append(f"  - Category: {category}")
    if status:
        lines.append(f"  - Status: {status}")
    if notes:
        lines.append(f"  - Notes: {notes}")
    if uuid:
        lines.append(f"  - UUID: {uuid}")
    return "\n".join(lines)


def _render_daily_markdown(report: dict[str, Any]) -> str:
    title = f"# Daily Report ({report.get('date', '')})"
    totals = _format_totals(report.get("totals"))
    entries = report.get("entries") or []
    entries_block = (
        "\n".join(_format_entry(entry) for entry in entries)
        if entries
        else "- No entries."
    )

    extra = ""
    if report.get("truncated"):
        extra = f"\n\n> {report.get('truncation_message', 'Report truncated.') }"

    return "\n\n".join([title, totals, "## Entries", entries_block]) + extra


def _render_weekly_markdown(report: dict[str, Any]) -> str:
    title = f"# Weekly Report ({report.get('week_id', '')})"
    date_range = f"{report.get('week_start', '')} → {report.get('week_end', '')}"
    author = report.get("author")
    summary = report.get("summary") or {}
    plan = report.get("next_week_plan") or []

    lines = [title, f"**Week:** {date_range}"]
    if author:
        lines.append(f"**Author:** {author}")

    if summary:
        lines.append("\n## Summary")
        if summary.get("qualitative"):
            lines.append(f"- Qualitative: {summary.get('qualitative')}")
        if summary.get("quantitative"):
            lines.append(f"- Quantitative: {summary.get('quantitative')}")

    if plan:
        lines.append("\n## Next Week Plan")
        lines.extend(f"- {item}" for item in plan)

    totals = _format_totals(report.get("totals"))
    if totals:
        lines.append("\n## Totals")
        lines.append(totals)

    categories = report.get("categories") or {}
    category_map = {
        "routine_work": "Routine Work",
        "okr": "OKR",
        "team_contribution": "Team Contribution",
        "company_contribution": "Company Contribution",
    }
    for key, label in category_map.items():
        entries = categories.get(key) or []
        lines.append(f"\n## {label}")
        if entries:
            lines.append("\n".join(_format_entry(entry) for entry in entries))
        else:
            lines.append("- No entries.")

    if report.get("truncated"):
        lines.append("\n> " + report.get("truncation_message", "Report truncated."))

    return "\n".join(lines)


def _build_result(
    report: dict[str, Any], markdown: str, response_format: ResponseFormat
) -> CallToolResult:
    if response_format == ResponseFormat.JSON:
        text = json.dumps(report, indent=2, default=str)
    else:
        text = markdown

    text = _truncate_text(text)

    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structured_content=report,
    )


@mcp.tool(
    name="open_worklog_get_daily_report",
    annotations={
        "title": "Get Daily Report",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def open_worklog_get_daily_report(params: DailyReportInput) -> CallToolResult:
    """Fetch a daily report from the Open Worklog backend service.

    Args:
        params: Daily report parameters (date and response format).

    Returns:
        CallToolResult containing the report in markdown or JSON.
    """
    try:
        report = await _fetch_report(
            "/reports/daily",
            params={"date": params.report_date.isoformat()},
        )
    except Exception as exc:
        logger.exception("Failed to fetch daily report")
        return _error_result(_format_error_message(exc))

    report = _truncate_daily_report(report)
    markdown = _render_daily_markdown(report)
    return _build_result(report, markdown, params.response_format)


@mcp.tool(
    name="open_worklog_get_weekly_report",
    annotations={
        "title": "Get Weekly Report",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def open_worklog_get_weekly_report(params: WeeklyReportInput) -> CallToolResult:
    """Fetch a weekly report from the Open Worklog backend service.

    Args:
        params: Weekly report parameters (week start date and optional metadata).

    Returns:
        CallToolResult containing the report in markdown or JSON.
    """
    query_params: dict[str, Any] = {"week_start": params.week_start.isoformat()}
    if params.author:
        query_params["author"] = params.author
    if params.summary_qualitative:
        query_params["summary_qualitative"] = params.summary_qualitative
    if params.summary_quantitative:
        query_params["summary_quantitative"] = params.summary_quantitative
    if params.next_week_plan:
        query_params["next_week_plan"] = params.next_week_plan

    try:
        report = await _fetch_report("/reports/weekly", params=query_params)
    except Exception as exc:
        logger.exception("Failed to fetch weekly report")
        return _error_result(_format_error_message(exc))

    report = _truncate_weekly_report(report)
    markdown = _render_weekly_markdown(report)
    return _build_result(report, markdown, params.response_format)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
