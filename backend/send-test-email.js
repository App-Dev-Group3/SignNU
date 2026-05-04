require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

(async () => {
  try {
    const fromAddress = (process.env.EMAIL_FROM || 'SignNU <no-reply@signnu.work>').trim();
    const toAddress = (process.env.TEST_EMAIL || 'signnu.official@gmail.com').trim();

    console.log('Using from address:', JSON.stringify(fromAddress));
    console.log('Using to address:', JSON.stringify(toAddress));

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: 'SignNU Resend test email',
      html: '<strong>Resend is configured and working.</strong>',
    });

    if (error) {
      console.error('Resend API returned an error:');
      console.error(error);
      process.exit(1);
    }

    console.log('Email sent successfully:');
    console.log(data);
  } catch (error) {
    console.error('Error sending email:', error);
    process.exit(1);
  }
})();
