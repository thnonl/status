export type CheckStatus = "up" | "degraded" | "not_found" | "down";

export type ProjectDto = {
  _id: string;
  name: string;
  description: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServerDto = {
  _id: string;
  projectId: string;
  name: string;
  url: string;
  healthRoute?: string;
  screenshotRoute?: string;
  description?: string;
  tags: string[];
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  latestCheck?: StatusCheckDto | null;
  uptime24h: number | null;
  uptime10d: number | null;
};

export type StatusCheckDto = {
  _id: string;
  serverId: string;
  url: string;
  status: CheckStatus;
  httpStatus?: number;
  responseTimeMs?: number;
  error?: string;
  screenshotFileId?: string;
  checkedAt: string;
};
