/**
 * Admin utility functions
 * Checks if a user is an admin based on ADMIN_REFOLD_IDS environment variable
 */

/**
 * Checks if a Refold user ID is in the list of admin Refold IDs.
 * @param refoldId - The integer refold_id to check
 * @returns true if the user is an admin, false otherwise
 */
export function isAdmin(refoldId: number): boolean {
  const adminRefoldIds = process.env.ADMIN_REFOLD_IDS;

  if (!adminRefoldIds) {
    return false;
  }

  // Split by comma, trim whitespace, parse to integers
  const adminIds = adminRefoldIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));

  return adminIds.includes(refoldId);
}
