/** Router state for opening the SMS screen on a specific answer: navigate('/sms', { state }). */
export interface SmsScreenState {
  sms: string;
  segments: number;
}
