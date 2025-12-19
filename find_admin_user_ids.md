# Finding Your Admin User IDs

To find your admin user IDs to use in the `is_admin_user` function:

1. **From your environment variable**: Check your `.env.local` file for `ADMIN_USER_IDS` - it should be a comma-separated list of user IDs.

2. **From Supabase Dashboard**:

   - Go to Authentication > Users
   - Find the users you want to make admins
   - Copy their User UID (the UUID shown in the user list)

3. **From your application logs**: When you log in as an admin, check the console logs - the user ID should be logged.

Once you have the UUIDs, replace the placeholder UUIDs in the `is_admin_user` function with your actual admin user IDs.
