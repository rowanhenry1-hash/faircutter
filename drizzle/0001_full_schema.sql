CREATE TYPE "public"."group_status" AS ENUM('active', 'archived', 'settled');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('household', 'trip', 'one_time', 'couple');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."settlement_type" AS ENUM('manual', 'smart_netted', 'subgroup_netted');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('equal', 'percentage', 'fixed_amount', 'by_income', 'itemized', 'weighted', 'usage_based', 'exempt', 'rotating', 'subsidized');--> statement-breakpoint
CREATE TABLE "expense_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"user_id" uuid,
	"ghost_user_id" uuid,
	"share_amount" integer NOT NULL,
	"is_exempt" boolean DEFAULT false NOT NULL,
	"exception_reason" text
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"paid_by_user_id" uuid,
	"paid_by_ghost_id" uuid,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"rule_id" uuid,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghost_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"access_code" text NOT NULL,
	"email" text,
	"declared_income" integer,
	"claimed_by_user_id" uuid,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid,
	"ghost_user_id" uuid,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"income_snapshot" integer,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "group_type" DEFAULT 'household' NOT NULL,
	"status" "group_status" DEFAULT 'active' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rule_fragments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_text" text NOT NULL,
	"display_label" text NOT NULL,
	"rule_mapping" jsonb NOT NULL,
	"language" text DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"owner_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"split_type" "split_type" NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applies_to_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"from_user_id" uuid,
	"from_ghost_id" uuid,
	"to_user_id" uuid,
	"to_ghost_id" uuid,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"settlement_type" "settlement_type" DEFAULT 'manual' NOT NULL,
	"marked_paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"applies_to" text NOT NULL,
	"rule_set" jsonb NOT NULL,
	"suggested_members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "paySchedule" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "payAnchorDate" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "dataSharingOptIn" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_ghost_user_id_ghost_users_id_fk" FOREIGN KEY ("ghost_user_id") REFERENCES "public"."ghost_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_user_id_user_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_ghost_id_ghost_users_id_fk" FOREIGN KEY ("paid_by_ghost_id") REFERENCES "public"."ghost_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_users" ADD CONSTRAINT "ghost_users_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_users" ADD CONSTRAINT "ghost_users_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_ghost_user_id_ghost_users_id_fk" FOREIGN KEY ("ghost_user_id") REFERENCES "public"."ghost_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_ghost_id_ghost_users_id_fk" FOREIGN KEY ("from_ghost_id") REFERENCES "public"."ghost_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_ghost_id_ghost_users_id_fk" FOREIGN KEY ("to_ghost_id") REFERENCES "public"."ghost_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ep_expense_idx" ON "expense_participants" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "ep_user_idx" ON "expense_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ep_ghost_idx" ON "expense_participants" USING btree ("ghost_user_id");--> statement-breakpoint
CREATE INDEX "expenses_group_idx" ON "expenses" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "expenses_occurred_idx" ON "expenses" USING btree ("group_id","occurred_at");--> statement-breakpoint
CREATE INDEX "expenses_rule_idx" ON "expenses" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ghost_users_access_code_idx" ON "ghost_users" USING btree ("access_code");--> statement-breakpoint
CREATE INDEX "ghost_users_group_idx" ON "ghost_users" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_group_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_members_ghost_idx" ON "group_members" USING btree ("ghost_user_id");--> statement-breakpoint
CREATE INDEX "rules_group_idx" ON "rules" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "rules_owner_idx" ON "rules" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "rules_priority_idx" ON "rules" USING btree ("group_id","priority");--> statement-breakpoint
CREATE INDEX "settlements_group_idx" ON "settlements" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "settlements_from_idx" ON "settlements" USING btree ("from_user_id","from_ghost_id");--> statement-breakpoint
CREATE INDEX "settlements_to_idx" ON "settlements" USING btree ("to_user_id","to_ghost_id");