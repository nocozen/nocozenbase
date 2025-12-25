/**
 * This file implements JWT verification middleware for NocoZenBase API routes.
 * It provides token validation, caching for improved performance, and support for temporary tokens.
 * Uses LRU cache to store verified tokens and implements whitelist functionality for public endpoints.
 */
import config from '../utils/config.js';
import { WebPath } from "../types/enum.js"
import { LRUCache } from 'lru-cache';
import ms from 'ms';
import { logger } from '../utils/logger.js';
import { verifyToken } from '../utils/jwt.js';

const apiRoot = config.http.apiRoot || 'api'; // Configuration file reading
const tokenExpiresIn = Number(ms(config.http.tokenExpiresIn)) || 1000 * 60 * 60 * 16; // Token expiration time
const cacheMax = config.http.jwtLRUMax || 1000;
const AuthApis = [
  '/test',
  `/${apiRoot}/initConfig`,
  `/${apiRoot}/setConfig`,
  `/${apiRoot}/getAllConfig`,
  `/${apiRoot}${WebPath.Login}`,
  `/${apiRoot}${WebPath.Register}`
]
// Set cache (max 1000 entries, TTL 5 minutes);
const jwtCache = new LRUCache({ max: cacheMax, ttl: tokenExpiresIn });

/**
 * JWT verification middleware for API routes.
 * Validates tokens, handles caching for performance, and supports temporary tokens.
 * 
 * @param {any} request - The HTTP request object
 * @param {any} response - The HTTP response object
 * @returns {Promise<void>} - Returns nothing if verification succeeds, otherwise sends 401 response
 */
async function jwtVerify(request: any, response: any) {
  const tokenHeaderKey = 'Authorization';
  let token = request.header(tokenHeaderKey);
  // Check if it's an API route and not in whitelist
  const isApiRoute = request.url.split('/').includes(apiRoot);
  const isAuthWhitelisted = AuthApis.includes(request.url);
  const isGetFileMeta = request.url.includes(WebPath.GetFileMeta);
  const isUploadGfs = request.url.includes(WebPath.UploadGfs);
  try {
    if (!isApiRoute || isAuthWhitelisted) {
      return;
    }
    if (!token) {
      return response.status(401).json({ error: "User not logged in" });
    }
    if (isGetFileMeta && token.length > 20) {    // Register temporary token
      if (request.query.metaId) {
        if (!jwtCache.has(request.query.metaId)) {
          jwtCache.set(request.query.metaId, token);
        }
      }
    }
    if (isUploadGfs && token.length < 20) {    // Verify temporary token
      if (jwtCache.has(token)) {
        const cacheToken = jwtCache.get(token);
        token = cacheToken;
      } else {
        return response.status(401).json({ error: "Authorization expired" });
      }
    }
    if (jwtCache.has(token)) {
      const cached = jwtCache.get(token) as any;
      request.account = cached.account;
      request.en_id = cached.en_id;
      return;
    }

    // const verified: any = jwt.verify(token, jwtSecretKey);
    const verified: any = await verifyToken(token);
    if (!verified) {
      return response.status(401).json({ error: "Login expired, please login again" });
    }

    jwtCache.set(token, verified); // Cache the result
    request['account'] = verified.account;
    request['en_id'] = verified.en_id;
  } catch (e: any) {
    // Client Request wrapper executes logout reset based on 401 status
    logger.error('JWT verification error:' + e);
    return response.status(401).json({ error: "Login expired, please login again" });
  }
}

export default jwtVerify
