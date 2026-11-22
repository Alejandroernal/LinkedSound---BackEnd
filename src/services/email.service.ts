import nodemailer, { type Transporter } from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export class EmailService {
  private transporter: Transporter | null = null

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter

    const user = process.env.EMAIL_USER || process.env.SMTP_USER || process.env.GMAIL_USER
    const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD
    const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com'
    const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587))
    const secure = port === 465

    if (!user || !pass) {
      return null
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      })
      return this.transporter
    } catch (err) {
      console.warn('[EmailService] Error al inicializar transporter SMTP:', err)
      return null
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@linkedsound.com'
    const transporter = this.getTransporter()

    if (!transporter) {
      console.log(`[EmailService - Modo Registro] Destinatario: ${options.to}`)
      console.log(`[EmailService - Modo Registro] Asunto: ${options.subject}`)
      if (options.text) {
        console.log(`[EmailService - Modo Registro] Contenido: ${options.text}`)
      }
      return true
    }

    try {
      await transporter.sendMail({
        from: `"LinkedSound" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      console.log(`[EmailService] Correo enviado exitosamente a: ${options.to}`)
      return true
    } catch (error) {
      console.warn(`[EmailService] Fallo al enviar correo a ${options.to}:`, error)
      return false
    }
  }

  async sendPasswordResetCode(toEmail: string, code: string, recipientName = 'Creador'): Promise<boolean> {
    const subject = `${code} es tu codigo de recuperacion de LinkedSound`

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recuperacion de Contrasena - LinkedSound</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0d17;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .container {
      max-width: 540px;
      margin: 30px auto;
      background: #141628;
      border: 1px solid rgba(168, 85, 247, 0.3);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }
    .header {
      background: linear-gradient(135deg, #1f1b3c, #141628);
      padding: 28px 24px;
      text-align: center;
      border-bottom: 1px solid rgba(168, 85, 247, 0.2);
    }
    .logo-text {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin: 0;
    }
    .logo-accent {
      color: #c084fc;
    }
    .content {
      padding: 32px 28px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #cbd5e1;
      margin: 0 0 20px 0;
    }
    .code-box {
      background: rgba(168, 85, 247, 0.12);
      border: 2px dashed #a855f7;
      border-radius: 12px;
      text-align: center;
      padding: 20px;
      margin: 24px 0;
    }
    .code {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #00e5ff;
      margin: 0;
    }
    .expiry {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 8px;
    }
    .footer {
      background: #0f1325;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo-text">Linked<span class="logo-accent">Sound</span></h1>
    </div>
    <div class="content">
      <h2 class="title">Recuperacion de Contrasena</h2>
      <p class="text">Hola ${recipientName}, recibimos una solicitud para restablecer la contrasena de tu cuenta en LinkedSound.</p>
      <p class="text">Utiliza el siguiente codigo de 6 digitos en la aplicacion para continuar con el restablecimiento:</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="expiry">Este codigo expira en 15 minutos</div>
      </div>

      <p class="text" style="font-size: 12px; color: #94a3b8;">
        Si tu no realizaste esta solicitud, puedes desestimar este mensaje de forma segura. Tu contrasena actual no sera modificada hasta que se verifique este codigo.
      </p>
    </div>
    <div class="footer">
      LinkedSound - Red de colaboracion profesional para artistas y productores
    </div>
  </div>
</body>
</html>
`
    const text = `Hola ${recipientName}. Tu codigo de recuperacion de contrasena de LinkedSound es: ${code}. Expira en 15 minutos.`

    return await this.sendEmail({
      to: toEmail,
      subject,
      html,
      text,
    })
  }
}

export const emailService = new EmailService()
