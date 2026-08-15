ALTER TABLE "barbershop" ADD COLUMN "internal_api_key" text;--> statement-breakpoint
CREATE INDEX "barbershop_internal_api_key_idx" ON "barbershop" USING btree ("internal_api_key");--> statement-breakpoint
ALTER TABLE "barbershop" ADD CONSTRAINT "barbershop_internal_api_key_unique" UNIQUE("internal_api_key");