type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  sent: boolean;
  reason?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || "Click <hello@click.local>";
}

export async function sendTransactionalEmail(
  email: TransactionalEmail,
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.CLICK_EMAIL_DEBUG === "true") {
      console.info("[Click email skipped]", {
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
    }

    return { sent: false, reason: "RESEND_API_KEY is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html ?? textToHtml(email.text),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      sent: false,
      reason: body || `Resend returned ${response.status}.`,
    };
  }

  return { sent: true };
}
