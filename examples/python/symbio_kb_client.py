"""
SymbioKnowledgeBase Agent API — Python Client

A production-ready client for the SymbioKnowledgeBase Agent API.
Provides typed access to pages, search, and knowledge graph endpoints
with built-in rate limit handling and retry logic.

Usage:
    from symbio_kb_client import SymbioKB

    kb = SymbioKB(base_url="https://kb.example.com", api_key="skb_live_...")
    results = kb.search("deployment guide")
    page = kb.read_page(results[0].page_id)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

import requests


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class SymbioKBError(Exception):
    """Base exception for all SymbioKB client errors."""

    def __init__(self, message: str, code: Optional[str] = None, status: Optional[int] = None):
        super().__init__(message)
        self.code = code
        self.status = status


class AuthenticationError(SymbioKBError):
    """Raised when the API key is missing, invalid, or revoked (HTTP 401)."""
    pass


class ForbiddenError(SymbioKBError):
    """Raised when the API key lacks the required scope (HTTP 403)."""
    pass


class NotFoundError(SymbioKBError):
    """Raised when the requested resource does not exist (HTTP 404)."""
    pass


class ValidationError(SymbioKBError):
    """Raised when request parameters fail server-side validation (HTTP 400)."""
    pass


class RateLimitError(SymbioKBError):
    """Raised when rate limiting is exceeded and all retries are exhausted (HTTP 429)."""

    def __init__(self, message: str, retry_after: Optional[int] = None, **kwargs):
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class ServerError(SymbioKBError):
    """Raised for unexpected server-side errors (HTTP 5xx)."""
    pass


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Page:
    """Represents a knowledge base page."""

    id: str
    title: str
    icon: Optional[str] = None
    parent_id: Optional[str] = None
    markdown: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass(frozen=True)
class SearchResult:
    """A single result from a full-text search query."""

    page_id: str
    title: str
    snippet: str
    score: float
    icon: Optional[str] = None


@dataclass(frozen=True)
class PageList:
    """Paginated list of pages returned by list_pages."""

    pages: list[Page] = field(default_factory=list)
    total: int = 0
    limit: int = 50
    offset: int = 0


@dataclass(frozen=True)
class SearchResults:
    """Paginated list of search results returned by search."""

    results: list[SearchResult] = field(default_factory=list)
    total: int = 0
    limit: int = 20
    offset: int = 0


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class SymbioKB:
    """Client for the SymbioKnowledgeBase Agent API.

    Args:
        base_url: The base URL of the SymbioKnowledgeBase instance
                  (e.g. ``"https://kb.example.com"``).  Trailing slashes are
                  stripped automatically.
        api_key:  A bearer token.  For API key auth use a key in the format
                  ``skb_live_<hex>``.  For Supabase JWT auth pass the JWT
                  string directly.
        timeout:  HTTP request timeout in seconds.  Defaults to 30.
        max_retries: Maximum number of automatic retries on 429 responses.
                     Defaults to 3.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout: int = 30,
        max_retries: int = 3,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries

        self._session = requests.Session()
        self._session.headers.update(
            {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _url(self, path: str) -> str:
        """Build a full URL for the given API path."""
        return f"{self.base_url}/api/agent{path}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict] = None,
        json_body: Optional[dict] = None,
    ) -> dict:
        """Execute an HTTP request with rate-limit retry logic.

        Returns the parsed JSON response body on success.
        Raises a typed exception on any error.
        """
        url = self._url(path)
        last_exception: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                resp = self._session.request(
                    method,
                    url,
                    params=params,
                    json=json_body,
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                raise SymbioKBError(f"HTTP request failed: {exc}") from exc

            # --- Rate limit handling (429) ---
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "5"))
                if attempt < self.max_retries:
                    time.sleep(retry_after)
                    continue
                last_exception = RateLimitError(
                    "Rate limit exceeded after all retries",
                    retry_after=retry_after,
                    code="RATE_LIMIT_EXCEEDED",
                    status=429,
                )
                break

            # --- Parse response body ---
            try:
                body = resp.json()
            except ValueError:
                raise ServerError(
                    f"Non-JSON response (HTTP {resp.status_code})",
                    status=resp.status_code,
                )

            # --- Success ---
            if 200 <= resp.status_code < 300:
                return body

            # --- Error mapping ---
            error_obj = body.get("error", {})
            code = error_obj.get("code", "UNKNOWN")
            message = error_obj.get("message", resp.text)

            if resp.status_code == 401:
                raise AuthenticationError(message, code=code, status=401)
            if resp.status_code == 403:
                raise ForbiddenError(message, code=code, status=403)
            if resp.status_code == 404:
                raise NotFoundError(message, code=code, status=404)
            if resp.status_code == 400:
                raise ValidationError(message, code=code, status=400)
            if resp.status_code >= 500:
                raise ServerError(message, code=code, status=resp.status_code)

            raise SymbioKBError(
                f"Unexpected HTTP {resp.status_code}: {message}",
                code=code,
                status=resp.status_code,
            )

        if last_exception:
            raise last_exception

        # Should never reach here, but satisfy the type checker.
        raise SymbioKBError("Request failed unexpectedly")  # pragma: no cover

    # ------------------------------------------------------------------
    # Public API — Search
    # ------------------------------------------------------------------

    def search(
        self,
        query: str,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> SearchResults:
        """Full-text search across all pages in the knowledge base.

        Uses PostgreSQL ``websearch_to_tsquery`` on the server side, so
        standard web-search syntax is supported (e.g. ``"exact phrase"``,
        ``term1 OR term2``).

        Args:
            query:  The search query string (1-500 characters).
            limit:  Maximum number of results to return (1-100, default 20).
            offset: Number of results to skip for pagination (default 0).

        Returns:
            A ``SearchResults`` object containing matching pages with
            context snippets and relevance scores.

        Raises:
            ValidationError: If query parameters are invalid.
        """
        body = self._request(
            "GET",
            "/search",
            params={"q": query, "limit": limit, "offset": offset},
        )
        data = body.get("data", [])
        meta = body.get("meta", {})
        return SearchResults(
            results=[
                SearchResult(
                    page_id=r["page_id"],
                    title=r["title"],
                    snippet=r["snippet"],
                    score=r["score"],
                    icon=r.get("icon"),
                )
                for r in data
            ],
            total=meta.get("total", len(data)),
            limit=meta.get("limit", limit),
            offset=meta.get("offset", offset),
        )

    # ------------------------------------------------------------------
    # Public API — Pages
    # ------------------------------------------------------------------

    def read_page(self, page_id: str) -> Page:
        """Read a single page including its markdown content.

        Args:
            page_id: UUID of the page to read.

        Returns:
            A ``Page`` object with the ``markdown`` field populated.

        Raises:
            NotFoundError: If the page does not exist.
        """
        body = self._request("GET", f"/pages/{page_id}")
        d = body.get("data", {})
        return Page(
            id=d["id"],
            title=d["title"],
            icon=d.get("icon"),
            parent_id=d.get("parent_id"),
            markdown=d.get("markdown", ""),
            created_at=d.get("created_at"),
            updated_at=d.get("updated_at"),
        )

    def create_page(
        self,
        title: str,
        *,
        markdown: Optional[str] = None,
        parent_id: Optional[str] = None,
        icon: Optional[str] = None,
    ) -> Page:
        """Create a new page in the knowledge base.

        Args:
            title:     Page title (1-255 characters).
            markdown:  Optional markdown content for the page body.
            parent_id: Optional UUID of a parent page for nesting.
            icon:      Optional emoji or icon string.

        Returns:
            A ``Page`` object for the newly created page.

        Raises:
            ValidationError: If the title is empty or too long.
            NotFoundError: If the specified parent_id does not exist.
        """
        payload: dict = {"title": title}
        if markdown is not None:
            payload["markdown"] = markdown
        if parent_id is not None:
            payload["parent_id"] = parent_id
        if icon is not None:
            payload["icon"] = icon

        body = self._request("POST", "/pages", json_body=payload)
        d = body.get("data", {})
        return Page(
            id=d["id"],
            title=d["title"],
            created_at=d.get("created_at"),
        )

    def update_page(self, page_id: str, markdown: str) -> Page:
        """Replace the markdown content of an existing page.

        Args:
            page_id:  UUID of the page to update.
            markdown: The new markdown content (replaces existing content).

        Returns:
            A ``Page`` object with the updated timestamp.

        Raises:
            NotFoundError: If the page does not exist.
            ValidationError: If the markdown field is missing.
        """
        body = self._request(
            "PUT",
            f"/pages/{page_id}",
            json_body={"markdown": markdown},
        )
        d = body.get("data", {})
        return Page(
            id=d["id"],
            title=d.get("title", ""),
            updated_at=d.get("updated_at"),
        )

    def list_pages(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        parent_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> PageList:
        """List pages with optional filtering and pagination.

        Args:
            limit:     Maximum number of pages to return (1-100, default 50).
            offset:    Number of pages to skip for pagination (default 0).
            parent_id: Filter to only children of this parent page UUID.
            search:    Filter pages whose title contains this string
                       (case-insensitive).

        Returns:
            A ``PageList`` object with pagination metadata.
        """
        params: dict = {"limit": limit, "offset": offset}
        if parent_id is not None:
            params["parent_id"] = parent_id
        if search is not None:
            params["search"] = search

        body = self._request("GET", "/pages", params=params)
        data = body.get("data", [])
        meta = body.get("meta", {})
        return PageList(
            pages=[
                Page(
                    id=p["id"],
                    title=p["title"],
                    icon=p.get("icon"),
                    parent_id=p.get("parent_id"),
                    created_at=p.get("created_at"),
                    updated_at=p.get("updated_at"),
                )
                for p in data
            ],
            total=meta.get("total", len(data)),
            limit=meta.get("limit", limit),
            offset=meta.get("offset", offset),
        )

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP session."""
        self._session.close()

    def __enter__(self) -> SymbioKB:
        return self

    def __exit__(self, *exc) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Example usage
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import os
    import sys

    base_url = os.environ.get("SYMBIO_KB_URL", "http://localhost:3000")
    api_key = os.environ.get("SYMBIO_KB_API_KEY", "")

    if not api_key:
        print("Set SYMBIO_KB_API_KEY environment variable to run this example.")
        sys.exit(1)

    with SymbioKB(base_url=base_url, api_key=api_key) as kb:
        # --- List pages ---
        print("=== Listing pages ===")
        page_list = kb.list_pages(limit=5)
        print(f"Total pages: {page_list.total}")
        for page in page_list.pages:
            print(f"  [{page.id[:8]}...] {page.title}")

        # --- Create a page ---
        print("\n=== Creating a page ===")
        new_page = kb.create_page(
            title="Agent API Test Page",
            markdown="# Hello from the Python client\n\nThis page was created via the Agent API.",
            icon="🐍",
        )
        print(f"Created page: {new_page.id} — {new_page.title}")

        # --- Read the page back ---
        print("\n=== Reading page ===")
        page = kb.read_page(new_page.id)
        print(f"Title: {page.title}")
        print(f"Markdown:\n{page.markdown}")

        # --- Update the page ---
        print("\n=== Updating page ===")
        updated = kb.update_page(
            new_page.id,
            markdown="# Updated content\n\nThis content was updated via the Agent API.\n\nSee also: [[Other Page]]",
        )
        print(f"Updated at: {updated.updated_at}")

        # --- Search ---
        print("\n=== Searching ===")
        try:
            results = kb.search("Agent API")
            print(f"Found {results.total} results")
            for r in results.results:
                print(f"  [{r.page_id[:8]}...] {r.title} (score: {r.score:.3f})")
                print(f"    {r.snippet}")
        except ValidationError as exc:
            print(f"Search validation error: {exc}")

    print("\nDone.")
