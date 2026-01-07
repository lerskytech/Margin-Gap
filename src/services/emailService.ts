import { supabase } from './supabase'

export interface SendEmailRequest {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendEmailResponse {
  success: boolean
  error?: string
  errorCode?: 'EMAIL_NOT_CONFIGURED' | 'RATE_LIMITED' | 'PROVIDER_ERROR'
}

export const emailService = {
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not configured',
        errorCode: 'EMAIL_NOT_CONFIGURED',
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: request,
      })

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to send email',
          errorCode: 'PROVIDER_ERROR',
        }
      }

      if (data?.error) {
        return {
          success: false,
          error: data.error,
          errorCode: data.errorCode || 'PROVIDER_ERROR',
        }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'PROVIDER_ERROR',
      }
    }
  },

  async sendTestEmail(userEmail: string, productTitle: string, price: number): Promise<SendEmailResponse> {
    return this.sendEmail({
      to: userEmail,
      subject: `Test Alert: ${productTitle}`,
      html: `
        <h2>Test Price Alert</h2>
        <p>This is a test email to verify email delivery is working.</p>
        <p><strong>Product:</strong> ${productTitle}</p>
        <p><strong>Current Price:</strong> $${price.toFixed(2)}</p>
        <p>If you received this email, your alert system is configured correctly!</p>
      `,
      text: `Test Price Alert\n\nProduct: ${productTitle}\nCurrent Price: $${price.toFixed(2)}\n\nThis is a test email to verify email delivery is working.`,
    })
  },
}

