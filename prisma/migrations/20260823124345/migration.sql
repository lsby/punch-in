/*
  Warnings:

  - Added the required column `jwt_secret` to the `system_config` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_system_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_initialized" BOOLEAN NOT NULL DEFAULT false,
    "enable_register" BOOLEAN NOT NULL,
    "enable_get_interface_type" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "jwt_secret" TEXT NOT NULL
);
INSERT INTO "new_system_config" ("created_at", "enable_register", "id", "is_initialized", "updated_at", "version") SELECT "created_at", "enable_register", "id", "is_initialized", "updated_at", "version" FROM "system_config";
DROP TABLE "system_config";
ALTER TABLE "new_system_config" RENAME TO "system_config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
