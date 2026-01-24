# Default Admin User Credentials

## Login Information

**Email:** `admin@example.com`  
**Password:** `admin123`  
**Name:** מנהל מערכת (System Administrator)

## Access

- Login URL: http://localhost:3000/login
- This admin user has:
  - Full access to the system
  - Ability to invite new customers
  - Linked to all available areas
  - Customer record: "מנהל מערכת"

## Security Note

⚠️ **Important:** Change the default password after first login in production!

## Creating the Admin User

To create or recreate the admin user, run:

```bash
# Get service role key
npx supabase status --output json | grep SERVICE_ROLE_KEY

# Run the script
SUPABASE_SERVICE_ROLE_KEY=<your-key> npm run create-admin
```

Or use the npm script:

```bash
SUPABASE_SERVICE_ROLE_KEY=<your-key> npm run create-admin
```
