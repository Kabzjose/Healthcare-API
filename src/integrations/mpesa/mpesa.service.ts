import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// ── Daraja API base URLs ───────────────────────────────────────────────────────
const MPESA_BASE_URL =
  env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// ── Generate OAuth access token ───────────────────────────────────────────────
// Safaricom requires a Bearer token on every API call
// Tokens expire after 1 hour — in production you would cache this
const getAccessToken = async (): Promise<string> => {
  const credentials = Buffer.from(
    `${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await axios.get(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  return response.data.access_token;
};

// ── Generate Lipa Na M-Pesa password ─────────────────────────────────────────
// Password = Base64(Shortcode + Passkey + Timestamp)
const generatePassword = (timestamp: string): string => {
  const raw = `${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString('base64');
};

// ── Format timestamp as YYYYMMDDHHmmss ───────────────────────────────────────
const getTimestamp = (): string => {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
};

// ── Initiate STK Push ─────────────────────────────────────────────────────────
// Sends a payment prompt to the patient's phone
export const initiateSTKPush = async (params: {
  phone: string;       // format: 254712345678 (no + prefix)
  amount: number;
  appointmentId: string;
  accountReference: string; // shown on patient's M-Pesa statement
  description: string;
}): Promise<{ checkoutRequestId: string; merchantRequestId: string }> => {
  const accessToken = await getAccessToken();
  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);

  // Sanitise phone — remove + if present, ensure starts with 254
  const phone = params.phone.replace(/^\+/, '');

  const payload = {
    BusinessShortCode: env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(params.amount), // M-Pesa only accepts whole numbers
    PartyA: phone,                    // customer phone
    PartyB: env.MPESA_SHORTCODE,      // your shortcode
    PhoneNumber: phone,
    CallBackURL: env.MPESA_CALLBACK_URL,
    AccountReference: params.accountReference.slice(0, 12), // max 12 chars
    TransactionDesc: params.description.slice(0, 13),       // max 13 chars
  };

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  logger.info('M-Pesa STK push initiated', {
    checkoutRequestId: response.data.CheckoutRequestID,
    phone,
    amount: params.amount,
  });

  return {
    checkoutRequestId: response.data.CheckoutRequestID,
    merchantRequestId: response.data.MerchantRequestID,
  };
};

// ── M-Pesa callback payload shape ────────────────────────────────────────────
// What Safaricom sends to your callback URL after the patient pays or cancels
export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;       // 0 = success, anything else = failure
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
}

// ── Parse callback metadata into a clean object ───────────────────────────────
export const parseCallbackMetadata = (
  payload: MpesaCallbackPayload
): {
  success: boolean;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
  amount?: number;
} => {
  const callback = payload.Body.stkCallback;
  const success = callback.ResultCode === 0;

  if (!success) {
    return {
      success: false,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
    };
  }

  // Extract values from the metadata array by name
  const items = callback.CallbackMetadata?.Item ?? [];
  const get = (name: string) =>
    items.find((i) => i.Name === name)?.Value;

  return {
    success: true,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    mpesaReceiptNumber: get('MpesaReceiptNumber') as string,
    transactionDate: get('TransactionDate') as string,
    phoneNumber: get('PhoneNumber') as string,
    amount: get('Amount') as number,
  };
};

// ── Query STK push status ─────────────────────────────────────────────────────
// Use this to check payment status manually if callback is delayed
export const querySTKStatus = async (
  checkoutRequestId: string
): Promise<{ resultCode: number; resultDesc: string }> => {
  const accessToken = await getAccessToken();
  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    resultCode: response.data.ResultCode,
    resultDesc: response.data.ResultDesc,
  };
};