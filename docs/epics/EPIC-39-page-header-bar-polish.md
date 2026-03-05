# EPIC-39: Page Header Bar Polish

## Goal

Improve the visual clarity of the page header bar (breadcrumb navigation row) so that
action buttons (Download, Favorite, Share) are clearly perceived as part of the
persistent header rather than part of the scrollable page content below.

## Background

The `BreadcrumbsWrapper` already renders `PageActions` (Download, Favorite, Share)
inside the `Breadcrumbs` component at the right side of the header bar. However, the
header bar has no visible bottom border or background differentiation, making the
buttons appear to float "on the page" instead of being anchored to the header.

Users expect these buttons to be visually on the same hierarchy level as the Home icon
and breadcrumb trail, with a clear separation from the page content below.

## Stories

| ID | Title | Points |
|----|-------|--------|
| SKB-39.1 | Visual separation and action alignment in page header bar | 2 |

## Success Criteria

- Page header bar is visually distinct from the scrollable page content
- Download, Favorite, and Share buttons are clearly part of the header, not the page
- Breadcrumb trail and action buttons are visually aligned on the same row
- Works in both light and dark modes
