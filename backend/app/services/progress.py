"""
progress.py — Real-time event and progress tracking for SiteScope pipelines.

Hard rule: Every event emitted MUST come from real execution with actual numbers
(counts, parameters, durations, results). No fake timers or scripted sleep delays.
"""

from __future__ import annotations

import asyncio
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Callable, Generator, Literal


LogLevel = Literal["info", "success", "warn", "error"]


class StepContext:
    def __init__(self, name: str, reporter: ProgressReporter):
        self.name = name
        self.reporter = reporter
        self.summary: str | None = None
        self.detail: Any = None
        self.level: LogLevel = "success"

    def set_summary(self, summary: str, detail: Any = None, level: LogLevel = "success") -> None:
        self.summary = summary
        self.detail = detail
        self.level = level


class ProgressReporter:
    def __init__(
        self,
        queue: asyncio.Queue | None = None,
        callback: Callable[[dict[str, Any]], None] | None = None,
        console_print: bool = True,
    ):
        self.queue = queue
        self.callback = callback
        self.console_print = console_print
        self.current_stage: str = "Initialization"
        self.current_progress: float = 0.0
        self.start_time: float = time.perf_counter()
        self.events: list[dict[str, Any]] = []

    def _emit(
        self,
        message: str,
        level: LogLevel = "info",
        detail: Any = None,
        progress: float | None = None,
        elapsed_ms: int | None = None,
    ) -> dict[str, Any]:
        if progress is not None:
            self.current_progress = max(0.0, min(1.0, progress))
        if elapsed_ms is None:
            elapsed_ms = int((time.perf_counter() - self.start_time) * 1000)

        event = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "stage": self.current_stage,
            "level": level,
            "message": message,
            "detail": detail,
            "progress": round(self.current_progress, 3),
            "elapsed_ms": elapsed_ms,
        }
        self.events.append(event)

        if self.console_print:
            prefix = {
                "info": "  [INFO] ",
                "success": "  [OK]   ",
                "warn": "  [WARN] ",
                "error": "  [ERR]  ",
            }.get(level, "  [INFO] ")
            print(f"[{self.current_stage}] {prefix}{message} ({elapsed_ms}ms)")

        if self.callback:
            try:
                self.callback(event)
            except Exception:
                pass

        if self.queue:
            try:
                self.queue.put_nowait(event)
            except Exception:
                pass

        return event

    def stage(self, name: str) -> None:
        self.current_stage = name
        self._emit(f"Entering stage: {name}", level="info")

    def log(self, message: str, level: LogLevel = "info", detail: Any = None) -> None:
        self._emit(message, level=level, detail=detail)

    def progress(self, fraction: float, message: str | None = None) -> None:
        self.current_progress = fraction
        if message:
            self._emit(message, level="info", progress=fraction)

    def done(self, result: Any = None, message: str = "Processing completed successfully") -> None:
        self._emit(message, level="success", detail=result, progress=1.0)

    def error(self, message: str, detail: Any = None) -> None:
        self._emit(message, level="error", detail=detail)

    @contextmanager
    def step(self, name: str) -> Generator[StepContext, None, None]:
        t0 = time.perf_counter()
        self._emit(f"Started: {name}", level="info")
        ctx = StepContext(name, self)
        try:
            yield ctx
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            summary = ctx.summary or f"Finished: {name}"
            self._emit(summary, level=ctx.level, detail=ctx.detail, elapsed_ms=elapsed_ms)
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            self._emit(f"Failed: {name} — {e}", level="error", detail=str(e), elapsed_ms=elapsed_ms)
            raise
