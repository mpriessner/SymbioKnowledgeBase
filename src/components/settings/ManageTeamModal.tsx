"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTeamspaces, teamspaceKeys } from "@/hooks/useTeamspaces";

interface TeamMember {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  userName: string;
  userEmail: string;
  createdAt: string;
}

interface ManageTeamModalProps {
  teamId: string;
  onClose: () => void;
}

const roleBadgeColors: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  MEMBER: "bg-green-100 text-green-800",
  GUEST: "bg-gray-100 text-gray-800",
};

export function ManageTeamModal({ teamId, onClose }: ManageTeamModalProps) {
  const queryClient = useQueryClient();
  const { data: teamspaces } = useTeamspaces();
  const team = teamspaces?.find((t) => t.id === teamId);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Edit team fields
  const [editName, setEditName] = useState(team?.name || "");
  const [editIcon, setEditIcon] = useState(team?.icon || "");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  // Invite member
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "GUEST">(
    "MEMBER"
  );
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/teamspaces/${teamId}/members`);
      if (!res.ok) return;
      const json = await res.json();
      setMembers(json.data || []);
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const myRole = team?.role;
  const canEdit = myRole === "OWNER" || myRole === "ADMIN";
  const isOwner = myRole === "OWNER";

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    setInfoMessage("");
    try {
      const res = await fetch(`/api/teamspaces/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          icon: editIcon || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setInfoMessage(err.error?.message || "Failed to save");
        return;
      }
      setInfoMessage("Team info updated");
      queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
    } catch {
      setInfoMessage("Network error");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangeRole = async (
    userId: string,
    newRole: string
  ) => {
    if (newRole === "OWNER") {
      const confirmed = window.confirm(
        "You will be demoted to ADMIN. Continue?"
      );
      if (!confirmed) return;
    }
    try {
      const res = await fetch(
        `/api/teamspaces/${teamId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      if (res.ok) {
        fetchMembers();
        queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
      }
    } catch {
      // ignore
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    const confirmed = window.confirm(
      `Remove ${userName} from ${team?.name}?`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(
        `/api/teamspaces/${teamId}/members/${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchMembers();
        queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
      }
    } catch {
      // ignore
    }
  };

  const handleLeave = async () => {
    const confirmed = window.confirm(
      `Leave ${team?.name}? You will lose access to all shared pages.`
    );
    if (!confirmed) return;
    // Find our own member record
    const myMember = members.find(
      (m) => m.role === myRole
    );
    if (!myMember) return;
    try {
      const res = await fetch(
        `/api/teamspaces/${teamId}/members/${myMember.userId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
        onClose();
      }
    } catch {
      // ignore
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError("");

    try {
      // Look up user by email
      const lookupRes = await fetch(
        `/api/users?email=${encodeURIComponent(inviteEmail.trim())}`
      );
      if (!lookupRes.ok) {
        setInviteError("Failed to look up user");
        return;
      }
      const lookupData = await lookupRes.json();
      const users = lookupData.data || [];
      if (users.length === 0) {
        setInviteError("No user with this email in your workspace");
        return;
      }

      const userId = users[0].id;
      const addRes = await fetch(`/api/teamspaces/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: inviteRole }),
      });
      if (!addRes.ok) {
        const err = await addRes.json();
        setInviteError(err.error?.message || "Failed to invite member");
        return;
      }

      setShowInvite(false);
      setInviteEmail("");
      fetchMembers();
      queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
    } catch {
      setInviteError("Network error");
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteTeam = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teamspaces/${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: teamspaceKeys.all });
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Manage Team
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Team Info */}
        {canEdit && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              Team Info
            </h3>
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Team name"
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <input
                value={editIcon}
                onChange={(e) => setEditIcon(e.target.value)}
                placeholder="Icon emoji"
                maxLength={2}
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveInfo}
                  disabled={savingInfo || !editName.trim()}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingInfo ? "Saving..." : "Save"}
                </button>
                {infoMessage && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {infoMessage}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Members Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              Members
            </h3>
            {canEdit && (
              <button
                onClick={() => setShowInvite(true)}
                className="text-xs px-2 py-1 rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              >
                Invite Member
              </button>
            )}
          </div>

          {loadingMembers ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-[var(--bg-tertiary)] rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--bg-secondary)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {member.userName || member.userEmail}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {member.userEmail}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    {isOwner || (canEdit && member.role !== "OWNER" && member.role !== "ADMIN") ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleChangeRole(member.userId, e.target.value)
                        }
                        disabled={
                          member.role === "OWNER" && ownerCount <= 1 && !isOwner
                        }
                        className="text-xs px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      >
                        {isOwner && (
                          <option value="OWNER">OWNER</option>
                        )}
                        <option value="ADMIN">ADMIN</option>
                        <option value="MEMBER">MEMBER</option>
                        <option value="GUEST">GUEST</option>
                      </select>
                    ) : (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          roleBadgeColors[member.role] || ""
                        }`}
                      >
                        {member.role}
                      </span>
                    )}

                    {canEdit &&
                      !(member.role === "OWNER" && ownerCount <= 1) && (
                        <button
                          onClick={() =>
                            handleRemoveMember(
                              member.userId,
                              member.userName || member.userEmail
                            )
                          }
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                          title="Remove member"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Member Inline Form */}
        {showInvite && (
          <div className="mb-6 p-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-secondary)]">
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              Invite Member
            </h4>
            <form onSubmit={handleInvite} className="space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "ADMIN" | "MEMBER" | "GUEST")
                }
                className="w-full px-3 py-2 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="GUEST">Guest</option>
              </select>
              {inviteError && (
                <p className="text-xs text-red-500">{inviteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {inviting ? "Inviting..." : "Send Invite"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvite(false);
                    setInviteError("");
                  }}
                  className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Leave Team */}
        <div className="mb-6">
          <button
            onClick={handleLeave}
            disabled={isOwner && ownerCount <= 1}
            title={
              isOwner && ownerCount <= 1
                ? "Transfer ownership first"
                : undefined
            }
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Leave Team
          </button>
        </div>

        {/* Danger Zone */}
        {isOwner && (
          <div className="border-t border-[var(--border-default)] pt-4">
            <h3 className="text-sm font-medium text-red-600 mb-2">
              Danger Zone
            </h3>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 text-sm rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete Team
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-primary)]">
                  Delete{" "}
                  <strong>{team?.name}</strong>? All pages will become
                  private.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteTeam}
                    disabled={deleting}
                    className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "Deleting..." : "Yes, Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
