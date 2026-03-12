/*
  Warnings:

  - Added the required column `machineName` to the `LogRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "AgentToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "machineName" TEXT NOT NULL,
    "description" TEXT,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LogRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "logType" TEXT NOT NULL,
    "machineName" TEXT NOT NULL,
    "timeRangeStart" DATETIME NOT NULL,
    "timeRangeEnd" DATETIME NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ticketId" TEXT NOT NULL,
    CONSTRAINT "LogRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LogRequest" ("createdAt", "errorMessage", "id", "logType", "status", "ticketId", "timeRangeEnd", "timeRangeStart", "updatedAt") SELECT "createdAt", "errorMessage", "id", "logType", "status", "ticketId", "timeRangeEnd", "timeRangeStart", "updatedAt" FROM "LogRequest";
DROP TABLE "LogRequest";
ALTER TABLE "new_LogRequest" RENAME TO "LogRequest";
CREATE INDEX "LogRequest_ticketId_idx" ON "LogRequest"("ticketId");
CREATE INDEX "LogRequest_machineName_status_idx" ON "LogRequest"("machineName", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AgentToken_tokenHash_key" ON "AgentToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentToken_machineName_idx" ON "AgentToken"("machineName");
