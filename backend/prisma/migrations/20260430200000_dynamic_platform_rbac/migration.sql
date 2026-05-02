-- Dynamic platform RBAC (roles + permissions catalogs). UserAccount.role becomes VARCHAR; optional FK platform_role_id.

CREATE TABLE "platform_permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_permissions_code_key" ON "platform_permissions"("code");
CREATE INDEX "platform_permissions_category_idx" ON "platform_permissions"("category");

CREATE TABLE "platform_roles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_assignable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_roles_slug_key" ON "platform_roles"("slug");
CREATE INDEX "platform_roles_is_active_idx" ON "platform_roles"("is_active");

CREATE TABLE "platform_role_permissions" (
    "platform_role_id" UUID NOT NULL,
    "platform_permission_id" UUID NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("platform_role_id","platform_permission_id")
);

CREATE INDEX "platform_role_permissions_platform_permission_id_idx" ON "platform_role_permissions"("platform_permission_id");

ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_platform_permission_id_fkey" FOREIGN KEY ("platform_permission_id") REFERENCES "platform_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_accounts" ADD COLUMN "platform_role_id" UUID;

ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "platform_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "user_accounts_platform_role_id_idx" ON "user_accounts"("platform_role_id");

ALTER TABLE "user_accounts" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user_accounts" ALTER COLUMN "role" TYPE VARCHAR(64) USING ("role"::text);
ALTER TABLE "user_accounts" ALTER COLUMN "role" SET DEFAULT 'supplier';

DROP TYPE IF EXISTS "UserAccountRole";
