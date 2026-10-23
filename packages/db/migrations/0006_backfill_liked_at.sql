-- Hearts given before liked_at existed: best known date is the state's last update.
UPDATE "user_item_state" SET "liked_at" = "updated_at" WHERE "liked" AND "liked_at" IS NULL;
