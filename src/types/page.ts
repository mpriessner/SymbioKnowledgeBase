export interface Page {
  id: string;
  tenantId: string;
  parentId: string | null;
  teamspaceId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageTreeNode extends Page {
  children: PageTreeNode[];
}

export interface CreatePageInput {
  title?: string;
  parentId?: string | null;
  teamspaceId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
}

export interface UpdatePageInput {
  title?: string;
  parentId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
}
