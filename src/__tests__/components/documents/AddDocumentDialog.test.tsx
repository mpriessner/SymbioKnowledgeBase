import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AddDocumentDialog } from "@/components/documents/AddDocumentDialog";

const mockFetch = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AddDocumentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("creates a linked document and returns the new page id", async () => {
    const onCreated = vi.fn();
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { id: "page-link-1", title: "Protocol link" } }, 201)
    );

    render(
      <AddDocumentDialog
        isOpen
        onClose={vi.fn()}
        onCreated={onCreated}
        teamspaces={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Link" }));
    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Protocol link" },
    });
    fireEvent.change(screen.getByLabelText("Document URL"), {
      target: { value: "https://example.com/protocol" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("page-link-1"));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/documents",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Protocol link",
          space: "private",
          source: "url",
          url: "https://example.com/protocol",
          tags: [],
        }),
      })
    );
  });

  it("creates an upload document shell and uploads the selected file", async () => {
    const onCreated = vi.fn();
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: "page-upload-1", title: "report.pdf" } }, 201)
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { attachmentId: "attachment-1" } }, 201)
      );

    render(
      <AddDocumentDialog
        isOpen
        onClose={vi.fn()}
        onCreated={onCreated}
        teamspaces={[]}
      />
    );

    const file = new File(["report body"], "report.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("page-upload-1"));
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "/api/documents",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/pages/page-upload-1/attachments",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
  });

  it("shows the server configuration message on the Google Drive tab", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { configured: false, connected: false } })
    );

    render(
      <AddDocumentDialog
        isOpen
        onClose={vi.fn()}
        onCreated={vi.fn()}
        teamspaces={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Google Drive" }));

    expect(
      await screen.findByText("Google Drive is not configured on this server.")
    ).toBeInTheDocument();
  });

  it("searches and imports a selected Google Drive file", async () => {
    const onCreated = vi.fn();
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ data: { configured: true, connected: true } })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            files: [
              {
                id: "drive-file-1",
                name: "Drive protocol.pdf",
                mimeType: "application/pdf",
                modifiedTime: "2026-07-14T10:00:00.000Z",
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: "page-drive-1", title: "Drive protocol.pdf" } }, 201)
      );

    render(
      <AddDocumentDialog
        isOpen
        onClose={vi.fn()}
        onCreated={onCreated}
        teamspaces={[]}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Google Drive" }));
    await screen.findByLabelText("Search Google Drive");
    fireEvent.change(screen.getByLabelText("Search Google Drive"), {
      target: { value: "protocol" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Drive protocol.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import Drive protocol.pdf" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("page-drive-1"));
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/integrations/google-drive/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          file_id: "drive-file-1",
          space: "private",
          tags: [],
        }),
      })
    );
  });
});
