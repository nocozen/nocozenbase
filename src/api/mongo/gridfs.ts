/**
 * GridFS Storage Service
 * 
 * This module provides an interface to MongoDB GridFS for storing and retrieving large files.
 * It implements a singleton pattern to ensure only one instance of GridFsStorage is created.
 */

import { MongoClient, GridFSBucket, ObjectId } from "mongodb";
import { getBucketDBname, getGFSDBname } from "../../router/coreApi.js";

/**
 * Interface for file metadata
 */
export interface FileMetadata {
  [key: string]: any;
}

/**
 * GridFsStorage class for handling file operations using MongoDB GridFS
 */
export class GridFsStorage {
  /**
   * Singleton instance of GridFsStorage
   */
  private static instance: GridFsStorage;
  
  /**
   * GridFSBucket instance for actual file operations
   */
  public bucket: GridFSBucket;

  /**
   * Constructor for GridFsStorage class
   * @param client - MongoDB client instance
   * @throws Error if MongoClient instance is not provided
   */
  constructor(client: MongoClient) {
    if (!client) {
      throw new Error("MongoClient instance is required");
    }
    const dbName = getGFSDBname();
    const bucketName = getBucketDBname();
    this.bucket = new GridFSBucket(client.db(dbName), { bucketName });
  }

  /**
   * Get singleton instance of GridFsStorage
   * @param client - MongoDB client instance
   * @returns Singleton instance of GridFsStorage
   */
  public static getInstance(client: MongoClient): GridFsStorage {
    if (GridFsStorage.instance) {
      return GridFsStorage.instance;
    }
    GridFsStorage.instance = new GridFsStorage(client);
    return GridFsStorage.instance;
  }

  /**
   * Write a file to GridFS
   * @param filename - Name of the file to write
   * @param data - Buffer containing file data
   * @returns Promise that resolves to the file ID as string
   */
  public async writeFile(filename: string, data: Buffer): Promise<string> {
    const uploadStream = this.bucket.openUploadStream(filename);
    return new Promise((resolve, reject) => {
      uploadStream.once("finish", () => {
        const fileId = uploadStream.id;
        resolve(fileId.toString());
      });
      uploadStream.once("error", reject);
      uploadStream.end(data);
    });
  }

  /**
   * Read a file from GridFS
   * @param fileId - ObjectId of the file to read
   * @returns Promise that resolves to Buffer containing file data
   * @throws Error if fileId is not provided
   */
  async readFile(fileId: ObjectId): Promise<Buffer> {
    if (!fileId) {
      throw new Error("File ID is required");
    }
    const downloadStream = this.bucket.openDownloadStream(fileId);
    return new Promise((resolve, reject) => {
      let chunks: Uint8Array[] = [];
      downloadStream.on("data", (chunk) => chunks.push(chunk));
      downloadStream.on("end", () => resolve(Buffer.concat(chunks)));
      downloadStream.on("error", reject);
    });
  }

  /**
   * Open an upload stream to GridFS
   * @param filename - Name of the file to upload
   * @param meta - Optional metadata for the file
   * @returns GridFS upload stream
   */
  async openUploadStream(filename: string, meta: FileMetadata) {
    const metadata = meta ? { metadata: meta } : {};
    const uploadStream = this.bucket.openUploadStream(filename, metadata);
    return uploadStream;
  }
  
  /**
   * Open a download stream from GridFS
   * @param fileId - ObjectId of the file to download
   * @returns GridFS download stream
   */
  openDownloadStream(fileId: ObjectId) {
    const downloadStream = this.bucket.openDownloadStream(fileId);
    return downloadStream;
  }

  /**
   * Delete a file from GridFS
   * @param fileId - ObjectId of the file to delete
   * @returns Promise that resolves when deletion is complete
   */
  async deleteFile(fileId: ObjectId): Promise<void> {
    return this.bucket.delete(fileId);
  }
}