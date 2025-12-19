-- Create a function to check if a user is an admin
-- This function will be used in RLS policies
-- Update the user IDs in the array to match your ADMIN_USER_IDS environment variable

CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Replace these UUIDs with your actual admin user IDs from ADMIN_USER_IDS
  -- You can add more UUIDs separated by commas
  RETURN user_id = ANY(ARRAY[
    '00000000-0000-0000-0000-000000000001'::UUID,  -- Replace with your admin user ID
    '00000000-0000-0000-0000-000000000002'::UUID   -- Add more admin IDs as needed
  ]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO authenticated;
