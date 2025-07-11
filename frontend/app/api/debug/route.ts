import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
      // Check if it's coming through at all
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('NEXT_PUBLIC')),
    },
    buildTime: new Date().toISOString(),
  });
}