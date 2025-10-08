// ABOUTME: Pure presentation component for chat interface
// ABOUTME: Receives all state and actions via props, contains no business logic

"use client";

import { PreviewMessage, ThinkingMessage } from "./message";
import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";
import type { Message, CreateMessage, ChatRequestOptions } from "ai";
import type { RefObject, Dispatch, SetStateAction } from "react";

export interface ChatProps {
  // State
  conversationId: string;
  messages: Message[];
  input: string;
  isLoading: boolean;
  isThinking: boolean;
  isEmpty: boolean;

  // Actions - match MultimodalInput's expected types
  setInput: (value: string) => void;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  stop: () => void;
  onNewConversation: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;

  // Refs for scrolling
  messagesContainerRef: RefObject<HTMLDivElement>;
  messagesEndRef: RefObject<HTMLDivElement>;
}

/**
 * Pure presentation component for the chat interface
 * All state and business logic is managed by the container
 */
export function Chat({
  conversationId,
  messages,
  input,
  isLoading,
  isThinking,
  isEmpty,
  setInput,
  handleSubmit,
  stop,
  onNewConversation,
  setMessages,
  append,
  messagesContainerRef,
  messagesEndRef,
}: ChatProps) {
  return (
    <div className="flex flex-col min-w-0 h-[calc(100dvh-52px)] bg-background">
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
      >
        {isEmpty && <Overview />}

        {messages.map((message: Message, index: number) => (
          <PreviewMessage
            key={message.id}
            chatId={conversationId}
            message={message}
            isLoading={isLoading && messages.length - 1 === index}
          />
        ))}

        {isThinking && <ThinkingMessage />}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>

      <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
        <MultimodalInput
          chatId={conversationId}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          messages={messages}
          setMessages={setMessages}
          append={append}
        />
      </form>
    </div>
  );
}
