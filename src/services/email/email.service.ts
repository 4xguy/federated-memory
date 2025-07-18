import nodemailer from 'nodemailer';
import { logger } from '@/utils/logger';

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses';
  from: {
    email: string;
    name: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  sendgrid?: {
    apiKey: string;
  };
  ses?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.initialize();
  }

  private initialize() {
    try {
      // Load configuration from environment variables
      const provider = process.env.EMAIL_PROVIDER as 'smtp' | 'sendgrid' | 'ses' || 'smtp';
      
      this.config = {
        provider,
        from: {
          email: process.env.EMAIL_FROM || 'noreply@federated-memory.ai',
          name: process.env.EMAIL_FROM_NAME || 'Federated Memory',
        },
      };

      switch (provider) {
        case 'smtp':
          if (!process.env.SMTP_HOST) {
            logger.warn('SMTP configuration not found. Email service disabled.');
            return;
          }

          this.config.smtp = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER || '',
              pass: process.env.SMTP_PASS || '',
            },
          };

          this.transporter = nodemailer.createTransport({
            host: this.config.smtp.host,
            port: this.config.smtp.port,
            secure: this.config.smtp.secure,
            auth: this.config.smtp.auth,
          });
          break;

        case 'sendgrid':
          if (!process.env.SENDGRID_API_KEY) {
            logger.warn('SendGrid API key not found. Email service disabled.');
            return;
          }

          this.config.sendgrid = {
            apiKey: process.env.SENDGRID_API_KEY,
          };

          // SendGrid uses SMTP interface
          this.transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
              user: 'apikey',
              pass: this.config.sendgrid.apiKey,
            },
          });
          break;

        case 'ses':
          // AWS SES configuration would go here
          logger.warn('AWS SES support not yet implemented.');
          break;

        default:
          logger.warn('Unknown email provider. Email service disabled.');
      }

      if (this.transporter) {
        logger.info('Email service initialized', { provider });
      }
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
    }
  }

  private async sendEmail(to: string, template: EmailTemplate) {
    if (!this.transporter || !this.config) {
      logger.warn('Email service not configured. Skipping email send.', { to, subject: template.subject });
      return false;
    }

    try {
      const mailOptions = {
        from: `"${this.config.from.name}" <${this.config.from.email}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { 
        to, 
        subject: template.subject,
        messageId: info.messageId 
      });
      return true;
    } catch (error) {
      logger.error('Failed to send email', { to, subject: template.subject, error });
      return false;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, verificationToken: string) {
    const verificationUrl = `${this.baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    
    const template: EmailTemplate = {
      subject: 'Verify your Federated Memory account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .logo { font-size: 24px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🧠 Federated Memory</div>
              <h1>Verify your email address</h1>
            </div>
            <div class="content">
              <p>Hi there!</p>
              <p>Thanks for creating a Federated Memory account. To complete your registration, please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 5px;">
                ${verificationUrl}
              </p>
              <p>This link will expire in 24 hours for security reasons.</p>
              <p>If you didn't create an account with Federated Memory, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Federated Memory. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Verify your Federated Memory account

Hi there!

Thanks for creating a Federated Memory account. To complete your registration, please verify your email address by visiting the link below:

${verificationUrl}

This link will expire in 24 hours for security reasons.

If you didn't create an account with Federated Memory, you can safely ignore this email.

© ${new Date().getFullYear()} Federated Memory. All rights reserved.
      `.trim(),
    };

    return this.sendEmail(email, template);
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, token: string) {
    const dashboardUrl = `${this.baseUrl}/dashboard`;
    
    const template: EmailTemplate = {
      subject: 'Welcome to Federated Memory!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Federated Memory</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .token-box { background-color: #e5e7eb; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .logo { font-size: 24px; font-weight: bold; }
            .feature { margin: 15px 0; padding-left: 25px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🧠 Federated Memory</div>
              <h1>Welcome aboard!</h1>
            </div>
            <div class="content">
              <p>Congratulations! Your email has been verified and your Federated Memory account is now active.</p>
              
              <h2>Your API Token</h2>
              <p>Here's your unique API token. Keep it secure - you'll need it to authenticate with our API:</p>
              <div class="token-box">${token}</div>
              
              <div style="text-align: center;">
                <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
              </div>
              
              <h2>What's next?</h2>
              <div class="feature">
                <strong>🔧 Set up MCP Integration</strong><br>
                Configure your Claude Desktop or other MCP clients with your token.
              </div>
              <div class="feature">
                <strong>📚 Explore Memory Modules</strong><br>
                Start organizing your knowledge with our specialized memory modules.
              </div>
              <div class="feature">
                <strong>🚀 Build with Our API</strong><br>
                Integrate Federated Memory into your applications.
              </div>
              
              <p>Need help getting started? Check out our <a href="${this.baseUrl}/docs">documentation</a> or reach out to our support team.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Federated Memory. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to Federated Memory!

Congratulations! Your email has been verified and your Federated Memory account is now active.

Your API Token
--------------
Here's your unique API token. Keep it secure - you'll need it to authenticate with our API:

${token}

What's next?
-----------
- Set up MCP Integration: Configure your Claude Desktop or other MCP clients with your token.
- Explore Memory Modules: Start organizing your knowledge with our specialized memory modules.
- Build with Our API: Integrate Federated Memory into your applications.

Go to Dashboard: ${dashboardUrl}

Need help getting started? Check out our documentation at ${this.baseUrl}/docs or reach out to our support team.

© ${new Date().getFullYear()} Federated Memory. All rights reserved.
      `.trim(),
    };

    return this.sendEmail(email, template);
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', { error });
      return false;
    }
  }
}

export const emailService = new EmailService();