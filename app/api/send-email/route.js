import { Resend } from 'resend';

// Initialize Resend lazily to prevent build-time errors when env var is missing
let resend = null;
const getResend = () => {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

export async function POST(request) {
  const resendClient = getResend();

  if (!resendClient) {
    return Response.json(
      { error: 'Email service not configured' },
      { status: 503 }
    );
  }

  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json(
        { error: 'Missing required fields: name, email, and message are required' },
        { status: 400 }
      );
    }

    await resendClient.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: 'oldreliableautomotive@gmail.com',
      subject: `New message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      replyTo: email,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Email send error:', error);
    return Response.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
