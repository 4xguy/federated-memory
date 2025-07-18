# Setting Up Production User

Since we can't directly access the Railway internal database from outside, you have a few options:

## Option 1: Railway Shell (Recommended)
Open Railway dashboard and use the shell feature:

1. Go to your Railway dashboard
2. Select your federated-memory service
3. Click on "Connect" → "Railway Shell"
4. Run these commands in the shell:

```bash
# First, check if the database is accessible
npx prisma db pull

# Then create the user
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createUser() {
  const prisma = new PrismaClient();
  const email = 'keithrivas@gmail.com';
  const password = '70%qe6izpQ&e17Fg1IHQ';
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        isEmailVerified: true,
        name: 'Keith Rivas',
      }
    });
    console.log('User created:', user.email);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('User already exists, updating...');
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword, isEmailVerified: true }
      });
      console.log('User updated');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

createUser().catch(console.error);
"
```

## Option 2: Direct Database Connection
1. Get your external DATABASE_URL from Railway (not the .internal one)
2. In Railway dashboard, go to your Postgres service
3. Click "Connect" → "Postgres Connection URL"
4. Copy the external URL (starts with postgresql://)
5. Run locally:

```bash
DATABASE_URL="postgresql://..." node create-production-user-railway.js
```

## Option 3: Create Registration Endpoint
Since your auth system supports registration, you could:
1. Temporarily enable registration
2. Register through the UI
3. Manually verify the email in the database

## Current Status
- ✅ CORS is fixed and working
- ✅ Server is healthy and responding
- ❌ User doesn't exist in production database
- ⏳ Need to create user using one of the above methods