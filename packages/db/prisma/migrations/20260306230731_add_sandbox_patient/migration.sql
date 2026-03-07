-- CreateTable
CREATE TABLE "SandboxPatient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "icd10" TEXT NOT NULL,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxPatient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPatient_patientId_key" ON "SandboxPatient"("patientId");

-- CreateIndex
CREATE INDEX "SandboxPatient_payerId_idx" ON "SandboxPatient"("payerId");
