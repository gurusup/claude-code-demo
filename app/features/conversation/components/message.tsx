"use client";

import type { Message } from "ai";
import { motion } from "framer-motion";

import { SparklesIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { cn } from "@/lib/utils";
import { Weather } from "./weather";

export const PreviewMessage = ({
  message,
}: {
  chatId: string;
  message: Message;
  isLoading: boolean;
}) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn(
          "group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl"
        )}
      >
        {message.role === "assistant" && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          <MessageRender message={message} />
        </div>
      </div>
    </motion.div>
  );
};

export const MessageRender = ({ message }: { message: Message }) => {
  if (message.toolInvocations && message.toolInvocations.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        {message.toolInvocations.map((toolInvocation) => {
          const { toolName, toolCallId, state } = toolInvocation;

          // Only render ONE widget per tool invocation based on state
          if (toolName === "get_current_weather") {
            if (state === "result") {
              // Show the completed weather widget with data
              const { result } = toolInvocation;
              return (
                <div key={toolCallId}>
                  <Weather weatherAtLocation={result} />
                </div>
              );
            } else {
              // Show loading skeleton for pending/executing states
              return (
                <div key={toolCallId} className="skeleton">
                  <Weather />
                </div>
              );
            }
          }

          // Handle other tools
          if (state === "result") {
            const { result } = toolInvocation;
            return (
              <div key={toolCallId}>
                <pre>{JSON.stringify(result, null, 2)}</pre>
              </div>
            );
          }

          // Return null for non-weather tools in pending state
          return null;
        })}
      </div>
    );
  }
  if (
    message.content &&
    message.toolInvocations &&
    message.toolInvocations.length == 0 &&
    (message.role == "user" || message.role == "assistant")
  ) {
    return (
      <div className="flex flex-col gap-4">
        <Markdown>{message.content as string}</Markdown>
      </div>
    );
  }
  if (message.experimental_attachments) {
    return (
      <div className="flex flex-row gap-2">
        {message.experimental_attachments.map((attachment) => (
          <PreviewAttachment key={attachment.url} attachment={attachment} />
        ))}
      </div>
    );
  }
  return null;
};

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cn(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          }
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
