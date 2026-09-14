-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "preferredLang" TEXT NOT NULL DEFAULT 'hi-IN',
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT 'Raigad',
    "state" TEXT NOT NULL DEFAULT 'Maharashtra',
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 18.5158,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 73.1822,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Weather Conversation',
    "language" TEXT NOT NULL DEFAULT 'hi-IN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "dataCard" JSONB,
    "sourceProduct" TEXT,
    "issueTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastCache" (
    "id" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT 'Raigad',
    "state" TEXT NOT NULL DEFAULT 'Maharashtra',
    "sourceProduct" TEXT NOT NULL,
    "issueTime" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "alertHash" TEXT,
    "sourceId" TEXT,
    "districtCode" TEXT,
    "district" TEXT NOT NULL,
    "state" TEXT,
    "severity" TEXT NOT NULL,
    "officialSeverity" TEXT,
    "eventType" TEXT,
    "headline" TEXT NOT NULL,
    "warningText" TEXT NOT NULL,
    "rawBulletin" TEXT,
    "normalizedBulletin" TEXT,
    "sourceProduct" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "issueTime" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedLocation_userId_isPrimary_idx" ON "SavedLocation"("userId", "isPrimary");

-- CreateIndex
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatSession_updatedAt_idx" ON "ChatSession"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ForecastCache_district_issueTime_idx" ON "ForecastCache"("district", "issueTime");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_alertHash_key" ON "Alert"("alertHash");

-- CreateIndex
CREATE INDEX "Alert_districtCode_issueTime_idx" ON "Alert"("districtCode", "issueTime");

-- CreateIndex
CREATE INDEX "Alert_issueTime_idx" ON "Alert"("issueTime");

-- CreateIndex
CREATE INDEX "Alert_districtCode_validTo_idx" ON "Alert"("districtCode", "validTo");

-- CreateIndex
CREATE INDEX "Alert_district_validTo_idx" ON "Alert"("district", "validTo");

-- CreateIndex
CREATE INDEX "Alert_validFrom_validTo_idx" ON "Alert"("validFrom", "validTo");

-- AddForeignKey
ALTER TABLE "SavedLocation" ADD CONSTRAINT "SavedLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

