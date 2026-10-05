const fs = require('fs')
const nodemailer = require('nodemailer')

const raw = fs.readFileSync('.env.local', 'utf8')

function env(name) {
  const line = raw
    .split(/\r?\n/)
    .find(x => x.startsWith(name + '='))

  if (!line) return ''

  return line
    .slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
}

const user = env('GMAIL_USER')

const pass = env('GMAIL_APP_PASSWORD')
  .replace(/\s+/g, '')

if (!user || !pass) {
  console.error(
    '✗ Thiếu GMAIL_USER hoặc GMAIL_APP_PASSWORD trong .env.local'
  )
  process.exit(1)
}

const transporter =
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  })

async function main() {
  console.log('Đang kiểm tra Gmail...')

  await transporter.verify()

  console.log('✓ Gmail đăng nhập thành công')

  const info =
    await transporter.sendMail({
      from:
        `DinhThong Gallery <${user}>`,

      to: user,

      subject:
        'TEST BOOKING - DinhThong Gallery',

      html: `
        <div style="
          font-family:Arial,sans-serif;
          line-height:1.7;
        ">
          <h2>Test Email thành công</h2>

          <p>
            Đây là email kiểm tra hệ thống
            Booking của DinhThong Gallery.
          </p>

          <p>
            Gmail SMTP đang hoạt động bình thường.
          </p>

          <p>
            Trân trọng,<br>
            <b>Đình Thông</b>
          </p>
        </div>
      `,
    })

  console.log('✓ Đã gửi email test')
  console.log('Message ID:', info.messageId)
}

main().catch(error => {
  console.error('✗ GỬI EMAIL THẤT BẠI')
  console.error(error.message)
  process.exit(1)
})
