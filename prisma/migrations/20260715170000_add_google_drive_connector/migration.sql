-- A71-12: persist per-user Google Drive OAuth connections and single-use
-- OAuth state. Refresh tokens are encrypted by the application before insert.

CREATE TABLE "google_drive_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "scopes" TEXT[],
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "google_drive_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_google_drive_connections_tenant_user"
    ON "google_drive_connections"("tenant_id", "user_id");
CREATE INDEX "idx_google_drive_connections_tenant_id"
    ON "google_drive_connections"("tenant_id");
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");
CREATE INDEX "idx_oauth_states_expires_at" ON "oauth_states"("expires_at");

ALTER TABLE "google_drive_connections"
    ADD CONSTRAINT "google_drive_connections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_drive_connections"
    ADD CONSTRAINT "google_drive_connections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_states"
    ADD CONSTRAINT "oauth_states_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_states"
    ADD CONSTRAINT "oauth_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
