export type WhatsAppTemplateKey =
  | 'OTP_VERIFICATION'
  | 'LESSON_REMINDER'
  | 'PAYMENT_REMINDER'
  | 'ENROLLMENT_CONFIRMATION'
  | 'ATTENDANCE_ALERT';

export type WhatsAppLanguageCode = 'kg' | 'uz' | 'ru' | 'en';

export const WhatsAppTemplates: Record<
  WhatsAppTemplateKey,
  {
    name: string;
    languages: Record<WhatsAppLanguageCode, string>;
  }
> = {
  OTP_VERIFICATION: {
    name: 'otp_verification',
    languages: { kg: 'kg', uz: 'uz', ru: 'ru', en: 'en' },
  },
  LESSON_REMINDER: {
    name: 'lesson_reminder',
    languages: { kg: 'kg', uz: 'uz', ru: 'ru', en: 'en' },
  },
  PAYMENT_REMINDER: {
    name: 'payment_reminder',
    languages: { kg: 'kg', uz: 'uz', ru: 'ru', en: 'en' },
  },
  ENROLLMENT_CONFIRMATION: {
    name: 'enrollment_confirmation',
    languages: { kg: 'kg', uz: 'uz', ru: 'ru', en: 'en' },
  },
  ATTENDANCE_ALERT: {
    name: 'attendance_alert',
    languages: { kg: 'kg', uz: 'uz', ru: 'ru', en: 'en' },
  },
};
