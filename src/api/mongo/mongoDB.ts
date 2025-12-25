/**
 * MongoDB Database Interface Implementation
 * 
 * This file provides a singleton implementation of the DBI interface for MongoDB,
 * offering connection management, transaction support, and a comprehensive set
 * of database operations with automatic ObjectId and ISO date handling.
 */
import {
  AnyBulkWriteOperation,
  BulkWriteResult,
  DeleteResult,
  InsertManyResult,
  InsertOneResult,
  MongoClient,
  ObjectId,
  Db,
  MongoClientOptions,
  Collection,
  ClientSession,
  TransactionOptions,
} from "mongodb";
import config from "../../utils/config.js";
import dayjs from "dayjs";
import { logger } from "../../utils/logger.js";
import { MetaPrefix } from "../../types/enum.js";

/**
 * Database Interface (DBI)
 * 
 * Defines the standard operations that must be implemented by any database adapter.
 * This interface provides a consistent API for database operations across different
 * database systems.
 */
interface DBI {
  /**
   * Perform multiple write operations in bulk.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param operations Array of write operations to perform
   * @param options Additional options for the operation
   * @returns Promise resolving to the bulk write result
   */
  bulkWrite(
    dbname: string,
    collectionName: string,
    operations: readonly AnyBulkWriteOperation[],
    options: object
  ): Promise<BulkWriteResult>;
  
  /**
   * Get distinct values for a specified field across a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param field Field name to get distinct values for
   * @param filter Query filter to apply
   * @param options Additional options for the operation
   * @returns Promise resolving to an array of distinct values
   */
  distinct(
    dbname: string,
    collectionName: string,
    field: string,
    filter: object,
    options: object
  ): Promise<any[]>;
  
