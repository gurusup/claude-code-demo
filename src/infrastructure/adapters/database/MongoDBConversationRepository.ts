// ABOUTME: MongoDB implementation of the conversation repository interface.
// ABOUTME: Handles persistence with projection optimization and error handling.

import { Collection, Db } from "mongodb";
import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { Conversation, ConversationStatus } from "@/domain/entities/Conversation";
import { ConversationDocumentMapper } from "./mappers/ConversationDocumentMapper";
import { ConversationDocument } from "./types/ConversationDocument";

export class MongoDBConversationRepository implements IConversationRepository {
  private readonly collection: Collection<ConversationDocument>;
  private indexesCreated = false;

  constructor(db: Db) {
    this.collection = db.collection<ConversationDocument>("conversations");
  }

  async initialize(): Promise<void> {
    if (this.indexesCreated) return;

    try {
      await this.createIndexes();
      this.indexesCreated = true;
      console.log("[MongoDBConversationRepository] Indexes created successfully");
    } catch (error) {
      console.error("[MongoDBConversationRepository] Failed to create indexes:", error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    await this.collection.createIndex({ updatedAt: -1 });
    await this.collection.createIndex({ status: 1, updatedAt: -1 });
    await this.collection.createIndex({ userId: 1, updatedAt: -1 }, { sparse: true });
  }

  async findById(id: string): Promise<Conversation | null> {
    try {
      const document = await this.collection.findOne({ _id: id });

      if (!document) {
        return null;
      }

      return ConversationDocumentMapper.toEntity(document);
    } catch (error) {
      console.error(`[MongoDBConversationRepository] Error finding conversation ${id}:`, error);
      throw new Error(`Failed to find conversation: ${(error as Error).message}`);
    }
  }

  async save(conversation: Conversation): Promise<void> {
    try {
      const document = ConversationDocumentMapper.toDocument(conversation);

      await this.collection.replaceOne(
        { _id: document._id },
        document,
        { upsert: true }
      );

      console.log(`[MongoDBConversationRepository] Saved conversation ${conversation.getId()}`);
    } catch (error) {
      console.error(`[MongoDBConversationRepository] Error saving conversation:`, error);
      throw new Error(`Failed to save conversation: ${(error as Error).message}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.collection.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        console.warn(`[MongoDBConversationRepository] Conversation ${id} not found for deletion`);
      } else {
        console.log(`[MongoDBConversationRepository] Deleted conversation ${id}`);
      }
    } catch (error) {
      console.error(`[MongoDBConversationRepository] Error deleting conversation ${id}:`, error);
      throw new Error(`Failed to delete conversation: ${(error as Error).message}`);
    }
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Conversation[]> {
    try {
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      const filter: any = {};
      if (options?.status) {
        filter.status = options.status;
      }

      // Use projection to exclude messages for list queries (optimization)
      const cursor = this.collection
        .find(filter)
        .project({ messages: 0 })
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit);

      const documents = await cursor.toArray();

      // For conversations without messages (from projection), we'll create minimal entities
      return documents.map((doc) => {
        // Add empty messages array for mapping (projection excluded messages)
        const docWithMessages: ConversationDocument = {
          _id: doc._id,
          title: doc.title,
          status: doc.status,
          messages: [],
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          userId: doc.userId,
        };
        return ConversationDocumentMapper.toEntity(docWithMessages);
      });
    } catch (error) {
      console.error("[MongoDBConversationRepository] Error finding all conversations:", error);
      throw new Error(`Failed to find conversations: ${(error as Error).message}`);
    }
  }

  async count(): Promise<number> {
    try {
      return await this.collection.countDocuments();
    } catch (error) {
      console.error("[MongoDBConversationRepository] Error counting conversations:", error);
      throw new Error(`Failed to count conversations: ${(error as Error).message}`);
    }
  }

  async findActive(): Promise<Conversation[]> {
    try {
      const documents = await this.collection
        .find({
          status: {
            $in: [
              ConversationStatus.ACTIVE,
              ConversationStatus.WAITING_FOR_RESPONSE,
            ],
          },
        })
        .sort({ updatedAt: -1 })
        .toArray();

      return documents.map((doc) =>
        ConversationDocumentMapper.toEntity(doc)
      );
    } catch (error) {
      console.error("[MongoDBConversationRepository] Error finding active conversations:", error);
      throw new Error(`Failed to find active conversations: ${(error as Error).message}`);
    }
  }

  async findByUser(userId: string): Promise<Conversation[]> {
    try {
      const documents = await this.collection
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();

      return documents.map((doc) =>
        ConversationDocumentMapper.toEntity(doc)
      );
    } catch (error) {
      console.error(`[MongoDBConversationRepository] Error finding conversations for user ${userId}:`, error);
      throw new Error(`Failed to find conversations for user: ${(error as Error).message}`);
    }
  }

  async archiveOlderThan(date: Date): Promise<number> {
    try {
      const result = await this.collection.updateMany(
        {
          updatedAt: { $lt: date },
          status: { $ne: ConversationStatus.ARCHIVED },
        },
        {
          $set: {
            status: ConversationStatus.ARCHIVED,
            updatedAt: new Date(),
          },
        }
      );

      console.log(`[MongoDBConversationRepository] Archived ${result.modifiedCount} conversations`);
      return result.modifiedCount;
    } catch (error) {
      console.error("[MongoDBConversationRepository] Error archiving conversations:", error);
      throw new Error(`Failed to archive conversations: ${(error as Error).message}`);
    }
  }
}
