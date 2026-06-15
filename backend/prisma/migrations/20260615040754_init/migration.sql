-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "realName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "skills" TEXT NOT NULL,
    "maxWorkHours" REAL NOT NULL DEFAULT 8,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Remains" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "idCardNumber" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "deathDate" DATETIME NOT NULL,
    "deathCause" TEXT NOT NULL,
    "deathCertNumber" TEXT NOT NULL,
    "deathCertIssuer" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "familyPhone" TEXT NOT NULL,
    "familyRelation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "storageRequirement" TEXT NOT NULL,
    "expectedCeremonyTime" DATETIME,
    "cabinetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Remains_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Remains_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "StorageCabinet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StorageCabinet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cabinetNo" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "temperature" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CeremonyHall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hallNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "facilities" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ceremony" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remainsId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "familyPreference" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ceremony_remainsId_fkey" FOREIGN KEY ("remainsId") REFERENCES "Remains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ceremony_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "CeremonyHall" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ceremony_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CremationFurnace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "furnaceNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "fuelLevel" REAL NOT NULL DEFAULT 100,
    "lastMaintenance" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Cremation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remainsId" TEXT NOT NULL,
    "furnaceId" TEXT NOT NULL,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "fuelUsed" REAL,
    "emissionLevel" REAL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cremation_remainsId_fkey" FOREIGN KEY ("remainsId") REFERENCES "Remains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cremation_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "CremationFurnace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AshesNiche" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nicheNo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ashes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remainsId" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,
    "storageStart" DATETIME NOT NULL,
    "storageEnd" DATETIME,
    "pickupCode" TEXT NOT NULL,
    "pickupStatus" TEXT NOT NULL DEFAULT 'NOT_PICKED',
    "pickedUpBy" TEXT,
    "pickedUpAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ashes_remainsId_fkey" FOREIGN KEY ("remainsId") REFERENCES "Remains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ashes_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "AshesNiche" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remainsId" TEXT NOT NULL,
    "feeItemId" TEXT NOT NULL,
    "paymentId" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeRecord_remainsId_fkey" FOREIGN KEY ("remainsId") REFERENCES "Remains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeRecord_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "FeeItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeeRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remainsId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalDate" DATETIME NOT NULL,
    "originalShift" TEXT NOT NULL,
    "requestedDate" DATETIME NOT NULL,
    "requestedShift" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Remains_idCardNumber_key" ON "Remains"("idCardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Remains_deathCertNumber_key" ON "Remains"("deathCertNumber");

-- CreateIndex
CREATE INDEX "Remains_status_idx" ON "Remains"("status");

-- CreateIndex
CREATE INDEX "Remains_deathDate_idx" ON "Remains"("deathDate");

-- CreateIndex
CREATE UNIQUE INDEX "StorageCabinet_cabinetNo_key" ON "StorageCabinet"("cabinetNo");

-- CreateIndex
CREATE UNIQUE INDEX "CeremonyHall_hallNo_key" ON "CeremonyHall"("hallNo");

-- CreateIndex
CREATE UNIQUE INDEX "Ceremony_remainsId_key" ON "Ceremony"("remainsId");

-- CreateIndex
CREATE UNIQUE INDEX "CremationFurnace_furnaceNo_key" ON "CremationFurnace"("furnaceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Cremation_remainsId_key" ON "Cremation"("remainsId");

-- CreateIndex
CREATE INDEX "Cremation_status_sequence_idx" ON "Cremation"("status", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AshesNiche_nicheNo_key" ON "AshesNiche"("nicheNo");

-- CreateIndex
CREATE UNIQUE INDEX "Ashes_remainsId_key" ON "Ashes"("remainsId");

-- CreateIndex
CREATE UNIQUE INDEX "Ashes_pickupCode_key" ON "Ashes"("pickupCode");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_remainsId_key" ON "Payment"("remainsId");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_userId_date_key" ON "Schedule"("userId", "date");
