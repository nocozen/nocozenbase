/**
 * This file implements static file serving functionality for NocoZenBase.
 * It provides a router for serving static assets using LiveDirectory, with support for
 * both development and production environments, path security checks, and MIME type handling.
 */
import LiveDirectory from "live-directory";
import path from "path";
import HyperExpress from "hyper-express";
import config from "../utils/config.js";
import fs from "fs";

const staticRouter = new HyperExpress.Router();
const apiRoot = config.http.apiRoot; // Configuration file reading

// Static resource folder configuration
const directoryName = config.http.staticDir;
const isProduction = process.env.NODE_ENV !== "development";
let root = path.normalize(path.resolve(directoryName)); // Use web under current root path to avoid errors caused by publication paths
if (isProduction) {   // Development and production environments have different running paths; cannot be mixed;
  root = path.normalize(path.join(__dirname, directoryName)); // web folder under current directory
}
// Ensure static directory exists
if (!fs.existsSync(root)) {
  !fs.mkdirSync(root, { recursive: true });
  isProduction && console.log(`🚨 Web Root newly created, please deploy frontend files and restart the service`);
}

if (config.http.oneServer) {
  if (!fs.existsSync(root)) {
    console.log(`🚨 Web Root does not exist: ${root}`);   // In practice, the directory should exist during operation; this is for debugging convenience;
  } else {
    console.log(`✅ Web Root: ${root}`);
  }
}


const MimeTypes = {
  // Basic types
  html: "text/html; charset=utf-8", // Explicit UTF-8 encoding
  htm: "text/html; charset=utf-8",
  shtml: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8", // Modern standard + encoding
  mjs: "application/javascript; charset=utf-8", // ES modules
  cjs: "application/javascript; charset=utf-8", // CommonJS modules
  json: "application/json; charset=utf-8",
  css: "text/css; charset=utf-8",
  txt: "text/plain",
  xml: "application/xml; charset=utf-8",

  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  avif: "image/avif",

  // Fonts
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",

  // Audio/Video
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  m4a: "audio/mp4",

    // Compressed files
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  rar: "application/vnd.rar",
  
  // WebAssembly
  wasm: "application/wasm",
  
  // Other common types
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

};

let isStatic = false;
isProduction && (isStatic = true); // Production environment recommended true (disable file watching)
// Initialize LiveDirectory, based on root providing absolute path (cannot run under dist)
const AssetsDirectory = new LiveDirectory(root, {
  static: isStatic,
  cache: {
    max_file_count: 200,
    max_file_size: 1024 * 1024 * 10, // 10MB
  },
});

/**
 * Static file service handler function.
 * Handles requests for static files, performs security checks, and serves appropriate content.
 * Supports both cached content and streaming for large files.
 * 
 * @param {HyperExpress.Request} request - The HTTP request object
 * @param {HyperExpress.Response} response - The HTTP response object
 */
async function staticServe(
  request: HyperExpress.Request,
  response: HyperExpress.Response
) {
  try {
    // Web path under current project, needs to be compatible with development and production, [do not modify arbitrarily]
    const requestPath = decodeURIComponent(request.path);

    // Security check (prevent path traversal attacks)
    if (requestPath.includes("\0") || requestPath.includes("..")) {
      console.warn(`⚠️ Illegal path access: ${requestPath}`);
      return response.status(403).send("Forbidden");
    }

    // Get file extension and MIME type
    const extension = path.extname(requestPath).substring(1).toLowerCase();
    // const ext = path.extname(requestPath).slice(1).toLowerCase();
    const mimeType = MimeTypes[extension] || "application/octet-stream";

    function isStaticFileRequest(pathname: string): boolean {
      // Explicitly exclude API routes
      if (pathname.startsWith(`/${apiRoot}/`)) return false;
      // Check if it has extension and is a known type
      return extension.length > 0 && mimeType;
    }

    // Non-static resource and non-API route -> return index.html (supports Vue routing)
    if (!isStaticFileRequest(requestPath)) {
      const indexAsset = AssetsDirectory.get("/index.html");
      if (indexAsset) {
        response.setHeader("Content-Type", "text/html");
        return response.send(indexAsset.content);
      }
      return response.status(404).send("Not Found");
    }

    // Handle static file requests
    const asset = AssetsDirectory.get(requestPath);
    if (!asset) {
      return response.status(404).send("File Not Found");
    }

    // Set response headers
    response.setHeader(
      "Content-Type",
      MimeTypes[extension] || "application/octet-stream"
    );

    if (isProduction) {
      // Set 1-year cache + immutable flag
      // response.setHeader("Cache-Control", "public, max-age=31536000, immutable")
      // Production environment cache 1 day + immutable flag
      response.setHeader("Cache-Control", "public, max-age=86400, immutable"); 
    }

    if (asset.cached) {
      // Return cached content directly
      response.send(asset.content);
    } else {
      // Stream the file
      asset.stream().pipe(response);
    }
  } catch (error) {
    console.error("Static file serve error:", error);
    response.status(500).send("Internal Server Error");
  }
}

// Register route: handle all static file requests
staticRouter.get("/*", staticServe);

export default staticRouter;
