-- CreateEnum
CREATE TYPE "public"."AccountMembershipStatus" AS ENUM ('pending', 'active', 'inactive');

-- CreateTable
CREATE TABLE "account_memberships" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "public"."AccountMembershipStatus" NOT NULL DEFAULT 'active',
    "member_since" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "account_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_memberships_account_id_user_id_key" ON "account_memberships"("account_id", "user_id");

-- CreateIndex
CREATE INDEX "account_memberships_account_id_idx" ON "account_memberships"("account_id");

-- CreateIndex
CREATE INDEX "account_memberships_user_id_idx" ON "account_memberships"("user_id");

-- CreateIndex
CREATE INDEX "account_memberships_status_idx" ON "account_memberships"("status");

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_memberships" ADD CONSTRAINT "account_memberships_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
