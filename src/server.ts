/**
 * Server startup entry file
 * 1. Static resource directory service
 * 2. API interface response service
 * 3. Listening address and port
 * 4. Configuration file reading
 */
import HyperExpress from "hyper-express";
import jwtVerify from "./router/jwtVerify.js";
import metaRouter from "./router/metaRouter.js";
import biRouter from "./router/biRouter.js";
import fileRouter from "./router/fileRouter.js";
import sysRouter from "./router/sysRouter.js";
import liveDirRouter from "./router/liveDirRouter.js";
import config from "./utils/config.js";
import { encryptPack, decryptPack } from "./utils/crypto-msgpack.js";
import { WebPath, AuditApi } from "./types/enum.js";
import { logger } from "./utils/logger.js";
import { keys } from "radashi";
import Mongo from "./api/mongo/mongoDB.js";
import { Pulse } from "@pulsecron/pulse";
import { initPulse } from "./router/pulse.js";

let mongo: Mongo;
let pulse: Pulse;

const msgPackMetaType = "application/qbpack"; // Custom header Content-Type
const apiRoot = config.http.apiRoot; // Configuration file reading
const AuthApis = [
  `/${apiRoot}${WebPath.Login}`,
  `/${apiRoot}${WebPath.Register}`,
];
const auditApiNames = keys(AuditApi);

const webserver = new HyperExpress.Server();

function hasQbPackMetaType(contentType: string | null | undefined): boolean {
  if (!contentType) {
    return false;
  }
  // Convert content type to lowercase and normalize
  const normalizedContentType = contentType.toLowerCase();
  // Check if it contains 'application/msgpack'
  return normalizedContentType.includes(msgPackMetaType.toLowerCase());
}

webserver.use(async (request, response, next) => {
  try {
    await jwtVerify(request, response);
  } catch (error) {
    logger.error("jwtVerify:" + error);
    return response.status(401).json({ error: "Token expired, please log in again!" });
  }
});

// Add messagePack response method
webserver.use((request, response: any, next) => {
  response.qbJson = async function (data: any) {
    try {
      if (hasQbPackMetaType(request.headers["content-type"])) {
        this.header("Content-Type", msgPackMetaType);
        const token = request.header("Authorization");
        return this.send(await encryptPack(data, token));
      } else {
        return this.json(data);
      }
    } catch (error: any) {
      logger.error("qbpack encode error:", error);
      return this.status(500).json({
        error: "qbpack encode error",
        details: error.message,
      });
    }
  };
  next();
});

// Middleware: Parse MessagePack
webserver.use(async (request: any, response, next) => {
  try {
    // Permission check: Metadata tables do not allow direct CRUD operations;
    const reqName = request.originalUrl.split("/").pop();
    if (auditApiNames.includes(reqName)) {
      if (request.account.adminGroup.length > 0) {
        logger.info(reqName + `[${request.account.loginName}]`);
      } else {
        throw new Error("reject notReject modifications by non-administrators");
      }
    }

    // Encapsulate as a method, execute when called, note that request.qbJson() needs parentheses;
    request.qbJson = async () => {
      // Allow clients to enable/disable encryption during testing, 
      // remove this check after official release, qbJson does not allow bypassing encryption
      const userQbPack = hasQbPackMetaType(request.headers['content-type']);
      const token = !AuthApis.includes(request.originalUrl)
        ? request.header("Authorization")
        : undefined;
      if (userQbPack) {
        const buffer = await request.buffer();
        if (buffer.length === 0 || buffer.byteLength === 0) {
        } else {
          return await decryptPack(new Uint8Array(buffer), token);
        }
      }
      return await request.json();
    };
  } catch (e) {
    // Write metadata operation log; (business data logs are recorded in corresponding business data)
    logger.error("messagePack middleware error:" + e);
    return response.status(400).send("Invalid qbpack");
  }
});

webserver.use(sysRouter);
webserver.use(metaRouter);
webserver.use(biRouter);
webserver.use(fileRouter);

if (config.http.oneServer) {
  webserver.use(liveDirRouter);
  console.log('✅ Static route enabled');
} else {
  console.log('⚠️  Static route not enabled');
}

const initMongo = async () => {
  try {
    // Initialize DB connection
    mongo = await Mongo.getInstance();
    // Initialize Pulse
    pulse = await initPulse(mongo.getDatabase());
  } catch (e: any) {
    logger.error('init mongo error: ' + e);
    console.log('❌ MongoDB is not accessible, restart the service after configuration is correct')
  }
}


// Start service
const start = async () => {
  await initMongo();
  const serverPort = config.http.serverPort || "8000";
  try {
    // Start HTTP service
    await webserver.listen(serverPort);
    logger.info(`Service started, port: ${serverPort}`);
    console.log(`Webserver started on port ${serverPort}`);
  } catch (error) {
    logger.info(`Failed to start webserver on port ${serverPort} :` + error);
    console.error(`Failed to start webserver on port ${serverPort} :`, error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down...");
  console.log("Shutting down...");
  if (pulse) await pulse.close(); // Close Pulse
  if (mongo) await mongo.close(); // Close MongoDB
  webserver.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();
