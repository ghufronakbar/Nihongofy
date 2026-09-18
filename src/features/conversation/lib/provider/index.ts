import "server-only";

import { CONVERSATION_PROVIDER } from "@/constants";
import { createMockChatProvider } from "./mock";
import { createOpenAiChatProvider } from "./openai";
import type { ChatProvider } from "./types";

// Resolver provider. Feature memanggil `getChatProvider()` dan tidak pernah
// tahu implementasi mana yang aktif — itulah yang membuat UI Tahap B/C tidak
// perlu ditulis ulang saat provider nyata masuk pada Tahap E.
export function getChatProvider(): ChatProvider {
  switch (CONVERSATION_PROVIDER) {
    case "mock":
      return createMockChatProvider();
    case "openai":
      return createOpenAiChatProvider();
  }
}

export type { ChatProvider, ChatReply, ChatRequest } from "./types";
export { ChatProviderError } from "./types";
