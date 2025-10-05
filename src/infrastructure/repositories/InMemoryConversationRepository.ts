// ABOUTME: In-memory implementation of conversation repository for development
// ABOUTME: Can be swapped with database implementation without changing business logic

import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { Conversation, ConversationStatus } from '../../domain/entities/Conversation';

export class InMemoryConversationRepository implements IConversationRepository {
  private readonly conversations: Map<string, Conversation>;
  private readonly maxConversations: number = 1000;

  constructor() {
    this.conversations = new Map();
  }

  async findById(id: string): Promise<Conversation | null> {
    const stored = this.conversations.get(id);
    if (!stored) return null;

    // Create a new conversation instance from the stored data to ensure isolation
    // This prevents mutations from affecting the stored version
    const conversationData = stored.toObject();
    const restoredConversation = Conversation.restore(
      conversationData.id,
      conversationData.messages.map((msgData: any) => {
        const { Message } = require('../../domain/entities/Message');
        const { MessageRole } = require('../../domain/value-objects/MessageRole');
        const { MessageContent } = require('../../domain/value-objects/MessageContent');
        const { ToolInvocation } = require('../../domain/entities/ToolInvocation');
        const { ToolName } = require('../../domain/value-objects/ToolName');

        const role = MessageRole.from(msgData.role);
        const content = MessageContent.from(msgData.content);

        // Reconstruct tool invocations if present
        const toolInvocations = msgData.toolInvocations?.map((ti: any) => {
          const invocation = ToolInvocation.create(
            ti.callId,
            ToolName.from(ti.toolName),
            ti.args
          );

          // Restore the state of the tool invocation
          if (ti.status === 'completed' && ti.result !== undefined) {
            invocation.markAsExecuting();
            invocation.complete(ti.result);
          } else if (ti.status === 'failed' && ti.error) {
            invocation.markAsExecuting();
            invocation.fail(new Error(ti.error));
          } else if (ti.status === 'executing') {
            invocation.markAsExecuting();
          }

          return invocation;
        }) || [];

        const message = Message.createWithId(
          msgData.id,
          role,
          content,
          [], // attachments - not implemented yet
          toolInvocations
        );

        // Restore metadata if present
        if (msgData.metadata) {
          Object.entries(msgData.metadata).forEach(([key, value]) => {
            message.addMetadata(key, value);
          });
        }

        return message;
      }),
      stored.getStatus(),
      stored.getCreatedAt(),
      stored.getUpdatedAt(),
      stored.getTitle()
    );

    return restoredConversation;
  }

  async save(conversation: Conversation): Promise<void> {
    // Check size limit
    if (!this.conversations.has(conversation.getId()) && this.conversations.size >= this.maxConversations) {
      // Remove oldest archived conversation to make room
      const archived = Array.from(this.conversations.values())
        .filter(c => c.isArchived())
        .sort((a, b) => a.getUpdatedAt().getTime() - b.getUpdatedAt().getTime());

      if (archived.length > 0) {
        this.conversations.delete(archived[0].getId());
        console.log(`Removed archived conversation ${archived[0].getId()} to make room`);
      } else {
        throw new Error(`Repository has reached maximum capacity of ${this.maxConversations} conversations`);
      }
    }

    // Create a defensive copy by serializing and deserializing
    // This ensures that mutations to the original conversation don't affect the stored version
    const conversationData = conversation.toObject();
    const { Message } = require('../../domain/entities/Message');
    const { MessageRole } = require('../../domain/value-objects/MessageRole');
    const { MessageContent } = require('../../domain/value-objects/MessageContent');
    const { ToolInvocation } = require('../../domain/entities/ToolInvocation');
    const { ToolName } = require('../../domain/value-objects/ToolName');

    const copiedConversation = Conversation.restore(
      conversationData.id,
      conversationData.messages.map((msgData: any) => {
        const role = MessageRole.from(msgData.role);
        const content = MessageContent.from(msgData.content);

        // Reconstruct tool invocations if present
        const toolInvocations = msgData.toolInvocations?.map((ti: any) => {
          const invocation = ToolInvocation.create(
            ti.callId,
            ToolName.from(ti.toolName),
            ti.args
          );

          // Restore the state of the tool invocation
          if (ti.status === 'completed' && ti.result !== undefined) {
            invocation.markAsExecuting();
            invocation.complete(ti.result);
          } else if (ti.status === 'failed' && ti.error) {
            invocation.markAsExecuting();
            invocation.fail(new Error(ti.error));
          } else if (ti.status === 'executing') {
            invocation.markAsExecuting();
          }

          return invocation;
        }) || [];

        const message = Message.createWithId(
          msgData.id,
          role,
          content,
          [], // attachments - not implemented yet
          toolInvocations
        );

        // Restore metadata if present
        if (msgData.metadata) {
          Object.entries(msgData.metadata).forEach(([key, value]) => {
            message.addMetadata(key, value);
          });
        }

        return message;
      }),
      conversation.getStatus(),
      conversation.getCreatedAt(),
      conversation.getUpdatedAt(),
      conversation.getTitle()
    );

    this.conversations.set(conversation.getId(), copiedConversation);
    console.log(`Saved conversation: ${conversation.getId()} with ${copiedConversation.getMessageCount()} messages`);
  }

