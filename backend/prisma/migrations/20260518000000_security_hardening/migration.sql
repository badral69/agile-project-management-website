-- Stripe event idempotency: track processed event IDs to prevent double-processing
CREATE TABLE "StripeEvent" (
  "id" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- Task.reporterId: make nullable so reporter deletion orphans the task (SetNull) rather than deleting it
ALTER TABLE "Task" ALTER COLUMN "reporterId" DROP NOT NULL;
ALTER TABLE "Task" DROP CONSTRAINT "Task_reporterId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Project.ownerId: SetNull on user deletion so projects survive without an owner
ALTER TABLE "Project" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "Project" DROP CONSTRAINT "Project_ownerId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Company.createdById: SetNull on user deletion so companies survive
ALTER TABLE "Company" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Company" DROP CONSTRAINT "Company_createdById_fkey";
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Comment.authorId: Cascade so comments are removed with their author
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Attachment.uploaderId: Cascade so attachments are removed with their uploader
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploaderId_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
