
export type SmsMessage = {
  id: string;
  phone: string;
  message: string;
  type: "otp" | "appointment" | "cancellation" | "reschedule";
  status: "sent" | "failed";
  createdAt: string;
};

export const smsMessages: SmsMessage[] = [];

export async function sendSms(
  phone: string,
  message: string,
  type: SmsMessage["type"]
): Promise<SmsMessage> {
  // Development mode: log SMS instead of sending it.
  console.log("\n========== SMS MESSAGE ==========");
  console.log("To:", phone);
  console.log("Message:", message);
  console.log("=================================\n");

  const record: SmsMessage = {
    id: `sms_${Date.now()}`,
    phone,
    message,
    type,
    status: "sent",
    createdAt: new Date().toISOString()
  };

  smsMessages.push(record);

  return record;
}

export function getAllSmsMessages(): SmsMessage[] {
  return [...smsMessages];
}

export function getSmsMessagesByPhone(phone: string): SmsMessage[] {
  return smsMessages.filter(item => item.phone === phone);
}
