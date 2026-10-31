import type { AppLocationState } from '@/features/app-shell/navigation';

/** Router state for opening the SMS screen on an answer: navigate('/app/sms', { state }). */
export interface SmsScreenState extends AppLocationState {
  sms: string;
  segments: number;
}
