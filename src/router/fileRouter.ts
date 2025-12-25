/**
 * This file implements the File Management API router for the NocoZenBase application.
 * It provides endpoints for file upload, download, metadata retrieval, and deletion operations.
 * The router uses HyperExpress framework and integrates with MongoDB GridFS for file storage.
 */
import HyperExpress from "hyper-express";
import config from '../utils/config.js';
import fs from 'fs';
import { GridFsStorage } from "../api/mongo/gridfs.js";
import { ObjectId } from "mongodb";
import { logger } from "../utils/logger.js";
import { WebPath } from "../types/enum.js";
import { isEmpty } from "radashi";
import { Readable } from 'stream';
import type { Request, Response } from 'hyper-express';
import { LRUCache } from 'lru-cache';
import Mongo from "../api/mongo/mongoDB.js";

// File download is handled differently based on size; small files are not chunked.
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB threshold, can be adjusted
const fileCache = new LRUCache<string, Buffer>({
  max: 1000, // Maximum 1000 cache entries (optional)
  maxSize: 500 * 1024 * 1024, // Maximum total cache size 500MB
  sizeCalculation: (buf) => buf.length, // Calculate bytes occupied by each Buffer
  ttl: 1000 * 60 * 60, // TTL: 1 hour
  updateAgeOnGet: true, // Refresh TTL on access
});

const imageBasePath = config.path.imageBase;  // Image root path
const apiRoot = config.http.apiRoot; // Read from configuration file
const fileRouter = new HyperExpress.Router();

fileRouter.post(apiRoot + '/upload/:path', upload);
fileRouter.post(apiRoot + WebPath.UploadGfs, { max_body_length: 100 * 1024 * 1024 }, uploadGfs);
fileRouter.post(apiRoot + '/getFile/:id', getFile);
fileRouter.post(apiRoot + WebPath.GetFileMeta, getFileMeta);
fileRouter.post(apiRoot + '/removeFile/:id', removeFile);

/**
 * Upload a file to the filesystem.
 * @param {HyperExpress.Request} request - The request object containing file data
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with upload count and status message
 */
async function upload(request, response) {
  let msg: string = "ok";
  let count: number = 0;
  let path = request.path_parameters.path;
  // Begin parsing this request as a multipart request
  let savePath = imageBasePath;
  savePath = imageBasePath.replace(/\/$/, "") + `/${path}/`;
  try {
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }
    await request.multipart(async (field) => {
      if (field.file) {
        request.setEncoding('utf-8');
        // "latin1" = "ISO-8859-1"
        let originalFileName = Buffer.from(field.file.name, "latin1").toString("utf8");
        savePath = savePath + originalFileName;

        count++;
      }
    });
  } catch (e) {
    msg = "upload:" + e;
    logger.error(msg);
  }

  await response.json({
    count: count,
    msg: msg
  })
}

/**
 * Upload a file to MongoDB GridFS storage.
 * @param {HyperExpress.Request} request - The request object containing file data and metadata
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with upload count, file ID, and status message
 */
async function uploadGfs(request, response) {
  let msg: string = "ok";
  let count: number = 0;
  let _id: string = '';
  try {
    const ins = await Mongo.getInstance();
    const storage = GridFsStorage.getInstance(ins.getClient());
    let files = {};
    // [f1.metaId, f1.checkCode, f1.aliasName, f1.contentType, f1.file]
    await request.multipart(async (field) => {
      let names = field.name.split(".");
      if (names[1] != 'file') {
        if (names[0] in files) {
          files[names[0]][names[1]] = field.value;
        } else {
          files[names[0]] = { [names[1]]: field.value };
        }
      } else if (field.file) {
        let originalFileName = Buffer.from(field.file.name, "latin1").toString("utf8");
        const writeStream = await storage.openUploadStream(originalFileName, files[names[0]]);
        field.file.stream.pipe(writeStream);
        _id = writeStream.id.toString();
        count++;
      }
    });
  } catch (e) {
    msg = "uploadGfs:" + e;
    logger.error(msg);
  }

  await response.json({
    data: {
      count,
      _id
    },
    msg: msg
  })
}

/**
 * Retrieve file metadata based on filters.
 * @param {HyperExpress.Request} request - The request object containing metadata filter parameters
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with file metadata array and status message
 */
async function getFileMeta(request, response) {
  let reqparam = await request.qbJson();
  let msg: string = "ok";
  let fileInfo = [] as any;
  const metaId = reqparam.metaId;
  const gfsId = reqparam.gfsId;

  try {
    const ins = await Mongo.getInstance();
    const storage = GridFsStorage.getInstance(ins.getClient());
    let filter = {} as any;
    if (metaId) {
      filter['metadata.metaId'] = { $exists: true, $eq: String(metaId) };
    };
    if (gfsId) {
      const objectIds = Array.isArray(gfsId) ? gfsId.map(id => new ObjectId(id as string))
        : [new ObjectId(gfsId as string)];

      filter['_id'] = { $in: objectIds };
    };
    if (isEmpty(filter)) {
      throw new Error("Filter conditions cannot be empty")
    }
    fileInfo = await storage.bucket.find(filter).toArray();
  } catch (e) {
    msg = "getFileMeta:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: fileInfo,
    msg: msg
  })
}

/**
 * Retrieve file metadata by check code.
 * @param {HyperExpress.Request} request - The request object containing check code parameter
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with file metadata array and status message
 */
async function getMetaByCheckCode(request, response) {
  let reqparam = await request.json();
  let msg: string = "ok";
  let fileInfo = [] as any;
  const checkCode = reqparam.code
  try {
    const ins = await Mongo.getInstance();
    const storage = GridFsStorage.getInstance(ins.getClient());
    fileInfo = await storage.bucket.find({ 'metadata.checkCode': checkCode }).toArray();
  } catch (e) {
    msg = "getFileMeta:" + e;
    logger.error(msg);
  }

  await response.json({
    data: fileInfo,
    msg: msg
  })
}

