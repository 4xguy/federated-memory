import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.provider = account.provider
        token.email = profile.email
        token.name = profile.name
        token.picture = account.provider === 'google' ? (profile as any).picture : (profile as any).avatar_url
      }
      return token
    },
    async signIn({ user, account, profile }) {
      // After successful sign-in, try to create user in backend
      // But don't fail the sign-in if backend is not available
      try {
        const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/oauth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: account?.provider,
            providerId: account?.providerAccountId,
            email: user.email,
            name: user.name,
            avatar: user.image,
          }),
        })
        
        if (!response.ok) {
          console.warn('Failed to create user in backend, but continuing with sign-in')
        }
      } catch (error) {
        console.warn('Error during backend sync, but continuing with sign-in:', error)
      }
      
      // Always allow sign-in to succeed for now
      return true
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
}