  /**
   * Count the number of documents matching a filter.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to apply
   * @param options Additional options for the operation
   * @returns Promise resolving to the count of matching documents
   */
  count(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<number>;
  
  /**
   * Insert a single document into a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param doc Document to insert
   * @param options Additional options for the operation
   * @returns Promise resolving to the insert result
   */
  insertOne(
    dbname: string,
    collectionName: string,
    doc: any,
    options: object
  ): Promise<InsertOneResult<Document>>;
  
  /**
   * Insert multiple documents into a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param docs Array of documents to insert
   * @param options Additional options for the operation
   * @returns Promise resolving to the insert result
   */
  insertMany(
    dbname: string,
    collectionName: string,
    docs: any[],
    options: object
  ): Promise<InsertManyResult<Document>>;
  
  /**
   * Delete a single document from a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify the document
   * @param options Additional options for the operation
   * @returns Promise resolving to the delete result
   */
  deleteOne(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<DeleteResult>;
  
  /**
   * Delete multiple documents from a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify documents
   * @param options Additional options for the operation
   * @returns Promise resolving to the delete result
   */
  deleteMany(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<DeleteResult>;
  
  /**
   * Update a single document in a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify the document
   * @param update Update operations to apply
   * @param options Additional options for the operation
   * @returns Promise resolving to true if a document was modified
   */
  updateOne(
    dbname: string,
    collectionName: string,
    filter: object,
    update: object,
    options: object
  ): Promise<boolean>;
  
  /**
   * Update multiple documents in a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify documents
   * @param update Update operations to apply
   * @param options Additional options for the operation
   * @returns Promise resolving to true if documents were modified
   */
  update(
    dbname: string,
    collectionName: string,
    filter: object,
    update: object,
    options: object
  ): Promise<boolean>;
  
  /**
   * Find a document and update it in one operation.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify the document
   * @param update Update operations to apply
   * @param options Additional options for the operation
   * @returns Promise resolving to the updated document
   */
  findOneAndUpdate(
    dbname: string,
    collectionName: string,
    filter: object,
    update: any,
    options: object
  ): Promise<any>;
  
  /**
   * Find a single document in a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify the document
   * @param options Additional options for the operation
   * @returns Promise resolving to the found document or null
   */
  findOne(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<any>;
  
  /**
   * Find multiple documents in a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param filter Query filter to identify documents
   * @param options Additional options for the operation
   * @returns Promise resolving to an array of found documents
   */
  find(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<any[]>;
  
  /**
   * Perform an aggregation pipeline on a collection.
   * @param dbname Name of the database
   * @param collectionName Name of the collection
   * @param pipeline Array of aggregation stages
   * @returns Promise resolving to the aggregation results
   */
  aggregate(
    dbname: string,
    collectionName: string,
    pipeline: object[]
  ): Promise<any[]>;
  
  /**
   * List collections in a database.
   * @param dbname Name of the database
   * @param filter Query filter to apply to collections
   * @param options Additional options for the operation
   * @returns Promise resolving to an array of collection objects
   */
  getCollections(
    dbname: string,
    filter: object,
    options: object
  ): Promise<any[]>;
}

/**
 * Connection Pool Metrics Interface
 * 
 * Defines the structure for MongoDB connection pool statistics.
 */
interface ConnectionPoolMetrics {
  currentSize: number;  // Current number of connections in the pool
  available: number;    // Number of available connections in the pool
  waiting: number;      // Number of requests waiting for a connection
  maxSize: number;      // Maximum allowed size of the connection pool
}

/**
 * MongoDB Database Adapter
 * 
 * Implements the DBI interface using MongoDB with a singleton pattern.
 * Provides connection management, transaction support, and automatic
 * conversion of dates and ObjectIds.
 */
class Mongo implements DBI {
  private static instance: Mongo;  // Singleton instance
  private client: MongoClient | null = null;  // MongoDB client instance
  private db: Db | null = null;  // Current database instance
  private connectionPromise: Promise<void> | null = null;  // Connection initialization promise

  /**
   * Private constructor to enforce singleton pattern.
   * @param uri MongoDB connection URI
   * @param options MongoDB client options
   */
  private constructor(
    private readonly uri: string,
    private readonly options: MongoClientOptions = {}
  ) {}

  /**
   * Get the singleton instance of the Mongo class.
   * @returns Promise resolving to the Mongo instance
   */
  public static async getInstance(): Promise<Mongo> {
    if (!Mongo.instance) {
      const defaultOptions: MongoClientOptions = {
        maxPoolSize: 100,
        minPoolSize: 10,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        waitQueueTimeoutMS: 10000,
        retryReads: true,
        retryWrites: true,
      };
      const dbConfig = config.mongo;
      const username = encodeURIComponent(dbConfig.userName);
      const password = encodeURIComponent(dbConfig.passWord);
      const currUri = `mongodb://${username}:${password}@${dbConfig.ip}:${dbConfig.port}`;
      Mongo.instance = new Mongo(currUri, defaultOptions);
      await Mongo.instance.connect();
    }
    return Mongo.instance;
  }

  /**
   * Connect to MongoDB.
   * @returns Promise resolving when connection is established
   */
  private async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        this.client = new MongoClient(this.uri, this.options);
        await this.client.connect();
        const dbConfig = config.mongo;
        this.db = this.client.db(dbConfig.mainDb);
        logger.info("Mongo connected successfully");
      } catch (error: any) {
        logger.error("Mongo connection failed:", error);
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Get connection pool metrics.
   * @returns Promise resolving to connection pool statistics
   */
  public async getPoolMetrics(): Promise<ConnectionPoolMetrics> {
    if (!this.client) {
      logger.error("Mongo not connected");
      throw new Error("Mongo not connected");
    }

    try {
      const serverStatus = await this.db?.admin().serverStatus();
      const connections = serverStatus?.connections || {};

      return {
        currentSize: connections.current || 0,
        available: connections.available || 0,
        waiting: 0,  // MongoDB doesn't expose waiting connections through serverStatus
        maxSize: this.options.maxPoolSize || 100,
      };
    } catch (error: any) {
      logger.error("Failed to get pool metrics:", error);
      return {
        currentSize: 0,
        available: 0,
        waiting: 0,
        maxSize: this.options.maxPoolSize || 100,
      };
    }
  }

  /**
   * Get the current database instance.
   * @returns Database instance
   */
  public getDatabase(): Db {
    if (!this.db) {
      logger.error("db undefined");
      throw new Error("db undefined");
    }
    return this.db;
  }

  /**
   * Get the MongoDB client instance.
   * @returns MongoClient instance
   */
  public getClient(): MongoClient {
    if (!this.client) {
      throw new Error("MongoDB client not connected");
    }
    return this.client;
  }

  /**
   * Get a collection from the current database.
   * @param collectionName Name of the collection
   * @returns Collection instance
   */
  public getCollection<T extends Document>(
    collectionName: string
  ): Collection<T> {
    return this.getDatabase().collection<T>(collectionName);
  }

  /**
   * Execute operations within a transaction.
   * @param callback Function to execute within the transaction
   * @param options Transaction options
   * @returns Promise resolving to the result of the callback
   */
  public async withTransaction<T>(
    callback: (session: ClientSession) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    if (!this.client) {
      throw new Error("Mongo not connected");
    }

    const session = this.client.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await callback(session);
      }, options);
      return result!;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Close the MongoDB connection and reset the singleton instance.
   * @returns Promise resolving when connection is closed
   */
  public async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connectionPromise = null;
      Mongo.instance = null!;
      logger.info("Mongo connection closed");
    }
  }

  // DBI interface implementation

  /**
   * Perform bulk write operations.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param operations Array of write operations
   * @param options Additional options
   * @returns Promise resolving to bulk write result
   */
  async bulkWrite(
    dbname: string,
    collectionName: string,
    operations: readonly AnyBulkWriteOperation[],
    options: object
  ): Promise<BulkWriteResult> {
    return await this.client!.db(dbname)
      .collection(collectionName)
      .bulkWrite(operations, options);
  }

  /**
   * Count documents matching a filter.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param options Additional options
   * @returns Promise resolving to document count
   */
  async count(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<number> {
    this.wrapObjectId(filter);
    return await this.client!.db(dbname)
      .collection(collectionName)
      .countDocuments(filter, options);
  }

  /**
   * Get distinct values for a field.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param field Field name
   * @param filter Query filter
   * @param options Additional options
   * @returns Promise resolving to array of distinct values
   */
  async distinct(
    dbname: string,
    collectionName: string,
    field: string,
    filter: object,
    options: object
  ): Promise<any[]> {
    this.wrapObjectId(filter);
    return await this.client!.db(dbname)
      .collection(collectionName)
      .distinct(field, filter, options);
  }

  /**
   * Find and update a single document.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param update Update operations
   * @param options Additional options
   * @returns Promise resolving to updated document
   */
  async findOneAndUpdate(
    dbname: string,
    collectionName: string,
    filter: object,
    update: any,
    options: object
  ): Promise<any> {
    this.wrapObjectId(filter);
    return await this.client!.db(dbname)
      .collection(collectionName)
      .findOneAndUpdate(filter, update, options);
  }

  /**
   * Find a single document.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param options Additional options
   * @returns Promise resolving to found document
   */
  async findOne(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<any> {
    this.wrapObjectId(filter);
    return await this.client!.db(dbname)
      .collection(collectionName)
      .findOne(filter, options);
  }

  /**
   * Find multiple documents.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param options Additional options (sort, skip, limit, projection)
   * @returns Promise resolving to array of found documents
   */
  async find(
    dbname: string,
    collectionName: string,
    filter: object,
    options: any
  ): Promise<any[]> {
    this.wrapObjectId(filter);
    let query = this.client!.db(dbname)
      .collection(collectionName)
      .find(filter);
    if (options?.sort) query = query.sort(options.sort);
    if (options?.skip !== undefined) query = query.skip(options.skip);
    if (options?.limit !== undefined) query = query.limit(options.limit);
    if (options?.projection) query = query.project(options.projection);

    return query.toArray();
  }

  /**
   * Insert a single document.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param doc Document to insert
   * @param options Additional options
   * @returns Promise resolving to insert result
   */
  async insertOne(
    dbname: string,
    collectionName: string,
    doc: any,
    options: object
  ): Promise<InsertOneResult<Document>> {
    this.wrapISODate(doc);
    const result = await this.client!.db(dbname)
      .collection(collectionName)
      .insertOne(doc, options);
    return result;
  }

  /**
   * Insert multiple documents.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param docs Array of documents to insert
   * @param options Additional options
   * @returns Promise resolving to insert result
   */
  async insertMany(
    dbname: string,
    collectionName: string,
    docs: any[],
    options: object
  ): Promise<InsertManyResult<Document>> {
    this.wrapISODate(docs);
    const result = await this.client!.db(dbname)
      .collection(collectionName)
      .insertMany(docs, options);
    return result;
  }

  /**
   * Delete a single document.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param options Additional options
   * @returns Promise resolving to delete result
   */
  async deleteOne(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<DeleteResult> {
    this.wrapObjectId(filter);
    const result = await this.client!.db(dbname)
      .collection(collectionName)
      .deleteOne(filter, options);
    return result;
  }

  /**
   * Delete multiple documents.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param options Additional options
   * @returns Promise resolving to delete result
   */
  async deleteMany(
    dbname: string,
    collectionName: string,
    filter: object,
    options: object
  ): Promise<DeleteResult> {
    this.wrapObjectId(filter);
    const result = await this.client!.db(dbname)
      .collection(collectionName)
      .deleteMany(filter, options);
    return result;
  }

  /**
   * Update a single document.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param update Update operations
   * @param options Additional options
   * @returns Promise resolving to true if document was modified
   */
  async updateOne(
    dbname: string,
    collectionName: string,
    filter: object,
    update: object,
    options: object
  ): Promise<boolean> {
    this.wrapObjectId(filter);
    this.wrapISODate(update);
    const result = await this.client!.db(dbname)
      .collection(collectionName)
      .updateOne(filter, update, options);
    return result.modifiedCount >= 0; // =0如何处理交给业务方法
  }

  /**
   * Update multiple documents.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param filter Query filter
   * @param update Update operations
   * @param options Additional options
   * @returns Promise resolving to true if documents were modified
   */
  async update(
    dbname: string,
    collectionName: string,
    filter: object,
    update: object,
    options: object
  ): Promise<boolean> {
    this.wrapObjectId(filter);
    this.wrapISODate(update);
    const result = await this.client!.db(dbname)
      .collection(collectionName)
      .updateMany(filter, update, options);
    return result.modifiedCount >= 0;   // =0如何处理交给业务方法
  }

  /**
   * Perform aggregation pipeline.
   * @param dbname Database name
   * @param collectionName Collection name
   * @param pipeline Array of aggregation stages
   * @returns Promise resolving to aggregation results
   */
  async aggregate(
    dbname: string,
    collectionName: string,
    pipeline: object[]
  ): Promise<any[]> {
    if (pipeline && pipeline.length > 0 && "$match" in pipeline[0]) {
      this.wrapObjectId(pipeline[0]["$match"]);
      this.wrapISODate(pipeline[0]["$match"]);
    }
    return await this.client!.db(dbname)
      .collection(collectionName)
      .aggregate(pipeline)
      .toArray();
  }

  /**
   * List collections in a database.
   * @param dbname Database name
   * @param filter Query filter
   * @param options Additional options
   * @returns Promise resolving to array of collection objects
   */
  async getCollections(
    dbname: string,
    filter: object,
    options: object
  ): Promise<any[]> {
    return await this.client!.db(dbname)
      .listCollections(filter, options)
      .toArray();
  }

  /**
   * Convert ISO date strings to Date objects.
   * @param expression Object or array containing date fields
   */
  wrapISODate(expression: any) {
    const opts = ["$gt", "$gte", "$lt", "$lte", "$set"];
    const dataFields = ["createAt", "updateAt"];
    if (Array.isArray(expression)) {
      expression.forEach((exp: any) => this.wrapISODate(exp));
    } else {
      for (let key in expression) {
        if (typeof expression[key] == "object") {
          this.wrapISODate(expression[key]);
        }
        if (key.startsWith(MetaPrefix.FeDatetime) || dataFields.includes(key)) {
          if (dayjs(expression[key]).isValid()) {
            expression[key] = new Date(expression[key]);
          }
        }
        if (opts.includes(key) && typeof expression[key] == "string") {
          if (dayjs(expression[key]).isValid()) {
            expression[key] = new Date(expression[key]);
          }
        }
      }
    }
  }

  /**
   * Convert string IDs to ObjectId instances.
   * @param option Object containing _id fields
   */
  wrapObjectId(option: any) {
    if (option) {
      if ("_id" in option) {
        if (typeof option._id == "string") {
          let _id: string = option._id;
          option._id = new ObjectId(_id);
        } else if (Array.isArray(option._id)) {
          let newIds = [] as any;
          for (let id of option._id) {
            let _id: string = id;
            newIds.push(new ObjectId(_id));
          }
          option._id = { $in: newIds };
        }
      }
    }
  }
}

export default Mongo;