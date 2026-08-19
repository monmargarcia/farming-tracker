CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"protocol_id" integer NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"tx_hash" varchar(100),
	"gas_usd" numeric(10, 4),
	"chain" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "protocol_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"protocol_id" integer NOT NULL,
	"points" numeric(20, 4),
	"rank" integer,
	"fetched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"chain" varchar(50) NOT NULL,
	"token_status" varchar(50) NOT NULL,
	"website_url" varchar(255),
	"api_url" varchar(255),
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"protocol_id" integer NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"action_desc" varchar(255) NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" varchar(100) NOT NULL,
	"chain" varchar(50) NOT NULL,
	"label" varchar(100),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "wallets_address_unique" UNIQUE("address")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_points" ADD CONSTRAINT "protocol_points_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_points" ADD CONSTRAINT "protocol_points_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;