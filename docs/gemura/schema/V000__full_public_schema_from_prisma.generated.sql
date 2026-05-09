-- =============================================================================
-- V000 - Gemura: full public schema (generated)
-- =============================================================================
-- Project:     Gemura / Orora platform (NestJS + Prisma)
-- Source:      backend/prisma/schema.prisma
-- Generator:   npx prisma migrate diff --from-empty --to-schema-datamodel
-- Reference:   Umucyo v2 schema layout & conventions (Flyway-style filenames)
--               /Applications/AMPPS/www/RPPA/umucyo/workspace/v2/schema/README.md
-- =============================================================================
-- This file is documentation / greenfield bootstrap SQL. For incremental,
-- authoritative migrations use backend/prisma/migrations/.
--
-- Not idempotent: running against a database that already has objects will
-- fail unless you target an empty database or adapt with DROP / IF NOT EXISTS.
-- =============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('tenant', 'branch', 'admin');

-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."UserAccountType" AS ENUM ('mcc', 'agent', 'collector', 'veterinarian', 'supplier', 'customer', 'farmer', 'owner');

-- CreateEnum
CREATE TYPE "public"."UserAccountStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "public"."RegistrationType" AS ENUM ('self', 'referred', 'onboarded');

-- CreateEnum
CREATE TYPE "public"."MccOnboardingReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');

-- CreateEnum
CREATE TYPE "public"."MilkSaleStatus" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'deleted');

-- CreateEnum
CREATE TYPE "public"."MccDeliverySourceType" AS ENUM ('direct', 'umucunda_a', 'umucunda_b');

