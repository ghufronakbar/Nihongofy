import { z } from "zod";

export const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi."),
  password: z.string().min(1, "Password wajib diisi."),
  next: z.string().max(2048).optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
