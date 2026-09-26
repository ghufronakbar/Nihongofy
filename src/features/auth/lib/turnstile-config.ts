export const TURNSTILE_ACTIONS = {
  login: "login",
  register: "register",
  forgotPassword: "forgot_password",
  resetPassword: "reset_password",
  resendVerification: "resend_verification",
  confirmEmail: "confirm_email",
  // Form laporan publik. Di luar route group (auth), tetapi alasannya sama:
  // form yang dapat dikirim tanpa akun akan dipakai bot bila tidak dijaga.
  report: "report",
} as const;

export type TurnstileAction =
  (typeof TURNSTILE_ACTIONS)[keyof typeof TURNSTILE_ACTIONS];
