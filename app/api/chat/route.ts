// ABOUTME: Next.js API route for streaming chat completions with OpenAI
// ABOUTME: Implements tool calling and Vercel's Data Stream Protocol v1

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { convertToOpenAIMessages } from '@/app/utils/prompt';
import { getCurrentWeather } from '@/app/utils/tools';
import { ClientMessage } from '@/app/utils/types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Available tools mapping
const availableTools = {
  get_current_weather: getCurrentWeather,
};

// Tool definition for OpenAI
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_weather',
      description: 'Get the current weather at a location',
      parameters: {
        type: 'object',
        properties: {
          latitude: {
            type: 'number',
            description: 'The latitude of the location',
          },
          longitude: {
            type: 'number',
            description: 'The longitude of the location',
          },
        },
        required: ['latitude', 'longitude'],
      },
    },
  },
];

interface RequestBody {
  messages: ClientMessage[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { messages } = body;

    // Convert client messages to OpenAI format
    const openaiMessages = convertToOpenAIMessages(messages);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const draftToolCalls: any[] = [];
        let draftToolCallsIndex = -1;

        try {
          // Create OpenAI stream
          const openaiStream = await openai.chat.completions.create({
            messages: openaiMessages,
            model: 'gpt-4o',
            stream: true,
            tools: tools,
          });

          // Process stream chunks
          for await (const chunk of openaiStream) {
            for (const choice of chunk.choices) {
              if (choice.finish_reason === 'stop') {
                continue;
              } else if (choice.finish_reason === 'tool_calls') {
                // Send tool call information
                for (const toolCall of draftToolCalls) {
                  const toolCallMessage = `9:{"toolCallId":"${toolCall.id}","toolName":"${toolCall.name}","args":${toolCall.arguments}}\n`;
                  controller.enqueue(encoder.encode(toolCallMessage));
                }

                // Execute tool calls and send results
                for (const toolCall of draftToolCalls) {
                  const toolFunction = availableTools[toolCall.name as keyof typeof availableTools];
                  if (toolFunction) {
                    const args = JSON.parse(toolCall.arguments);
                    const result = await toolFunction(args.latitude, args.longitude);

                    const toolResultMessage = `a:{"toolCallId":"${toolCall.id}","toolName":"${toolCall.name}","args":${toolCall.arguments},"result":${JSON.stringify(result)}}\n`;
                    controller.enqueue(encoder.encode(toolResultMessage));
                  }
                }
              } else if (choice.delta.tool_calls) {
                // Accumulate tool call information
                for (const toolCall of choice.delta.tool_calls) {
                  const id = toolCall.id;
                  const name = toolCall.function?.name;
                  const args = toolCall.function?.arguments;

                  if (id !== undefined) {
                    draftToolCallsIndex++;
                    draftToolCalls.push({
                      id: id,
                      name: name || '',
                      arguments: '',
                    });
                  } else if (args !== undefined) {
                    draftToolCalls[draftToolCallsIndex].arguments += args;
                  }
                }
              } else {
                // Stream text content
                const content = choice.delta.content;
                if (content) {
                  const textMessage = `0:${JSON.stringify(content)}\n`;
                  controller.enqueue(encoder.encode(textMessage));
                }
              }
            }

            // Handle usage information
            if (chunk.choices.length === 0 && chunk.usage) {
              const finishMessage = `e:{"finishReason":"${draftToolCalls.length > 0 ? 'tool-calls' : 'stop'}","usage":{"promptTokens":${chunk.usage.prompt_tokens},"completionTokens":${chunk.usage.completion_tokens}},"isContinued":false}\n`;
              controller.enqueue(encoder.encode(finishMessage));
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    // Return streaming response with proper headers
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-vercel-ai-data-stream': 'v1',
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}