CREATE TABLE "LibraryRoot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LibraryRoot_path_key" ON "LibraryRoot"("path");

ALTER TABLE "Media" ADD COLUMN "root_id" INTEGER;

ALTER TABLE "Media" ADD COLUMN "file_modified_at" DATETIME;
