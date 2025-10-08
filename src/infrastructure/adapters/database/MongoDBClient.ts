// ABOUTME: Singleton MongoDB client with connection pooling and health monitoring.
// ABOUTME: Handles retry logic, connection lifecycle, and provides database access.

import { MongoClient, Db, MongoClientOptions } from "mongodb";

export class MongoDBClient {
  private static instance: MongoDBClient | null = null;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectionPromise: Promise<void> | null = null;

  private constructor(
    private readonly url: string,
    private readonly databaseName: string
  ) {}

  public static getInstance(url: string, databaseName: string): MongoDBClient {
    if (!MongoDBClient.instance) {
      MongoDBClient.instance = new MongoDBClient(url, databaseName);
    }
    return MongoDBClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  private async establishConnection(): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[MongoDB] Connecting to database (attempt ${attempt}/${maxRetries})...`);

        const options: MongoClientOptions = {
          maxPoolSize: 10,
          minPoolSize: 2,
          maxIdleTimeMS: 60000,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        };

        this.client = new MongoClient(this.url, options);
        await this.client.connect();
        this.db = this.client.db(this.databaseName);

        await this.db.command({ ping: 1 });
        console.log("[MongoDB] Successfully connected to database");

        this.setupEventListeners();
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`[MongoDB] Connection attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[MongoDB] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to connect to MongoDB after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on("connectionPoolCreated", () => {
      console.log("[MongoDB] Connection pool created");
    });

    this.client.on("connectionPoolClosed", () => {
      console.log("[MongoDB] Connection pool closed");
    });

    this.client.on("error", (error) => {
      console.error("[MongoDB] Client error:", error);
    });
  }

  public getDatabase(): Db {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  public async healthCheck(): Promise<{ healthy: boolean; latency?: number }> {
    if (!this.db) {
      return { healthy: false };
    }

    try {
      const start = Date.now();
      await this.db.command({ ping: 1 });
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      console.error("[MongoDB] Health check failed:", error);
      return { healthy: false };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      console.log("[MongoDB] Disconnecting from database...");
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connectionPromise = null;
      console.log("[MongoDB] Disconnected from database");
    }
  }

  public static async resetInstance(): Promise<void> {
    if (MongoDBClient.instance) {
      await MongoDBClient.instance.disconnect();
      MongoDBClient.instance = null;
    }
  }
}
