"use client";

import { PreviewMessage, ThinkingMessage } from "@/components/message";
import { MultimodalInput } from "@/components/multimodal-input";
import { Overview } from "@/components/overview";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useState, useEffect } from "react";
import { Message } from "ai";
import { useChat } from "ai/react";
import { toast } from "sonner";

export function Chat() {
  // Track component mounting
  useEffect(() => {
    console.log('Chat component mounted');
    return () => {
      console.log('Chat component unmounted');
    };
  }, []);

  // Generate a stable conversation ID for this session
  const [conversationId, setConversationId] = useState(() => {
    // Use sessionStorage to persist conversation ID across page refreshes
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem('conversationId') : null;
    if (stored) {
      console.log('Using stored conversationId:', stored);
      return stored;
    }

    const newId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating new conversationId:', newId);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('conversationId', newId);
    }
    return newId;
  });

  // Function to start a new conversation
  const startNewConversation = () => {
    const newId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Starting new conversation:', newId);
    setConversationId(newId);
    setMessages([]);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('conversationId', newId);
    }
  };

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
  } = useChat({
    // maxSteps: 4, // Temporarily disable maxSteps to see if it's causing multiple calls
    body: {
      conversationId, // Send conversation ID with each request
    },
    onError: (error) => {
      console.error('Chat error:', error);
      if (error.message.includes("Too many requests")) {
        toast.error(
          "You are sending too many messages. Please try again later.",
        );
      }
    },
  });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  console.log('Chat render - conversationId:', conversationId);
  console.log('Chat render - messages count:', messages.length);
  console.log('Chat render - messages:', messages);
  return (
    <div className="flex flex-col min-w-0 h-[calc(100dvh-52px)] bg-background">
      {/* New Chat button */}
      <div className="flex justify-end px-4 pt-2">
        <button
          onClick={startNewConversation}
          className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors"
        >
          New Chat
        </button>
      </div>
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
      >
        {messages.length === 0 && <Overview />}

        {messages.map((message: Message, index: number) => (
          <PreviewMessage
            key={message.id}
            chatId={conversationId}
            message={message}
            isLoading={isLoading && messages.length - 1 === index}
          />
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingMessage />}

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
