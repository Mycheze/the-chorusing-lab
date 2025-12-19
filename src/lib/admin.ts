/**
 * Admin utility functions
 * Checks if a user is an admin based on ADMIN_USER_IDS environment variable
 */

/**
 * Checks if a user ID is in the list of admin user IDs
 * @param userId - The user ID to check
 * @returns true if the user is an admin, false otherwise
 */
export function isAdmin(userId: string): boolean {
  const adminUserIds = process.env.ADMIN_USER_IDS;

  if (!adminUserIds) {
    return false;
  }

  // Split by comma and trim whitespace
  const adminIds = adminUserIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return adminIds.includes(userId);
}
