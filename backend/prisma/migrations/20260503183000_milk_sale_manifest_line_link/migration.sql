-- Link milk collections (milk_sales) to MCC manifest farmer lines (Umucunda) for traceability.
ALTER TABLE "milk_sales" ADD COLUMN "mcc_manifest_line_id" UUID;

CREATE UNIQUE INDEX "milk_sales_mcc_manifest_line_id_key" ON "milk_sales"("mcc_manifest_line_id");

CREATE INDEX "milk_sales_mcc_manifest_line_id_idx" ON "milk_sales"("mcc_manifest_line_id");

ALTER TABLE "milk_sales" ADD CONSTRAINT "milk_sales_mcc_manifest_line_id_fkey" FOREIGN KEY ("mcc_manifest_line_id") REFERENCES "mcc_manifest_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