-- CreateEnum
CREATE TYPE "public"."MccMilkManifestStatus" AS ENUM ('draft', 'submitted', 'accepted', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "public"."MccMilkTestOutcome" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "public"."MccSourceResolutionStatus" AS ENUM ('unresolved', 'resolved', 'secondary_test', 'frozen', 'auto_zero');

-- CreateEnum
CREATE TYPE "public"."RelationshipStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."AccountMembershipStatus" AS ENUM ('pending', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."WalletType" AS ENUM ('saving', 'regular');

-- CreateEnum
CREATE TYPE "public"."WalletStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('active', 'inactive', 'out_of_stock');

-- CreateEnum
CREATE TYPE "public"."FeedPostStatus" AS ENUM ('active', 'inactive', 'deleted');

-- CreateEnum
CREATE TYPE "public"."FeedStoryStatus" AS ENUM ('active', 'inactive', 'expired');

-- CreateEnum
CREATE TYPE "public"."InteractionType" AS ENUM ('like', 'share', 'comment', 'bookmark');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('info', 'warning', 'error', 'success');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('unread', 'read', 'archived');

-- CreateEnum
CREATE TYPE "public"."InventorySaleBuyerType" AS ENUM ('supplier', 'customer', 'other');

-- CreateEnum
CREATE TYPE "public"."InventorySalePaymentStatus" AS ENUM ('paid', 'partial', 'unpaid');

-- CreateEnum
CREATE TYPE "public"."InventoryMovementType" AS ENUM ('sale_out', 'adjustment_in', 'adjustment_out', 'purchase_in', 'transfer_in', 'transfer_out');

-- CreateEnum
CREATE TYPE "public"."InventoryMovementReferenceType" AS ENUM ('inventory_sale', 'stock_adjustment', 'purchase', 'transfer');

-- CreateEnum
CREATE TYPE "public"."AnimalGender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "public"."AnimalSource" AS ENUM ('born_on_farm', 'purchased', 'donated', 'other');

-- CreateEnum
CREATE TYPE "public"."AnimalStatus" AS ENUM ('active', 'lactating', 'dry', 'pregnant', 'sick', 'sold', 'dead', 'culled');

-- CreateEnum
CREATE TYPE "public"."HealthEventType" AS ENUM ('vaccination', 'treatment', 'deworming', 'examination', 'surgery', 'injury', 'illness', 'other');

-- CreateEnum
CREATE TYPE "public"."FarmStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "public"."FarmProductionMode" AS ENUM ('dairy', 'meat', 'eggs', 'breeding');

-- CreateEnum
CREATE TYPE "public"."PoultryFlockStatus" AS ENUM ('active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "public"."FlockMovementType" AS ENUM ('intake', 'sale', 'transfer_out', 'transfer_in', 'adjustment');

-- CreateEnum
CREATE TYPE "public"."PigBatchStatus" AS ENUM ('active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "public"."BreedingMethod" AS ENUM ('natural', 'artificial_insemination');

-- CreateEnum
CREATE TYPE "public"."BreedingOutcome" AS ENUM ('pregnant', 'not_pregnant', 'unknown');

-- CreateEnum
CREATE TYPE "public"."CalvingOutcome" AS ENUM ('live', 'stillborn', 'aborted');

-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('COUNTRY', 'PROVINCE', 'DISTRICT', 'SECTOR', 'CELL', 'VILLAGE');

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "type" "public"."AccountType" NOT NULL DEFAULT 'tenant',
    "parent_id" UUID,
    "status" "public"."AccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "operational_location_id" UUID,
    "operational_district_id" UUID,
    "regional_supervisor_user_id" UUID,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "code" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "nid" TEXT,
    "address" TEXT,
    "password_hash" TEXT NOT NULL,
    "token" TEXT,
    "last_login" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "last_login_device" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'active',
    "default_account_id" UUID,
    "province" TEXT,
    "district" TEXT,
    "sector" TEXT,
    "cell" TEXT,
    "village" TEXT,
    "id_number" TEXT,
    "id_front_photo_url" TEXT,
    "id_back_photo_url" TEXT,
    "selfie_photo_url" TEXT,
    "kyc_status" "public"."KycStatus" NOT NULL DEFAULT 'pending',
    "kyc_verified_at" TIMESTAMP(3),
    "kyc_verified_by" UUID,
    "kyc_rejection_reason" TEXT,
    "account_type" "public"."UserAccountType" NOT NULL DEFAULT 'mcc',
    "referred_by" INTEGER,
    "onboarded_by" INTEGER,
    "referral_code" TEXT,
    "referral_count" INTEGER NOT NULL DEFAULT 0,
    "onboarded_count" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "available_points" INTEGER NOT NULL DEFAULT 0,
    "registration_type" "public"."RegistrationType" NOT NULL DEFAULT 'self',
    "immis_member_id" INTEGER,
    "immis_linked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platform_roles" (
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

-- CreateTable
CREATE TABLE "public"."platform_role_permissions" (
    "platform_role_id" UUID NOT NULL,
    "platform_permission_id" UUID NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("platform_role_id","platform_permission_id")
);

-- CreateTable
CREATE TABLE "public"."user_accounts" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL DEFAULT 'supplier',
    "platform_role_id" UUID,
    "permissions" JSONB,
    "status" "public"."UserAccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "linked_umucunda_supplier_account_id" UUID,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account_memberships" (
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

-- CreateTable
CREATE TABLE "public"."suppliers_customers" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "supplier_account_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "price_per_liter" DECIMAL(10,2) NOT NULL,
    "average_supply_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "relationship_status" "public"."RelationshipStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "suppliers_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."milk_sales" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "supplier_account_id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "animal_id" UUID,
    "milk_production_id" UUID,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "status" "public"."MilkSaleStatus" NOT NULL DEFAULT 'pending',
    "sale_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_status" TEXT DEFAULT 'unpaid',
    "payment_history" JSONB,
    "recorded_by" UUID NOT NULL,
    "mcc_gate_delivery_id" UUID,
    "mcc_manifest_line_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "milk_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_gate_deliveries" (
    "id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "source_type" "public"."MccDeliverySourceType" NOT NULL,
    "source_account_id" UUID NOT NULL,
    "gate_volume_litres" DECIMAL(12,3) NOT NULL,
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_gate_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_milk_manifests" (
    "id" UUID NOT NULL,
    "gate_delivery_id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "umucunda_supplier_account_id" UUID NOT NULL,
    "manifest_ref" VARCHAR(40) NOT NULL,
    "status" "public"."MccMilkManifestStatus" NOT NULL DEFAULT 'draft',
    "route_metadata" JSONB,
    "gps_metadata" JSONB,
    "submitted_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_milk_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_manifest_lines" (
    "id" UUID NOT NULL,
    "manifest_id" UUID NOT NULL,
    "farmer_supplier_account_id" UUID NOT NULL,
    "declared_litres" DECIMAL(12,3) NOT NULL,
    "container_id" VARCHAR(64),

    CONSTRAINT "mcc_manifest_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_milk_test_results" (
    "id" UUID NOT NULL,
    "mcc_gate_delivery_id" UUID NOT NULL,
    "manifest_line_id" UUID,
    "outcome" "public"."MccMilkTestOutcome" NOT NULL DEFAULT 'pending',
    "rejection_cause" TEXT,
    "source_resolution_status" "public"."MccSourceResolutionStatus",
    "detail" JSONB,
    "tested_by_user_id" UUID,
    "tested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_milk_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_credit_events" (
    "id" UUID NOT NULL,
    "farmer_account_id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "mcc_gate_delivery_id" UUID NOT NULL,
    "mcc_milk_manifest_id" UUID,
    "mcc_milk_test_result_id" UUID,
    "volume_credited_litres" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_credit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_staff_shifts" (
    "id" UUID NOT NULL,
    "mcc_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "role_label_snapshot" VARCHAR(64),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcc_staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_operational_profiles" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "expected_daily_deliveries" INTEGER,
    "daily_milk_volume_litres" DECIMAL(12,3),
    "max_milk_one_day_litres" DECIMAL(12,3),
    "tank_capacity_sufficiency" VARCHAR(120),
    "insufficient_capacity_plan" TEXT,
    "power_supply_sources" JSONB,
    "generator_capacity_kva" DECIMAL(10,2),
    "mobile_connectivity" VARCHAR(120),
    "total_farmers_supplying" INTEGER,
    "new_farmers_last_3_months" INTEGER,
    "milk_transporters_count" INTEGER,
    "average_distance_km" DECIMAL(10,2),
    "furthest_farm_km" DECIMAL(10,2),
    "evening_milk_pattern" VARCHAR(120),
    "own_milk_transport_type" VARCHAR(160),
    "record_system" VARCHAR(160),
    "avg_days_delivery_to_payment" INTEGER,
    "average_annual_revenue_rwf" DECIMAL(15,2),
    "main_buyer_name" VARCHAR(255),
    "formal_supply_agreement_details" TEXT,
    "source_submission_id" UUID,
    "source_submission_code" VARCHAR(64),
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_operational_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_cooling_tank_profiles" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "tank_number" VARCHAR(120),
    "capacity_litres" DECIMAL(12,3),
    "year_or_age" VARCHAR(120),
    "condition" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_cooling_tank_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_facility_snapshots" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "tank_used_litres" DECIMAL(12,3),
    "tank_used_pct" DECIMAL(6,2),
    "cooling_temperature_c" DECIMAL(6,2),
    "power_status" VARCHAR(60),
    "generator_status" VARCHAR(60),
    "generator_fuel_pct" DECIMAL(6,2),
    "observed_at" TIMESTAMP(3),
    "source" VARCHAR(60),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_facility_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."milk_productions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "animal_id" UUID,
    "production_date" DATE NOT NULL,
    "quantity_litres" DECIMAL(10,2) NOT NULL,
    "session" VARCHAR(32),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "milk_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_stock_level" INTEGER,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'active',
    "account_id" UUID,
    "inventory_item_id" UUID,
    "is_listed_in_marketplace" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_categories" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "product_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_images" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "product_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "customer_id" UUID,
    "seller_id" UUID,
    "account_id" UUID NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'pending',
    "shipping_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wallets" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "account_id" UUID NOT NULL,
    "code" TEXT,
    "type" "public"."WalletType" NOT NULL DEFAULT 'regular',
    "is_joint" BOOLEAN NOT NULL DEFAULT false,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" "public"."WalletStatus" NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feed_posts" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "content" TEXT,
    "media_url" TEXT,
    "hashtags" TEXT,
    "location" TEXT,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "bookmarks_count" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."FeedPostStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feed_stories" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "media_url" TEXT,
    "content" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."FeedStoryStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "feed_stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feed_comments" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "content" TEXT NOT NULL,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."FeedPostStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feed_interactions" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "post_id" UUID,
    "story_id" UUID,
    "interaction_type" "public"."InteractionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feed_post_categories" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_bookmarks" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_relationships" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "follower_id" UUID NOT NULL,
    "following_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL DEFAULT 'info',
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'unread',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_keys" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "key" TEXT NOT NULL,
    "key_hash" TEXT,
    "name" TEXT,
    "description" TEXT,
    "account_id" UUID,
    "created_by_user_id" UUID,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit" INTEGER NOT NULL DEFAULT 1000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_onboardings" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "step" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mcc_onboarding_submissions" (
    "id" UUID NOT NULL,
    "submission_code" VARCHAR(64) NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "common_name" VARCHAR(255),
    "manager_first_name" VARCHAR(120) NOT NULL,
    "manager_last_name" VARCHAR(120) NOT NULL,
    "manager_phone" VARCHAR(50) NOT NULL,
    "manager_id_number" VARCHAR(120) NOT NULL,
    "location_province_id" VARCHAR(120),
    "location_district_id" VARCHAR(120),
    "location_sector_id" VARCHAR(120),
    "location_cell_id" VARCHAR(120),
    "location_village_id" VARCHAR(120),
    "final_decision" VARCHAR(32) NOT NULL,
    "pass_count" INTEGER NOT NULL DEFAULT 0,
    "section_payload" JSONB NOT NULL,
    "google_sheet_status" VARCHAR(40) NOT NULL DEFAULT 'not_configured',
    "google_sheet_response" JSONB,
    "google_sheet_error" TEXT,
    "review_status" "public"."MccOnboardingReviewStatus" NOT NULL DEFAULT 'pending',
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" UUID,
    "linked_user_id" UUID,
    "linked_account_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcc_onboarding_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_points" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_referrals" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "referrer_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_rewards" (
    "id" UUID NOT NULL,
    "legacy_id" BIGINT,
    "user_id" UUID NOT NULL,
    "reward_type" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "points" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chart_of_accounts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounting_transactions" (
    "id" UUID NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "reference_number" TEXT,
    "description" TEXT,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "farm_id" UUID,
    "dairy_share_pct" DECIMAL(5,2),
    "cost_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "accounting_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounting_transaction_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit_amount" DECIMAL(15,2),
    "credit_amount" DECIMAL(15,2),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_transaction_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" UUID,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_suppliers" (
    "id" UUID NOT NULL,
    "supplier_account_id" UUID NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_periods" (
    "id" UUID NOT NULL,
    "period_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_runs" (
    "id" UUID NOT NULL,
    "account_id" UUID,
    "period_id" UUID,
    "run_name" TEXT,
    "run_date" TIMESTAMP(3) NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "payment_terms_days" INTEGER,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_payslips" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "supplier_account_id" UUID NOT NULL,
    "gross_amount" DECIMAL(15,2) NOT NULL,
    "total_deductions" DECIMAL(15,2) NOT NULL,
    "net_amount" DECIMAL(15,2) NOT NULL,
    "milk_sales_count" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3),
    "paid_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "payroll_supplier_id" UUID,

    CONSTRAINT "payroll_payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payroll_deductions" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "deduction_type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "inventory_sale_id" UUID,
    "loan_id" UUID,
    "charge_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."charges" (
    "id" UUID NOT NULL,
    "customer_account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "amount_type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "recurrence" TEXT,
    "apply_to_all_suppliers" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."charge_suppliers" (
    "id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "supplier_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."charge_applications" (
    "id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "supplier_account_id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."milk_rejection_reasons" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_rejection_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_item_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_item_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unit" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_sales" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID,
    "buyer_type" "public"."InventorySaleBuyerType" NOT NULL,
    "buyer_account_id" UUID,
    "buyer_name" TEXT,
    "buyer_phone" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_status" "public"."InventorySalePaymentStatus" NOT NULL DEFAULT 'unpaid',
    "sale_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "inventory_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_movements" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "movement_type" "public"."InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_type" "public"."InventoryMovementReferenceType" NOT NULL,
    "reference_id" UUID,
    "description" TEXT,
    "unit_price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loans" (
    "id" UUID NOT NULL,
    "lender_account_id" UUID NOT NULL,
    "borrower_type" TEXT NOT NULL,
    "borrower_account_id" UUID,
    "borrower_name" TEXT,
    "principal" DECIMAL(15,2) NOT NULL,
    "amount_repaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" TEXT NOT NULL DEFAULT 'active',
    "disbursement_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_repayments" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "repayment_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."locations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "location_type" "public"."LocationType" NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."regional_supervisor_districts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "district_location_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regional_supervisor_districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."farms" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "location" TEXT,
    "location_id" UUID,
    "status" "public"."FarmStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."farm_species_focus" (
    "farm_id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "modes" "public"."FarmProductionMode"[],

    CONSTRAINT "farm_species_focus_pkey" PRIMARY KEY ("farm_id","species_id")
);

-- CreateTable
CREATE TABLE "public"."species" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."breeds" (
    "id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."animals" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "species_id" UUID NOT NULL,
    "breed_id" UUID NOT NULL,
    "tag_number" TEXT NOT NULL,
    "name" TEXT,
    "gender" "public"."AnimalGender" NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "source" "public"."AnimalSource" NOT NULL,
    "purchase_date" TIMESTAMP(3),
    "purchase_price" DECIMAL(10,2),
    "mother_id" UUID,
    "father_id" UUID,
    "status" "public"."AnimalStatus" NOT NULL DEFAULT 'active',
    "photo_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."animal_weights" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "weight_kg" DECIMAL(6,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "animal_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."animal_health" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "event_type" "public"."HealthEventType" NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "medicine_name" TEXT,
    "dosage" TEXT,
    "administered_by" TEXT,
    "vet_user_id" UUID,
    "vet_first_name" TEXT,
    "vet_last_name" TEXT,
    "vet_phone" TEXT,
    "next_due_date" TIMESTAMP(3),
    "cost" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "animal_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."animal_breeding" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "breeding_date" DATE NOT NULL,
    "heat_date" DATE,
    "method" "public"."BreedingMethod" NOT NULL,
    "bull_animal_id" UUID,
    "bull_name" TEXT,
    "semen_code" TEXT,
    "expected_calving_date" DATE,
    "outcome" "public"."BreedingOutcome" DEFAULT 'unknown',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "animal_breeding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."animal_calving" (
    "id" UUID NOT NULL,
    "mother_id" UUID NOT NULL,
    "calving_date" DATE NOT NULL,
    "calf_id" UUID,
    "outcome" "public"."CalvingOutcome" NOT NULL,
    "gender" "public"."AnimalGender",
    "weight_kg" DECIMAL(6,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "animal_calving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."poultry_flocks" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "breed_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "started_at" DATE NOT NULL,
    "opening_head_count" INTEGER NOT NULL,
    "current_head_count" INTEGER NOT NULL,
    "status" "public"."PoultryFlockStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "poultry_flocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flock_daily_records" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "record_date" DATE NOT NULL,
    "eggs_collected" INTEGER NOT NULL DEFAULT 0,
    "mortality_count" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flock_daily_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flock_movements" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "movement_date" DATE NOT NULL,
    "type" "public"."FlockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "flock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pig_batches" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "breed_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "started_at" DATE NOT NULL,
    "opening_head_count" INTEGER NOT NULL,
    "current_head_count" INTEGER NOT NULL,
    "status" "public"."PigBatchStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "pig_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pig_batch_weights" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "weighed_date" DATE NOT NULL,
    "avg_weight_kg" DECIMAL(8,2) NOT NULL,
    "min_weight_kg" DECIMAL(8,2),
    "max_weight_kg" DECIMAL(8,2),
    "animals_weighed" INTEGER,
    "weight_band" VARCHAR(64),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pig_batch_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pig_farrowings" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "farm_id" UUID,
    "pig_batch_id" UUID,
    "sow_animal_id" UUID,
    "farrowing_date" DATE NOT NULL,
    "live_born" INTEGER NOT NULL DEFAULT 0,
    "stillborn" INTEGER NOT NULL DEFAULT 0,
    "mummified" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "pig_farrowings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_legacy_id_key" ON "public"."accounts"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "public"."accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_code_idx" ON "public"."accounts"("code");

-- CreateIndex
CREATE INDEX "accounts_type_idx" ON "public"."accounts"("type");

-- CreateIndex
CREATE INDEX "accounts_status_idx" ON "public"."accounts"("status");

-- CreateIndex
CREATE INDEX "accounts_parent_id_idx" ON "public"."accounts"("parent_id");

-- CreateIndex
CREATE INDEX "accounts_created_at_idx" ON "public"."accounts"("created_at");

-- CreateIndex
CREATE INDEX "accounts_operational_location_id_idx" ON "public"."accounts"("operational_location_id");

-- CreateIndex
CREATE INDEX "accounts_operational_district_id_idx" ON "public"."accounts"("operational_district_id");

-- CreateIndex
CREATE INDEX "accounts_regional_supervisor_user_id_idx" ON "public"."accounts"("regional_supervisor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_legacy_id_key" ON "public"."users"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_code_key" ON "public"."users"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "public"."users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_immis_member_id_key" ON "public"."users"("immis_member_id");

-- CreateIndex
CREATE INDEX "users_code_idx" ON "public"."users"("code");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "public"."users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE INDEX "users_account_type_idx" ON "public"."users"("account_type");

-- CreateIndex
CREATE INDEX "users_kyc_status_idx" ON "public"."users"("kyc_status");

-- CreateIndex
CREATE INDEX "users_default_account_id_idx" ON "public"."users"("default_account_id");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE INDEX "users_last_login_idx" ON "public"."users"("last_login");

-- CreateIndex
CREATE UNIQUE INDEX "platform_permissions_code_key" ON "public"."platform_permissions"("code");

-- CreateIndex
CREATE INDEX "platform_permissions_category_idx" ON "public"."platform_permissions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_slug_key" ON "public"."platform_roles"("slug");

-- CreateIndex
CREATE INDEX "platform_roles_is_active_idx" ON "public"."platform_roles"("is_active");

-- CreateIndex
CREATE INDEX "platform_role_permissions_platform_permission_id_idx" ON "public"."platform_role_permissions"("platform_permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_legacy_id_key" ON "public"."user_accounts"("legacy_id");

-- CreateIndex
CREATE INDEX "user_accounts_user_id_idx" ON "public"."user_accounts"("user_id");

-- CreateIndex
CREATE INDEX "user_accounts_account_id_idx" ON "public"."user_accounts"("account_id");

-- CreateIndex
CREATE INDEX "user_accounts_role_idx" ON "public"."user_accounts"("role");

-- CreateIndex
CREATE INDEX "user_accounts_platform_role_id_idx" ON "public"."user_accounts"("platform_role_id");

-- CreateIndex
CREATE INDEX "user_accounts_status_idx" ON "public"."user_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_user_id_account_id_key" ON "public"."user_accounts"("user_id", "account_id");

-- CreateIndex
CREATE INDEX "account_memberships_account_id_idx" ON "public"."account_memberships"("account_id");

-- CreateIndex
CREATE INDEX "account_memberships_user_id_idx" ON "public"."account_memberships"("user_id");

-- CreateIndex
CREATE INDEX "account_memberships_status_idx" ON "public"."account_memberships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "account_memberships_account_id_user_id_key" ON "public"."account_memberships"("account_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_customers_legacy_id_key" ON "public"."suppliers_customers"("legacy_id");

-- CreateIndex
CREATE INDEX "suppliers_customers_supplier_account_id_idx" ON "public"."suppliers_customers"("supplier_account_id");

-- CreateIndex
CREATE INDEX "suppliers_customers_customer_account_id_idx" ON "public"."suppliers_customers"("customer_account_id");

-- CreateIndex
CREATE INDEX "suppliers_customers_relationship_status_idx" ON "public"."suppliers_customers"("relationship_status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_customers_supplier_account_id_customer_account_id_key" ON "public"."suppliers_customers"("supplier_account_id", "customer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "milk_sales_legacy_id_key" ON "public"."milk_sales"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "milk_sales_mcc_gate_delivery_id_key" ON "public"."milk_sales"("mcc_gate_delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "milk_sales_mcc_manifest_line_id_key" ON "public"."milk_sales"("mcc_manifest_line_id");

-- CreateIndex
CREATE INDEX "milk_sales_supplier_account_id_idx" ON "public"."milk_sales"("supplier_account_id");

-- CreateIndex
CREATE INDEX "milk_sales_customer_account_id_idx" ON "public"."milk_sales"("customer_account_id");

-- CreateIndex
CREATE INDEX "milk_sales_animal_id_idx" ON "public"."milk_sales"("animal_id");

-- CreateIndex
CREATE INDEX "milk_sales_milk_production_id_idx" ON "public"."milk_sales"("milk_production_id");

-- CreateIndex
CREATE INDEX "milk_sales_status_idx" ON "public"."milk_sales"("status");

-- CreateIndex
CREATE INDEX "milk_sales_sale_at_idx" ON "public"."milk_sales"("sale_at");

-- CreateIndex
CREATE INDEX "milk_sales_recorded_by_idx" ON "public"."milk_sales"("recorded_by");

-- CreateIndex
CREATE INDEX "milk_sales_created_at_idx" ON "public"."milk_sales"("created_at");

-- CreateIndex
CREATE INDEX "milk_sales_payment_status_idx" ON "public"."milk_sales"("payment_status");

-- CreateIndex
CREATE INDEX "milk_sales_mcc_gate_delivery_id_idx" ON "public"."milk_sales"("mcc_gate_delivery_id");

-- CreateIndex
CREATE INDEX "milk_sales_mcc_manifest_line_id_idx" ON "public"."milk_sales"("mcc_manifest_line_id");

-- CreateIndex
CREATE INDEX "mcc_gate_deliveries_mcc_account_id_arrived_at_idx" ON "public"."mcc_gate_deliveries"("mcc_account_id", "arrived_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_gate_deliveries_source_account_id_arrived_at_idx" ON "public"."mcc_gate_deliveries"("source_account_id", "arrived_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mcc_milk_manifests_gate_delivery_id_key" ON "public"."mcc_milk_manifests"("gate_delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcc_milk_manifests_manifest_ref_key" ON "public"."mcc_milk_manifests"("manifest_ref");

-- CreateIndex
CREATE INDEX "mcc_milk_manifests_mcc_account_id_status_idx" ON "public"."mcc_milk_manifests"("mcc_account_id", "status");

-- CreateIndex
CREATE INDEX "mcc_milk_manifests_umucunda_supplier_account_id_idx" ON "public"."mcc_milk_manifests"("umucunda_supplier_account_id");

-- CreateIndex
CREATE INDEX "mcc_manifest_lines_manifest_id_idx" ON "public"."mcc_manifest_lines"("manifest_id");

-- CreateIndex
CREATE INDEX "mcc_manifest_lines_farmer_supplier_account_id_idx" ON "public"."mcc_manifest_lines"("farmer_supplier_account_id");

-- CreateIndex
CREATE INDEX "mcc_milk_test_results_mcc_gate_delivery_id_tested_at_idx" ON "public"."mcc_milk_test_results"("mcc_gate_delivery_id", "tested_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_credit_events_farmer_account_id_created_at_idx" ON "public"."mcc_credit_events"("farmer_account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_credit_events_mcc_gate_delivery_id_idx" ON "public"."mcc_credit_events"("mcc_gate_delivery_id");

-- CreateIndex
CREATE INDEX "mcc_staff_shifts_mcc_account_id_started_at_idx" ON "public"."mcc_staff_shifts"("mcc_account_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "mcc_staff_shifts_user_id_ended_at_idx" ON "public"."mcc_staff_shifts"("user_id", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "mcc_operational_profiles_account_id_key" ON "public"."mcc_operational_profiles"("account_id");

-- CreateIndex
CREATE INDEX "mcc_operational_profiles_source_submission_id_idx" ON "public"."mcc_operational_profiles"("source_submission_id");

-- CreateIndex
CREATE INDEX "mcc_operational_profiles_captured_at_idx" ON "public"."mcc_operational_profiles"("captured_at");

-- CreateIndex
CREATE INDEX "mcc_cooling_tank_profiles_account_id_idx" ON "public"."mcc_cooling_tank_profiles"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcc_facility_snapshots_account_id_key" ON "public"."mcc_facility_snapshots"("account_id");

-- CreateIndex
CREATE INDEX "mcc_facility_snapshots_observed_at_idx" ON "public"."mcc_facility_snapshots"("observed_at");

-- CreateIndex
CREATE INDEX "milk_productions_account_id_idx" ON "public"."milk_productions"("account_id");

-- CreateIndex
CREATE INDEX "milk_productions_farm_id_idx" ON "public"."milk_productions"("farm_id");

-- CreateIndex
CREATE INDEX "milk_productions_animal_id_idx" ON "public"."milk_productions"("animal_id");

-- CreateIndex
CREATE INDEX "milk_productions_production_date_idx" ON "public"."milk_productions"("production_date");

-- CreateIndex
CREATE UNIQUE INDEX "products_legacy_id_key" ON "public"."products"("legacy_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "public"."products"("status");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "public"."products"("created_at");

-- CreateIndex
CREATE INDEX "products_account_id_idx" ON "public"."products"("account_id");

-- CreateIndex
CREATE INDEX "products_inventory_item_id_idx" ON "public"."products"("inventory_item_id");

-- CreateIndex
CREATE INDEX "products_is_listed_in_marketplace_idx" ON "public"."products"("is_listed_in_marketplace");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_legacy_id_key" ON "public"."product_categories"("legacy_id");

-- CreateIndex
CREATE INDEX "product_categories_product_id_idx" ON "public"."product_categories"("product_id");

-- CreateIndex
CREATE INDEX "product_categories_category_id_idx" ON "public"."product_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_product_id_category_id_key" ON "public"."product_categories"("product_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_legacy_id_key" ON "public"."product_images"("legacy_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "public"."product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_images_is_primary_idx" ON "public"."product_images"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "categories_legacy_id_key" ON "public"."categories"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "public"."categories"("name");

-- CreateIndex
CREATE INDEX "categories_name_idx" ON "public"."categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "orders_legacy_id_key" ON "public"."orders"("legacy_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "public"."orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_seller_id_idx" ON "public"."orders"("seller_id");

-- CreateIndex
CREATE INDEX "orders_account_id_idx" ON "public"."orders"("account_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "public"."orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_legacy_id_key" ON "public"."order_items"("legacy_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "public"."order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_legacy_id_key" ON "public"."wallets"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_code_key" ON "public"."wallets"("code");

-- CreateIndex
CREATE INDEX "wallets_account_id_idx" ON "public"."wallets"("account_id");

-- CreateIndex
CREATE INDEX "wallets_code_idx" ON "public"."wallets"("code");

-- CreateIndex
CREATE INDEX "wallets_status_idx" ON "public"."wallets"("status");

-- CreateIndex
CREATE INDEX "wallets_is_default_idx" ON "public"."wallets"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "feed_posts_legacy_id_key" ON "public"."feed_posts"("legacy_id");

-- CreateIndex
CREATE INDEX "feed_posts_user_id_idx" ON "public"."feed_posts"("user_id");

-- CreateIndex
CREATE INDEX "feed_posts_status_idx" ON "public"."feed_posts"("status");

-- CreateIndex
CREATE INDEX "feed_posts_created_at_idx" ON "public"."feed_posts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feed_stories_legacy_id_key" ON "public"."feed_stories"("legacy_id");

-- CreateIndex
CREATE INDEX "feed_stories_user_id_idx" ON "public"."feed_stories"("user_id");

-- CreateIndex
CREATE INDEX "feed_stories_status_idx" ON "public"."feed_stories"("status");

-- CreateIndex
CREATE INDEX "feed_stories_expires_at_idx" ON "public"."feed_stories"("expires_at");

-- CreateIndex
CREATE INDEX "feed_stories_created_at_idx" ON "public"."feed_stories"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feed_comments_legacy_id_key" ON "public"."feed_comments"("legacy_id");

-- CreateIndex
CREATE INDEX "feed_comments_post_id_idx" ON "public"."feed_comments"("post_id");

-- CreateIndex
CREATE INDEX "feed_comments_user_id_idx" ON "public"."feed_comments"("user_id");

-- CreateIndex
CREATE INDEX "feed_comments_parent_comment_id_idx" ON "public"."feed_comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "feed_comments_created_at_idx" ON "public"."feed_comments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feed_interactions_legacy_id_key" ON "public"."feed_interactions"("legacy_id");

-- CreateIndex
CREATE INDEX "feed_interactions_user_id_idx" ON "public"."feed_interactions"("user_id");

-- CreateIndex
CREATE INDEX "feed_interactions_post_id_idx" ON "public"."feed_interactions"("post_id");

-- CreateIndex
CREATE INDEX "feed_interactions_story_id_idx" ON "public"."feed_interactions"("story_id");

-- CreateIndex
CREATE INDEX "feed_interactions_interaction_type_idx" ON "public"."feed_interactions"("interaction_type");

-- CreateIndex
CREATE INDEX "feed_interactions_created_at_idx" ON "public"."feed_interactions"("created_at");

-- CreateIndex
CREATE INDEX "feed_post_categories_post_id_idx" ON "public"."feed_post_categories"("post_id");

-- CreateIndex
CREATE INDEX "feed_post_categories_category_id_idx" ON "public"."feed_post_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "feed_post_categories_post_id_category_id_key" ON "public"."feed_post_categories"("post_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_bookmarks_legacy_id_key" ON "public"."user_bookmarks"("legacy_id");

-- CreateIndex
CREATE INDEX "user_bookmarks_user_id_idx" ON "public"."user_bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "user_bookmarks_post_id_idx" ON "public"."user_bookmarks"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_bookmarks_user_id_post_id_key" ON "public"."user_bookmarks"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_relationships_legacy_id_key" ON "public"."user_relationships"("legacy_id");

-- CreateIndex
CREATE INDEX "user_relationships_follower_id_idx" ON "public"."user_relationships"("follower_id");

-- CreateIndex
CREATE INDEX "user_relationships_following_id_idx" ON "public"."user_relationships"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_relationships_follower_id_following_id_key" ON "public"."user_relationships"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_legacy_id_key" ON "public"."notifications"("legacy_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "public"."notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "public"."notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "public"."notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "public"."notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_legacy_id_key" ON "public"."api_keys"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "public"."api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "public"."api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "public"."api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "public"."api_keys"("is_active");

-- CreateIndex
CREATE INDEX "api_keys_account_id_idx" ON "public"."api_keys"("account_id");

-- CreateIndex
CREATE INDEX "api_keys_created_by_user_id_idx" ON "public"."api_keys"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_legacy_id_key" ON "public"."password_resets"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "public"."password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "public"."password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "public"."password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_expires_at_idx" ON "public"."password_resets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_onboardings_legacy_id_key" ON "public"."user_onboardings"("legacy_id");

-- CreateIndex
CREATE INDEX "user_onboardings_user_id_idx" ON "public"."user_onboardings"("user_id");

-- CreateIndex
CREATE INDEX "user_onboardings_step_idx" ON "public"."user_onboardings"("step");

-- CreateIndex
CREATE UNIQUE INDEX "mcc_onboarding_submissions_submission_code_key" ON "public"."mcc_onboarding_submissions"("submission_code");

-- CreateIndex
CREATE INDEX "mcc_onboarding_submissions_submission_code_idx" ON "public"."mcc_onboarding_submissions"("submission_code");

-- CreateIndex
CREATE INDEX "mcc_onboarding_submissions_created_at_idx" ON "public"."mcc_onboarding_submissions"("created_at");

-- CreateIndex
CREATE INDEX "mcc_onboarding_submissions_final_decision_idx" ON "public"."mcc_onboarding_submissions"("final_decision");

-- CreateIndex
CREATE INDEX "mcc_onboarding_submissions_review_status_idx" ON "public"."mcc_onboarding_submissions"("review_status");

-- CreateIndex
CREATE INDEX "mcc_onboarding_submissions_linked_user_id_idx" ON "public"."mcc_onboarding_submissions"("linked_user_id");

-- CreateIndex
CREATE INDEX "mcc_onboarding_submissions_reviewed_by_user_id_idx" ON "public"."mcc_onboarding_submissions"("reviewed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_points_legacy_id_key" ON "public"."user_points"("legacy_id");

-- CreateIndex
CREATE INDEX "user_points_user_id_idx" ON "public"."user_points"("user_id");

-- CreateIndex
CREATE INDEX "user_points_created_at_idx" ON "public"."user_points"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_referrals_legacy_id_key" ON "public"."user_referrals"("legacy_id");

-- CreateIndex
CREATE INDEX "user_referrals_referrer_id_idx" ON "public"."user_referrals"("referrer_id");

-- CreateIndex
CREATE INDEX "user_referrals_referred_id_idx" ON "public"."user_referrals"("referred_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_referrals_referrer_id_referred_id_key" ON "public"."user_referrals"("referrer_id", "referred_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_rewards_legacy_id_key" ON "public"."user_rewards"("legacy_id");

-- CreateIndex
CREATE INDEX "user_rewards_user_id_idx" ON "public"."user_rewards"("user_id");

-- CreateIndex
CREATE INDEX "user_rewards_reward_type_idx" ON "public"."user_rewards"("reward_type");

-- CreateIndex
CREATE INDEX "user_rewards_created_at_idx" ON "public"."user_rewards"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_code_key" ON "public"."chart_of_accounts"("code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_code_idx" ON "public"."chart_of_accounts"("code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_account_type_idx" ON "public"."chart_of_accounts"("account_type");

-- CreateIndex
CREATE INDEX "chart_of_accounts_parent_id_idx" ON "public"."chart_of_accounts"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_transactions_reference_number_key" ON "public"."accounting_transactions"("reference_number");

-- CreateIndex
CREATE INDEX "accounting_transactions_transaction_date_idx" ON "public"."accounting_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "accounting_transactions_farm_id_idx" ON "public"."accounting_transactions"("farm_id");

-- CreateIndex
CREATE INDEX "accounting_transactions_reference_number_idx" ON "public"."accounting_transactions"("reference_number");

-- CreateIndex
CREATE INDEX "accounting_transactions_created_at_idx" ON "public"."accounting_transactions"("created_at");

-- CreateIndex
CREATE INDEX "accounting_transaction_entries_transaction_id_idx" ON "public"."accounting_transaction_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "accounting_transaction_entries_account_id_idx" ON "public"."accounting_transaction_entries"("account_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "public"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "payroll_suppliers_supplier_account_id_idx" ON "public"."payroll_suppliers"("supplier_account_id");

-- CreateIndex
CREATE INDEX "payroll_suppliers_is_active_idx" ON "public"."payroll_suppliers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_suppliers_supplier_account_id_key" ON "public"."payroll_suppliers"("supplier_account_id");

-- CreateIndex
CREATE INDEX "payroll_periods_start_date_idx" ON "public"."payroll_periods"("start_date");

-- CreateIndex
CREATE INDEX "payroll_periods_end_date_idx" ON "public"."payroll_periods"("end_date");

-- CreateIndex
CREATE INDEX "payroll_periods_status_idx" ON "public"."payroll_periods"("status");

-- CreateIndex
CREATE INDEX "payroll_runs_account_id_idx" ON "public"."payroll_runs"("account_id");

-- CreateIndex
CREATE INDEX "payroll_runs_period_id_idx" ON "public"."payroll_runs"("period_id");

-- CreateIndex
CREATE INDEX "payroll_runs_status_idx" ON "public"."payroll_runs"("status");

-- CreateIndex
CREATE INDEX "payroll_runs_run_date_idx" ON "public"."payroll_runs"("run_date");

-- CreateIndex
CREATE INDEX "payroll_runs_period_start_idx" ON "public"."payroll_runs"("period_start");

-- CreateIndex
CREATE INDEX "payroll_runs_period_end_idx" ON "public"."payroll_runs"("period_end");

-- CreateIndex
CREATE INDEX "payroll_payslips_run_id_idx" ON "public"."payroll_payslips"("run_id");

-- CreateIndex
CREATE INDEX "payroll_payslips_supplier_account_id_idx" ON "public"."payroll_payslips"("supplier_account_id");

-- CreateIndex
CREATE INDEX "payroll_payslips_status_idx" ON "public"."payroll_payslips"("status");

-- CreateIndex
CREATE INDEX "payroll_payslips_period_start_idx" ON "public"."payroll_payslips"("period_start");

-- CreateIndex
CREATE INDEX "payroll_payslips_period_end_idx" ON "public"."payroll_payslips"("period_end");

-- CreateIndex
CREATE INDEX "payroll_deductions_payslip_id_idx" ON "public"."payroll_deductions"("payslip_id");

-- CreateIndex
CREATE INDEX "payroll_deductions_deduction_type_idx" ON "public"."payroll_deductions"("deduction_type");

-- CreateIndex
CREATE INDEX "payroll_deductions_inventory_sale_id_idx" ON "public"."payroll_deductions"("inventory_sale_id");

-- CreateIndex
CREATE INDEX "payroll_deductions_loan_id_idx" ON "public"."payroll_deductions"("loan_id");

-- CreateIndex
CREATE INDEX "payroll_deductions_charge_id_idx" ON "public"."payroll_deductions"("charge_id");

-- CreateIndex
CREATE INDEX "charges_customer_account_id_idx" ON "public"."charges"("customer_account_id");

-- CreateIndex
CREATE INDEX "charges_is_active_idx" ON "public"."charges"("is_active");

-- CreateIndex
CREATE INDEX "charges_kind_idx" ON "public"."charges"("kind");

-- CreateIndex
CREATE INDEX "charges_effective_from_idx" ON "public"."charges"("effective_from");

-- CreateIndex
CREATE INDEX "charges_effective_to_idx" ON "public"."charges"("effective_to");

-- CreateIndex
CREATE INDEX "charge_suppliers_charge_id_idx" ON "public"."charge_suppliers"("charge_id");

-- CreateIndex
CREATE INDEX "charge_suppliers_supplier_account_id_idx" ON "public"."charge_suppliers"("supplier_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "charge_suppliers_charge_id_supplier_account_id_key" ON "public"."charge_suppliers"("charge_id", "supplier_account_id");

-- CreateIndex
CREATE INDEX "charge_applications_charge_id_idx" ON "public"."charge_applications"("charge_id");

-- CreateIndex
CREATE INDEX "charge_applications_supplier_account_id_idx" ON "public"."charge_applications"("supplier_account_id");

-- CreateIndex
CREATE INDEX "charge_applications_payslip_id_idx" ON "public"."charge_applications"("payslip_id");

-- CreateIndex
CREATE UNIQUE INDEX "charge_applications_charge_id_supplier_account_id_key" ON "public"."charge_applications"("charge_id", "supplier_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "milk_rejection_reasons_name_key" ON "public"."milk_rejection_reasons"("name");

-- CreateIndex
CREATE INDEX "milk_rejection_reasons_is_active_idx" ON "public"."milk_rejection_reasons"("is_active");

-- CreateIndex
CREATE INDEX "milk_rejection_reasons_sort_order_idx" ON "public"."milk_rejection_reasons"("sort_order");

-- CreateIndex
CREATE INDEX "inventory_item_categories_sort_order_idx" ON "public"."inventory_item_categories"("sort_order");

-- CreateIndex
CREATE INDEX "inventory_items_category_id_idx" ON "public"."inventory_items"("category_id");

-- CreateIndex
CREATE INDEX "inventory_items_is_active_idx" ON "public"."inventory_items"("is_active");

-- CreateIndex
CREATE INDEX "inventory_items_sort_order_idx" ON "public"."inventory_items"("sort_order");

-- CreateIndex
CREATE INDEX "inventory_sales_product_id_idx" ON "public"."inventory_sales"("product_id");

-- CreateIndex
CREATE INDEX "inventory_sales_order_id_idx" ON "public"."inventory_sales"("order_id");

-- CreateIndex
CREATE INDEX "inventory_sales_buyer_account_id_idx" ON "public"."inventory_sales"("buyer_account_id");

-- CreateIndex
CREATE INDEX "inventory_sales_buyer_type_idx" ON "public"."inventory_sales"("buyer_type");

-- CreateIndex
CREATE INDEX "inventory_sales_payment_status_idx" ON "public"."inventory_sales"("payment_status");

-- CreateIndex
CREATE INDEX "inventory_sales_sale_date_idx" ON "public"."inventory_sales"("sale_date");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_idx" ON "public"."inventory_movements"("product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_type_idx" ON "public"."inventory_movements"("movement_type");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_date_idx" ON "public"."inventory_movements"("movement_date");

-- CreateIndex
CREATE INDEX "inventory_movements_reference_type_idx" ON "public"."inventory_movements"("reference_type");

-- CreateIndex
CREATE INDEX "inventory_movements_created_at_idx" ON "public"."inventory_movements"("created_at");

-- CreateIndex
CREATE INDEX "loans_lender_account_id_idx" ON "public"."loans"("lender_account_id");

-- CreateIndex
CREATE INDEX "loans_borrower_account_id_idx" ON "public"."loans"("borrower_account_id");

-- CreateIndex
CREATE INDEX "loans_borrower_type_idx" ON "public"."loans"("borrower_type");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "public"."loans"("status");

-- CreateIndex
CREATE INDEX "loans_disbursement_date_idx" ON "public"."loans"("disbursement_date");

-- CreateIndex
CREATE INDEX "loan_repayments_loan_id_idx" ON "public"."loan_repayments"("loan_id");

-- CreateIndex
CREATE INDEX "loan_repayments_repayment_date_idx" ON "public"."loan_repayments"("repayment_date");

-- CreateIndex
CREATE INDEX "locations_location_type_idx" ON "public"."locations"("location_type");

-- CreateIndex
CREATE INDEX "locations_parent_id_idx" ON "public"."locations"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "public"."locations"("code");

-- CreateIndex
CREATE INDEX "regional_supervisor_districts_user_id_idx" ON "public"."regional_supervisor_districts"("user_id");

-- CreateIndex
CREATE INDEX "regional_supervisor_districts_district_location_id_idx" ON "public"."regional_supervisor_districts"("district_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "regional_supervisor_districts_user_id_district_location_id_key" ON "public"."regional_supervisor_districts"("user_id", "district_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "farms_code_key" ON "public"."farms"("code");

-- CreateIndex
CREATE INDEX "farms_account_id_idx" ON "public"."farms"("account_id");

-- CreateIndex
CREATE INDEX "farms_location_id_idx" ON "public"."farms"("location_id");

-- CreateIndex
CREATE INDEX "farms_status_idx" ON "public"."farms"("status");

-- CreateIndex
CREATE INDEX "farm_species_focus_species_id_idx" ON "public"."farm_species_focus"("species_id");

-- CreateIndex
CREATE UNIQUE INDEX "species_code_key" ON "public"."species"("code");

-- CreateIndex
CREATE INDEX "species_code_idx" ON "public"."species"("code");

-- CreateIndex
CREATE UNIQUE INDEX "breeds_code_key" ON "public"."breeds"("code");

-- CreateIndex
CREATE INDEX "breeds_code_idx" ON "public"."breeds"("code");

-- CreateIndex
CREATE INDEX "breeds_species_id_idx" ON "public"."breeds"("species_id");

-- CreateIndex
CREATE INDEX "animals_account_id_idx" ON "public"."animals"("account_id");

-- CreateIndex
CREATE INDEX "animals_species_id_idx" ON "public"."animals"("species_id");

-- CreateIndex
CREATE INDEX "animals_breed_id_idx" ON "public"."animals"("breed_id");

-- CreateIndex
CREATE INDEX "animals_farm_id_idx" ON "public"."animals"("farm_id");

-- CreateIndex
CREATE INDEX "animals_status_idx" ON "public"."animals"("status");

-- CreateIndex
CREATE INDEX "animals_gender_idx" ON "public"."animals"("gender");

-- CreateIndex
CREATE UNIQUE INDEX "animals_account_id_tag_number_key" ON "public"."animals"("account_id", "tag_number");

-- CreateIndex
CREATE INDEX "animal_weights_animal_id_idx" ON "public"."animal_weights"("animal_id");

-- CreateIndex
CREATE INDEX "animal_weights_recorded_at_idx" ON "public"."animal_weights"("recorded_at");

-- CreateIndex
CREATE INDEX "animal_health_animal_id_idx" ON "public"."animal_health"("animal_id");

-- CreateIndex
CREATE INDEX "animal_health_event_type_idx" ON "public"."animal_health"("event_type");

-- CreateIndex
CREATE INDEX "animal_health_event_date_idx" ON "public"."animal_health"("event_date");

-- CreateIndex
CREATE INDEX "animal_health_next_due_date_idx" ON "public"."animal_health"("next_due_date");

-- CreateIndex
CREATE INDEX "animal_health_vet_user_id_idx" ON "public"."animal_health"("vet_user_id");

-- CreateIndex
CREATE INDEX "animal_breeding_animal_id_idx" ON "public"."animal_breeding"("animal_id");

-- CreateIndex
CREATE INDEX "animal_breeding_breeding_date_idx" ON "public"."animal_breeding"("breeding_date");

-- CreateIndex
CREATE INDEX "animal_breeding_expected_calving_date_idx" ON "public"."animal_breeding"("expected_calving_date");

-- CreateIndex
CREATE UNIQUE INDEX "animal_calving_calf_id_key" ON "public"."animal_calving"("calf_id");

-- CreateIndex
CREATE INDEX "animal_calving_mother_id_idx" ON "public"."animal_calving"("mother_id");

-- CreateIndex
CREATE INDEX "animal_calving_calving_date_idx" ON "public"."animal_calving"("calving_date");

-- CreateIndex
CREATE INDEX "animal_calving_calf_id_idx" ON "public"."animal_calving"("calf_id");

-- CreateIndex
CREATE INDEX "poultry_flocks_account_id_idx" ON "public"."poultry_flocks"("account_id");

-- CreateIndex
CREATE INDEX "poultry_flocks_farm_id_idx" ON "public"."poultry_flocks"("farm_id");

-- CreateIndex
CREATE INDEX "flock_daily_records_record_date_idx" ON "public"."flock_daily_records"("record_date");

-- CreateIndex
CREATE UNIQUE INDEX "flock_daily_records_flock_id_record_date_key" ON "public"."flock_daily_records"("flock_id", "record_date");

-- CreateIndex
CREATE INDEX "flock_movements_flock_id_idx" ON "public"."flock_movements"("flock_id");

-- CreateIndex
CREATE INDEX "flock_movements_movement_date_idx" ON "public"."flock_movements"("movement_date");

-- CreateIndex
CREATE INDEX "pig_batches_account_id_idx" ON "public"."pig_batches"("account_id");

-- CreateIndex
CREATE INDEX "pig_batches_farm_id_idx" ON "public"."pig_batches"("farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "pig_batch_weights_batch_id_weighed_date_key" ON "public"."pig_batch_weights"("batch_id", "weighed_date");

-- CreateIndex
CREATE INDEX "pig_farrowings_account_id_idx" ON "public"."pig_farrowings"("account_id");

-- CreateIndex
CREATE INDEX "pig_farrowings_farm_id_idx" ON "public"."pig_farrowings"("farm_id");

-- CreateIndex
CREATE INDEX "pig_farrowings_pig_batch_id_idx" ON "public"."pig_farrowings"("pig_batch_id");

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_operational_location_id_fkey" FOREIGN KEY ("operational_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_operational_district_id_fkey" FOREIGN KEY ("operational_district_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_regional_supervisor_user_id_fkey" FOREIGN KEY ("regional_supervisor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "public"."platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_platform_permission_id_fkey" FOREIGN KEY ("platform_permission_id") REFERENCES "public"."platform_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_accounts" ADD CONSTRAINT "user_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_accounts" ADD CONSTRAINT "user_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_accounts" ADD CONSTRAINT "user_accounts_platform_role_id_fkey" FOREIGN KEY ("platform_role_id") REFERENCES "public"."platform_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_accounts" ADD CONSTRAINT "user_accounts_linked_umucunda_supplier_account_id_fkey" FOREIGN KEY ("linked_umucunda_supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account_memberships" ADD CONSTRAINT "account_memberships_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account_memberships" ADD CONSTRAINT "account_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account_memberships" ADD CONSTRAINT "account_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account_memberships" ADD CONSTRAINT "account_memberships_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers_customers" ADD CONSTRAINT "suppliers_customers_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers_customers" ADD CONSTRAINT "suppliers_customers_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_mcc_gate_delivery_id_fkey" FOREIGN KEY ("mcc_gate_delivery_id") REFERENCES "public"."mcc_gate_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_mcc_manifest_line_id_fkey" FOREIGN KEY ("mcc_manifest_line_id") REFERENCES "public"."mcc_manifest_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_sales" ADD CONSTRAINT "milk_sales_milk_production_id_fkey" FOREIGN KEY ("milk_production_id") REFERENCES "public"."milk_productions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_gate_deliveries" ADD CONSTRAINT "mcc_gate_deliveries_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_gate_deliveries" ADD CONSTRAINT "mcc_gate_deliveries_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_gate_deliveries" ADD CONSTRAINT "mcc_gate_deliveries_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_milk_manifests" ADD CONSTRAINT "mcc_milk_manifests_gate_delivery_id_fkey" FOREIGN KEY ("gate_delivery_id") REFERENCES "public"."mcc_gate_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_milk_manifests" ADD CONSTRAINT "mcc_milk_manifests_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_milk_manifests" ADD CONSTRAINT "mcc_milk_manifests_umucunda_supplier_account_id_fkey" FOREIGN KEY ("umucunda_supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_manifest_lines" ADD CONSTRAINT "mcc_manifest_lines_manifest_id_fkey" FOREIGN KEY ("manifest_id") REFERENCES "public"."mcc_milk_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_manifest_lines" ADD CONSTRAINT "mcc_manifest_lines_farmer_supplier_account_id_fkey" FOREIGN KEY ("farmer_supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_milk_test_results" ADD CONSTRAINT "mcc_milk_test_results_mcc_gate_delivery_id_fkey" FOREIGN KEY ("mcc_gate_delivery_id") REFERENCES "public"."mcc_gate_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_milk_test_results" ADD CONSTRAINT "mcc_milk_test_results_manifest_line_id_fkey" FOREIGN KEY ("manifest_line_id") REFERENCES "public"."mcc_manifest_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_milk_test_results" ADD CONSTRAINT "mcc_milk_test_results_tested_by_user_id_fkey" FOREIGN KEY ("tested_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_farmer_account_id_fkey" FOREIGN KEY ("farmer_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_gate_delivery_id_fkey" FOREIGN KEY ("mcc_gate_delivery_id") REFERENCES "public"."mcc_gate_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_milk_manifest_id_fkey" FOREIGN KEY ("mcc_milk_manifest_id") REFERENCES "public"."mcc_milk_manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_credit_events" ADD CONSTRAINT "mcc_credit_events_mcc_milk_test_result_id_fkey" FOREIGN KEY ("mcc_milk_test_result_id") REFERENCES "public"."mcc_milk_test_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_staff_shifts" ADD CONSTRAINT "mcc_staff_shifts_mcc_account_id_fkey" FOREIGN KEY ("mcc_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_staff_shifts" ADD CONSTRAINT "mcc_staff_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_operational_profiles" ADD CONSTRAINT "mcc_operational_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_cooling_tank_profiles" ADD CONSTRAINT "mcc_cooling_tank_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_facility_snapshots" ADD CONSTRAINT "mcc_facility_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_productions" ADD CONSTRAINT "milk_productions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_productions" ADD CONSTRAINT "milk_productions_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."milk_productions" ADD CONSTRAINT "milk_productions_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wallets" ADD CONSTRAINT "wallets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_posts" ADD CONSTRAINT "feed_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_stories" ADD CONSTRAINT "feed_stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_comments" ADD CONSTRAINT "feed_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_comments" ADD CONSTRAINT "feed_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_comments" ADD CONSTRAINT "feed_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."feed_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_interactions" ADD CONSTRAINT "feed_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_interactions" ADD CONSTRAINT "feed_interactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_interactions" ADD CONSTRAINT "feed_interactions_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."feed_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_post_categories" ADD CONSTRAINT "feed_post_categories_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feed_post_categories" ADD CONSTRAINT "feed_post_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_bookmarks" ADD CONSTRAINT "user_bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_relationships" ADD CONSTRAINT "user_relationships_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_relationships" ADD CONSTRAINT "user_relationships_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_onboardings" ADD CONSTRAINT "user_onboardings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_onboarding_submissions" ADD CONSTRAINT "mcc_onboarding_submissions_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_onboarding_submissions" ADD CONSTRAINT "mcc_onboarding_submissions_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mcc_onboarding_submissions" ADD CONSTRAINT "mcc_onboarding_submissions_linked_account_id_fkey" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_points" ADD CONSTRAINT "user_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_referrals" ADD CONSTRAINT "user_referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_referrals" ADD CONSTRAINT "user_referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_rewards" ADD CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounting_transaction_entries" ADD CONSTRAINT "accounting_transaction_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."accounting_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounting_transaction_entries" ADD CONSTRAINT "accounting_transaction_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_suppliers" ADD CONSTRAINT "payroll_suppliers_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_runs" ADD CONSTRAINT "payroll_runs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_runs" ADD CONSTRAINT "payroll_runs_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_payslips" ADD CONSTRAINT "payroll_payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_payslips" ADD CONSTRAINT "payroll_payslips_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_payslips" ADD CONSTRAINT "payroll_payslips_payroll_supplier_id_fkey" FOREIGN KEY ("payroll_supplier_id") REFERENCES "public"."payroll_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_deductions" ADD CONSTRAINT "payroll_deductions_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "public"."payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_deductions" ADD CONSTRAINT "payroll_deductions_inventory_sale_id_fkey" FOREIGN KEY ("inventory_sale_id") REFERENCES "public"."inventory_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_deductions" ADD CONSTRAINT "payroll_deductions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payroll_deductions" ADD CONSTRAINT "payroll_deductions_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charges" ADD CONSTRAINT "charges_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charge_suppliers" ADD CONSTRAINT "charge_suppliers_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charge_suppliers" ADD CONSTRAINT "charge_suppliers_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charge_applications" ADD CONSTRAINT "charge_applications_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charge_applications" ADD CONSTRAINT "charge_applications_supplier_account_id_fkey" FOREIGN KEY ("supplier_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charge_applications" ADD CONSTRAINT "charge_applications_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "public"."payroll_payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_item_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_sales" ADD CONSTRAINT "inventory_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_sales" ADD CONSTRAINT "inventory_sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_sales" ADD CONSTRAINT "inventory_sales_buyer_account_id_fkey" FOREIGN KEY ("buyer_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_sales" ADD CONSTRAINT "inventory_sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_lender_account_id_fkey" FOREIGN KEY ("lender_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_borrower_account_id_fkey" FOREIGN KEY ("borrower_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regional_supervisor_districts" ADD CONSTRAINT "regional_supervisor_districts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regional_supervisor_districts" ADD CONSTRAINT "regional_supervisor_districts_district_location_id_fkey" FOREIGN KEY ("district_location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."farms" ADD CONSTRAINT "farms_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."farms" ADD CONSTRAINT "farms_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."farm_species_focus" ADD CONSTRAINT "farm_species_focus_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."farm_species_focus" ADD CONSTRAINT "farm_species_focus_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."breeds" ADD CONSTRAINT "breeds_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animals" ADD CONSTRAINT "animals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animals" ADD CONSTRAINT "animals_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animals" ADD CONSTRAINT "animals_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "public"."breeds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animals" ADD CONSTRAINT "animals_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animals" ADD CONSTRAINT "animals_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animals" ADD CONSTRAINT "animals_father_id_fkey" FOREIGN KEY ("father_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_weights" ADD CONSTRAINT "animal_weights_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_health" ADD CONSTRAINT "animal_health_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_health" ADD CONSTRAINT "animal_health_vet_user_id_fkey" FOREIGN KEY ("vet_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_breeding" ADD CONSTRAINT "animal_breeding_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_breeding" ADD CONSTRAINT "animal_breeding_bull_animal_id_fkey" FOREIGN KEY ("bull_animal_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_calving" ADD CONSTRAINT "animal_calving_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "public"."animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."animal_calving" ADD CONSTRAINT "animal_calving_calf_id_fkey" FOREIGN KEY ("calf_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poultry_flocks" ADD CONSTRAINT "poultry_flocks_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poultry_flocks" ADD CONSTRAINT "poultry_flocks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."poultry_flocks" ADD CONSTRAINT "poultry_flocks_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "public"."breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flock_daily_records" ADD CONSTRAINT "flock_daily_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."poultry_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flock_movements" ADD CONSTRAINT "flock_movements_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."poultry_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_batches" ADD CONSTRAINT "pig_batches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_batches" ADD CONSTRAINT "pig_batches_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_batches" ADD CONSTRAINT "pig_batches_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "public"."breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_batch_weights" ADD CONSTRAINT "pig_batch_weights_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."pig_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_farrowings" ADD CONSTRAINT "pig_farrowings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_farrowings" ADD CONSTRAINT "pig_farrowings_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_farrowings" ADD CONSTRAINT "pig_farrowings_pig_batch_id_fkey" FOREIGN KEY ("pig_batch_id") REFERENCES "public"."pig_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pig_farrowings" ADD CONSTRAINT "pig_farrowings_sow_animal_id_fkey" FOREIGN KEY ("sow_animal_id") REFERENCES "public"."animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

