-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "last_agent_visit_at" TIMESTAMP(3),
ADD COLUMN     "one_liner" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summary_updated_at" TIMESTAMP(3);
