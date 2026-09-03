export const TURNSTILE_ACTIONS = {
  login: "login",
  register: "register",
  forgotPassword: "forgot_password",
  resetPassword: "reset_password",
  resendVerification: "resend_verification",
  confirmEmail: "confirm_email",
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];
