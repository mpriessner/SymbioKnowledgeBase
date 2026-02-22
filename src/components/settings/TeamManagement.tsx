"use client";

import { useState } from "react";
import { useTeamspaces } from "@/hooks/useTeamspaces";
import { CreateTeamModal } from "./CreateTeamModal";
import { ManageTeamModal } from "./ManageTeamModal";

const roleBadgeColors: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  MEMBER: "bg-green-100 text-green-800",
  GUEST: "bg-gray-100 text-gray-800",
};

export function TeamManagement() {
  const { data: teamspaces, isLoading } = useTeamspaces();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Teams
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Create Team
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 border border-[var(--border-default)] rounded-lg animate-pulse"
            >
              <div className="w-10 h-10 rounded bg-[var(--bg-tertiary)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--bg-tertiary)] rounded w-32" />
                <div className="h-3 bg-[var(--bg-tertiary)] rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && teamspaces && teamspaces.length === 0 && (
        <div className="text-center py-8 border border-dashed border-[var(--border-default)] rounded-lg">
          <p className="text-[var(--text-tertiary)]">No teams yet</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Create a team to start collaborating
          </p>
        </div>
      )}

      {!isLoading && teamspaces && teamspaces.length > 0 && (
        <div className="space-y-2">
          {teamspaces.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between p-4 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{team.icon || "👥"}</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {team.name}
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    {team.member_count} member{team.member_count !== 1 && "s"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    roleBadgeColors[team.role] || roleBadgeColors.GUEST
                  }`}
                >
                  {team.role}
                </span>
                <button
                  onClick={() => setSelectedTeamId(team.id)}
                  className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTeamModal onClose={() => setShowCreateModal(false)} />
      )}
      {selectedTeamId && (
        <ManageTeamModal
          teamId={selectedTeamId}
          onClose={() => setSelectedTeamId(null)}
        />
      )}
    </div>
  );
}
