# SMTP Email Setup Guide

This guide explains how to configure SMTP email service for user registration and verification emails in Federated Memory.

## Overview

Federated Memory supports email verification for user accounts. When users register with email/password, they receive a verification email to confirm their email address. The system supports multiple email providers:

- **SMTP** (any SMTP server including Gmail, Outlook, custom servers)
- **SendGrid** (via SMTP interface)
- **AWS SES** (coming soon)

## Quick Setup

### 1. Choose Your Email Provider

The simplest option is to use Gmail with an app-specific password.

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Email Provider
EMAIL_PROVIDER=smtp

# From Address
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="Federated Memory"

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (for verification links)
FRONTEND_URL=https://your-frontend-domain.com
```

## Provider-Specific Setup

### Gmail Setup

1. **Enable 2-Factor Authentication**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the generated 16-character password

3. **Configure `.env`**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your.email@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx  # Your app password
   ```

### Outlook/Office 365 Setup

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@outlook.com
SMTP_PASS=your-password
```

### Custom SMTP Server

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false  # true for port 465
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-password
```

### SendGrid Setup

1. **Get API Key**
   - Sign up at [SendGrid](https://sendgrid.com)
   - Go to Settings → API Keys
   - Create a new API key with "Mail Send" permission

2. **Configure `.env`**
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
   ```

## Email Templates

The system sends two types of emails:

### 1. Verification Email
- Sent when user registers
- Contains verification link
- Link expires in 24 hours
- Styled HTML template with text fallback

### 2. Welcome Email
- Sent after successful verification
- Contains the user's API token
- Includes getting started information

## Testing Email Configuration

### 1. Test Connection

Create a test script `test-email.js`:

```javascript
const { emailService } = require('./dist/services/email/email.service');

async function testEmail() {
  const connected = await emailService.testConnection();
  console.log('Email service connected:', connected);
  
  if (connected) {
    // Test sending
    const sent = await emailService.sendVerificationEmail(
      'test@example.com',
      'test-token-123'
    );
    console.log('Test email sent:', sent);
  }
}

testEmail();
```

### 2. Run the Test

```bash
npm run build
node test-email.js
```

## Troubleshooting

### Common Issues

1. **"Invalid login" or Authentication Failed**
   - Double-check username and password
   - For Gmail, ensure you're using app password, not regular password
   - Check if account has 2FA enabled

2. **"Connection timeout"**
   - Check firewall settings
   - Verify SMTP host and port
   - Try using port 465 with `SMTP_SECURE=true`

3. **"Self signed certificate"**
   - Set `NODE_TLS_REJECT_UNAUTHORIZED=0` (development only)
   - Or use proper SSL certificates

4. **Emails not received**
   - Check spam folder
   - Verify FROM address is valid
   - Check email provider's sending limits

### Debug Mode

Enable email debug logging:

```env
LOG_LEVEL=debug
```

This will log detailed SMTP communication in the console.

## Security Best Practices

1. **Never commit credentials**
   - Keep `.env` in `.gitignore`
   - Use environment variables in production

2. **Use dedicated email accounts**
   - Create a separate email for sending
   - Don't use personal email accounts

3. **Implement rate limiting**
   - Prevent email bombing
   - Already implemented in auth endpoints

4. **Monitor bounce rates**
   - Clean invalid emails from database
   - Implement bounce webhook handlers

## Production Deployment

### Railway

Add environment variables in Railway dashboard:
- Go to your service
- Click on "Variables" tab
- Add all email-related variables

### Docker

Pass environment variables:
```bash
docker run -e EMAIL_PROVIDER=smtp \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_USER=your-email \
  -e SMTP_PASS=your-password \
  federated-memory
```

### Kubernetes

Use secrets for sensitive data:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: email-secrets
type: Opaque
data:
  smtp-pass: <base64-encoded-password>
```

## Monitoring

### Email Metrics

The system logs:
- Email send success/failure
- Send duration
- Error details

Monitor logs for:
```
grep "Email sent successfully" logs/federated-memory.log
grep "Failed to send email" logs/federated-memory.log
```

### Health Check

The email service status is included in the health endpoint:
```
GET /api/health
```

Response includes:
```json
{
  "email": {
    "configured": true,
    "provider": "smtp",
    "connected": true
  }
}
```

## Email Service Methods

### Available Methods

```typescript
// Send verification email
emailService.sendVerificationEmail(email: string, token: string)

// Send welcome email
emailService.sendWelcomeEmail(email: string, apiToken: string)

// Test connection
emailService.testConnection(): Promise<boolean>
```

### Adding Custom Templates

To add new email templates:

1. Add method to `EmailService` class
2. Create HTML and text versions
3. Use consistent styling
4. Test across email clients

Example:
```typescript
async sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${this.baseUrl}/reset-password?token=${resetToken}`;
  
  const template: EmailTemplate = {
    subject: 'Reset your password',
    html: `...`,
    text: `...`
  };
  
  return this.sendEmail(email, template);
}
```

## Support

For issues with email configuration:
1. Check this documentation
2. Review error logs
3. Test with simple SMTP client first
4. Open an issue with sanitized configuration details