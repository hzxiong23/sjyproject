#!/usr/bin/env python3
"""Serve the static demo locally with single-range media support."""

from __future__ import annotations

import argparse
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class RangeRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):  # type: ignore[no-untyped-def]
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        content_type = self.guess_type(path)
        try:
            source = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        stat = os.fstat(source.fileno())
        size = stat.st_size
        range_header = self.headers.get("Range")
        byte_range = self._parse_range(range_header, size) if range_header else None
        if range_header and byte_range is None:
            source.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        self._byte_range = byte_range
        if byte_range is None:
            self.send_response(200)
            content_length = size
        else:
            start, end = byte_range
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            content_length = end - start + 1

        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(content_length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
        self.end_headers()
        return source

    @staticmethod
    def _parse_range(header: str, size: int) -> tuple[int, int] | None:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
        if not match or size <= 0:
            return None
        first, last = match.groups()
        if not first and not last:
            return None
        if not first:
            length = int(last)
            if length <= 0:
                return None
            return max(0, size - length), size - 1
        start = int(first)
        end = int(last) if last else size - 1
        if start >= size or end < start:
            return None
        return start, min(end, size - 1)

    def copyfile(self, source, outputfile):  # type: ignore[no-untyped-def]
        byte_range = getattr(self, "_byte_range", None)
        if byte_range is None:
            return super().copyfile(source, outputfile)
        start, end = byte_range
        source.seek(start)
        remaining = end - start + 1
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


class PreviewServer(ThreadingHTTPServer):
    """Ignore media-request cancellations caused by browser seeks and switches."""

    def handle_error(self, request, client_address):  # type: ignore[no-untyped-def]
        error = sys.exc_info()[1]
        if isinstance(error, (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    root = args.directory.resolve()
    handler = partial(RangeRequestHandler, directory=str(root))
    server = PreviewServer((args.bind, args.port), handler)
    print(f"LiveDirector project page: http://{args.bind}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
