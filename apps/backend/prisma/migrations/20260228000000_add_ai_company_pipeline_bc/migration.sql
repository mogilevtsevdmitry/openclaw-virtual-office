-- DropForeignKey
ALTER TABLE "fin_transaction_tags" DROP CONSTRAINT "fin_transaction_tags_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "fin_transaction_tags" DROP CONSTRAINT "fin_transaction_tags_transaction_id_fkey";

-- DropTable
DROP TABLE "agent_logs";

-- DropTable
DROP TABLE "emails";

-- DropTable
DROP TABLE "fin_accounts";

-- DropTable
DROP TABLE "fin_tags";

-- DropTable
DROP TABLE "fin_transaction_tags";

-- DropTable
DROP TABLE "fin_transactions";