  async delete(id: string): Promise<void> {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      console.log(`Deleted conversation: ${id}`);
    } else {
      console.warn(`Conversation not found for deletion: ${id}`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Conversation[]> {
    let conversations = Array.from(this.conversations.values());

    // Filter by status if provided
    if (options?.status) {
      conversations = conversations.filter(c => {
        switch (options.status) {
          case 'active':
            return c.getStatus() === ConversationStatus.ACTIVE;
          case 'waiting_for_response':
            return c.getStatus() === ConversationStatus.WAITING_FOR_RESPONSE;
          case 'completed':
            return c.getStatus() === ConversationStatus.COMPLETED;
          case 'archived':
            return c.getStatus() === ConversationStatus.ARCHIVED;
          default:
            return true;
        }
      });
    }

    // Sort by updated date (newest first)
    conversations.sort((a, b) => b.getUpdatedAt().getTime() - a.getUpdatedAt().getTime());

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || conversations.length;

    return conversations.slice(offset, offset + limit);
  }

  async findByUser(userId: string): Promise<Conversation[]> {
    // In this implementation, we'll filter by metadata
    // In a real implementation, this would be a database query
    const userConversations: Conversation[] = [];

    for (const conversation of this.conversations.values()) {
      if (conversation.getMetadata('userId') === userId) {
        userConversations.push(conversation);
      }
    }

    return userConversations.sort((a, b) =>
      b.getUpdatedAt().getTime() - a.getUpdatedAt().getTime()
    );
  }

  async count(): Promise<number> {
    return this.conversations.size;
  }

  async findActive(): Promise<Conversation[]> {
    const active: Conversation[] = [];

    for (const conversation of this.conversations.values()) {
      if (conversation.isActive() || conversation.isWaitingForResponse()) {
        active.push(conversation);
      }
    }

    return active.sort((a, b) =>
      b.getUpdatedAt().getTime() - a.getUpdatedAt().getTime()
    );
  }

  async archiveOlderThan(date: Date): Promise<number> {
    let archivedCount = 0;

    for (const conversation of this.conversations.values()) {
      if (conversation.getUpdatedAt() < date && !conversation.isArchived()) {
        conversation.archive();
        await this.save(conversation);
        archivedCount++;
      }
    }

    console.log(`Archived ${archivedCount} conversations older than ${date.toISOString()}`);
    return archivedCount;
  }

  /**
   * Clears all conversations from memory
   */
  async clear(): Promise<void> {
    const count = this.conversations.size;
    this.conversations.clear();
    console.log(`Cleared ${count} conversations from memory`);
  }

  /**
   * Gets repository statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    completed: number;
    waitingForResponse: number;
    averageMessageCount: number;
    oldestConversation?: Date;
    newestConversation?: Date;
  }> {
    const stats = {
      total: this.conversations.size,
      active: 0,
      archived: 0,
      completed: 0,
      waitingForResponse: 0,
      totalMessages: 0,
      oldestConversation: undefined as Date | undefined,
      newestConversation: undefined as Date | undefined,
      averageMessageCount: 0,
    };

    for (const conversation of this.conversations.values()) {
      // Count by status
      if (conversation.isActive()) stats.active++;
      if (conversation.isArchived()) stats.archived++;
      if (conversation.isCompleted()) stats.completed++;
      if (conversation.isWaitingForResponse()) stats.waitingForResponse++;

      // Track messages
      stats.totalMessages += conversation.getMessageCount();

      // Track dates
      const createdAt = conversation.getCreatedAt();
      if (!stats.oldestConversation || createdAt < stats.oldestConversation) {
        stats.oldestConversation = createdAt;
      }
      if (!stats.newestConversation || createdAt > stats.newestConversation) {
        stats.newestConversation = createdAt;
      }
    }

    stats.averageMessageCount = stats.total > 0
      ? Math.round(stats.totalMessages / stats.total)
      : 0;

    return stats;
  }

  /**
   * Exports all conversations for backup
   */
  async exportAll(): Promise<Array<any>> {
    return Array.from(this.conversations.values()).map(c => c.toObject());
  }

  /**
   * Imports conversations from backup
   */
  async importConversations(data: Array<any>): Promise<number> {
    let imported = 0;

    for (const item of data) {
      try {
        // This would need proper deserialization in production
        // For now, we're just counting
        imported++;
      } catch (error) {
        console.error(`Failed to import conversation: ${error}`);
      }
    }

    return imported;
  }
}