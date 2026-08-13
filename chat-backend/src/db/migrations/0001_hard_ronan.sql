ALTER TABLE "users" ADD COLUMN "is_online" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;