const CACHE_KEY_PREFIX = 'file:buffer:';

/**
 * Download a file with caching support for small files.
 * @param {HyperExpress.Request} request - The request object containing file ID
 * @param {HyperExpress.Response} response - The response object for sending file data
 * @returns {Promise<void>} - Sends file data or error response
 */
async function getFile(request: Request, response: Response) {
  const { id } = request.params;

  if (!id) {
      return response.status(400).json({ msg: 'File id cannot be empty' });
    }

  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return response.status(400).json({ msg: 'File ID format is incorrect' });
    }

  const ins = await Mongo.getInstance();
  const storage = GridFsStorage.getInstance(ins.getClient());
  let downloadStream: any = null;

  try {
    const objectId = new ObjectId(id);
    const cacheKey = `${CACHE_KEY_PREFIX}${id}`;

    // First check LRU cache (small files only)
    const cachedBuffer = fileCache.get(cacheKey);
    if (cachedBuffer) {
      // Set necessary headers (especially Content-Length)
      response.set('X-Cache', 'HIT');
      response.set('Content-Type', 'image/jpeg'); // Temporary default, will be overwritten below
      response.set('Content-Length', cachedBuffer.length.toString());
      response.set('Cache-Control', 'public, max-age=86400');

      // Send and return immediately to prevent subsequent logic execution
      return response.send(cachedBuffer);
    }
    response.set('X-Cache', 'MISS');

    // Query file metadata
    const fileInfo = await storage.bucket
      .find({ _id: objectId }, {
        projection: {
          filename: 1,
          length: 1,
          'metadata.contentType': 1,
          uploadDate: 1
        }
      })
      .limit(1)
      .next();

    if (!fileInfo) {
      return response.status(404).json({ msg: 'File not found' });
    }

    const { length: fileSize, filename, metadata, uploadDate } = fileInfo;
    const contentType = metadata?.contentType || 'application/octet-stream';
    const safeFilename = filename || 'download';

    // Set response headers (when cache miss)
    const encodedFilename = encodeURIComponent(safeFilename);
    response.set('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`); // 👈 Note: Use inline for images
    response.set('Content-Type', contentType);
    response.set('Cache-Control', 'public, max-age=86400');
    if (uploadDate) {
      response.set('Last-Modified', new Date(uploadDate).toUTCString());
    }

    // 304 cache validation
    const ifModifiedSince = request.headers['if-modified-since'];
    if (ifModifiedSince && uploadDate) {
      const clientTime = new Date(ifModifiedSince).getTime();
      const serverTime = new Date(uploadDate).getTime();
      if (clientTime >= serverTime) {
        return response.status(304).send();
      }
    }

    // Small file: Memory buffer + cache
    if (fileSize < LARGE_FILE_THRESHOLD) {
      const buffers: Buffer[] = [];
      downloadStream = storage.openDownloadStream(objectId);

      downloadStream.on('data', (chunk: Buffer) => buffers.push(chunk));

      downloadStream.on('error', (err: any) => {
          console.error(`[getFile] Failed to read small file ${id}:`, err);
          if (!response.headersSent) {
            response.status(500).json({ msg: 'File read failed' });
          }
          cleanupStream(downloadStream);
        });

      downloadStream.on('end', () => {
        const fullBuffer = Buffer.concat(buffers);
        
        // Write to LRU cache
        fileCache.set(cacheKey, fullBuffer);

        // Set Content-Length and send
        response.set('Content-Length', fullBuffer.length.toString());
        if (!response.headersSent) {
          response.send(fullBuffer);
        }
      });

      // Client disconnected
      request.on('close', () => {
        cleanupStream(downloadStream);
      });

      return; // Return early to prevent execution of large file logic
    }

    // Large file: Stream transmission
    downloadStream = storage.openDownloadStream(objectId);

    downloadStream.on('error', (err: any) => {
        console.error(`[getFile] Failed to read large file ${id}:`, err);
        if (!response.headersSent) {
          response.status(500).json({ msg: 'File read failed' });
        }
        cleanupStream(downloadStream);
      });

    const readable = Readable.from(downloadStream);
    readable.pipe(response as any);

    request.on('close', () => {
      cleanupStream(downloadStream);
    });

  } catch (error: any) {
    if (response.headersSent) {
      cleanupStream(downloadStream);
      return response.end();
    }

    if (error.name === 'BSONError' || error.message.includes('Illegal hexadecimal')) {
      return response.status(400).json({ msg: 'File ID format is incorrect' });
    }

    console.error('[getFile] Unexpected error:', error);
    response.status(500).json({
      msg: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Clean up a stream by destroying it if not already destroyed.
 * @param {stream.Readable|stream.Writable} stream - The stream to clean up
 * @returns {void}
 */
function cleanupStream(stream: any) {
  if (stream && !stream.destroyed) {
    stream.destroy();
  }
}

/**
 * Delete a file from GridFS storage.
 * @param {HyperExpress.Request} request - The request object containing file ID
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with status message
 */
async function removeFile(request, response) {
  let msg: string = "ok";
  const id: string = request.path_parameters.id;
  try {
    const ins = await Mongo.getInstance();
    const storage = GridFsStorage.getInstance(ins.getClient());
    await storage.deleteFile(new ObjectId(id));

  } catch (e) {
    msg = "removeFile:" + e;
    logger.error(msg);
  }

  await response.json({
    msg: msg
  })
}

export default fileRouter