import { Resend } from 'resend';
import { render } from "@react-email/render";
import { LiquidateNonCompliantAssets } from "./emails/liquidate-non-compliant-assets";
import { LiquidateDroppedFundHoldings } from "./emails/liquidate-dropped-fund-holdings";
import { requireEnv } from '@/helpers';

const resend = new Resend(requireEnv('RESEND_KEY'));
const from = requireEnv('NOTIFICATIONS_SENDER_EMAIL')

// Want to add another email template? Just drop the details below and you're set!
const TEMPLATES = {
  "liquidate-non-compliant-asset": {
    from,
    subject: "[Time sensitive] Selling non-compliant assets in 24 hrs",
    email: LiquidateNonCompliantAssets,
  },
  "liquidate-dropped-fund-holdings": {
    from,
    subject: "[Time sensitive] Fund Updated: Dropping assets in 24 hrs",
    email: LiquidateDroppedFundHoldings,
  },
} as const;

type TemplateKey = keyof typeof TEMPLATES;
export async function sendEmail<K extends TemplateKey>(
  template: K,
  data: Parameters<(typeof TEMPLATES)[K]["email"]>[0],
  to: string
) {
  // @ts-ignore
  const element = await TEMPLATES[template].email(data)
  const html = render(element);

  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Not sending email in development mode');
    console.log(data);
    return;
  }

  const response = await resend.sendEmail({
    ...{
      ...TEMPLATES[template],
      html,
    },
    to,
    ...(process.env.NOTIFICATIONS_BCC_EMAIL ? { bcc: process.env.NOTIFICATIONS_BCC_EMAIL } : {})
  });

  return response;
}

export const tailwind = {
  theme: {
    extend: {
      colors: {
        brand: "#500EDB",
      },
    },
  },
};
