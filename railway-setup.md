# Railway CLI Setup Guide

## ✅ Installation Complete
Railway CLI v4.5.5 is now installed on your development environment.

## 🔐 Authentication Steps

Since we're in a non-interactive environment, you'll need to authenticate using one of these methods:

### Option 1: Browser Authentication (Recommended)
1. Open a terminal on your local machine
2. Run: `railway login`
3. A browser window will open for authentication
4. After logging in, return to this environment

### Option 2: Token Authentication
1. Go to https://railway.app/account/tokens
2. Create a new token
3. In this environment, run:
   ```bash
   export RAILWAY_TOKEN="your-token-here"
   ```

## 🔗 Linking Your Project

After authentication, link this project to your Railway service:

```bash
# Link to existing project
railway link

# Or if you know the project ID:
railway link <project-id>
```

## 🚀 Useful Railway Commands

Once linked, you can use these commands:

```bash
# Run commands in production environment
railway run <command>

# View production logs
railway logs

# Open Railway dashboard for this project
railway open

# View environment variables
railway variables

# Connect to production database
railway connect postgres
```

## 📝 Creating Production User

After linking, create the user in production:

```bash
railway run npx tsx create-test-user.js
```

This will create a user with:
- Email: keithrivas@gmail.com
- Password: 70%qe6izpQ&e17Fg1IHQ