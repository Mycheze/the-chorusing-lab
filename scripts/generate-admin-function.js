#!/usr/bin/env node
/**
 * Helper script to generate the is_admin_user SQL function
 * with your actual admin user IDs from the environment variable
 *
 * Usage: node scripts/generate-admin-function.js
 */

const fs = require("fs");
const path = require("path");

// Try to read from .env.local
let adminUserIds = process.env.ADMIN_USER_IDS;

if (!adminUserIds) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/ADMIN_USER_IDS=(.+)/);
    if (match) {
      adminUserIds = match[1].trim();
    }
  }
}

if (!adminUserIds) {
  console.error("❌ ADMIN_USER_IDS not found in .env.local");
  console.log("\nPlease set ADMIN_USER_IDS in your .env.local file:");
  console.log("ADMIN_USER_IDS=user-id-1,user-id-2,user-id-3");
  process.exit(1);
}

// Split and clean the admin IDs
const adminIds = adminUserIds
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

if (adminIds.length === 0) {
  console.error("❌ No admin user IDs found in ADMIN_USER_IDS");
  process.exit(1);
}

// Generate UUID array for SQL
const uuidArray = adminIds.map((id) => `    '${id}'::UUID`).join(",\n");

const sql = `-- Create a function to check if a user is an admin
-- This function will be used in RLS policies
-- Generated from ADMIN_USER_IDS environment variable

CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_id = ANY(ARRAY[
${uuidArray}
  ]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO authenticated;

-- Example RLS policies (you can copy these to Supabase dashboard):
-- 
-- UPDATE Policy:
-- create policy "enable_update_for_owners_and_admins"
-- on "public"."audio_clips"
-- as PERMISSIVE
-- for UPDATE
-- to public
-- using (
--   uploaded_by = auth.uid() OR is_admin_user(auth.uid())
-- );
--
-- DELETE Policy:
-- create policy "enable_delete_for_owners_and_admins"
-- on "public"."audio_clips"
-- as PERMISSIVE
-- for DELETE
-- to public
-- using (
--   uploaded_by = auth.uid() OR is_admin_user(auth.uid())
-- );
`;

console.log(
  "✅ Generated SQL function with",
  adminIds.length,
  "admin user ID(s)"
);
console.log("\n" + "=".repeat(60));
console.log(sql);
console.log("=".repeat(60));
console.log("\n📋 Copy the SQL above and run it in Supabase SQL Editor");
console.log("   Then create/update your RLS policies as shown in the comments");
