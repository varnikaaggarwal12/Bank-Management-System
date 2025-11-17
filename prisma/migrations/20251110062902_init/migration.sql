-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_accountNumber_fkey";

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountNumber_fkey" FOREIGN KEY ("accountNumber") REFERENCES "Account"("accountNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
