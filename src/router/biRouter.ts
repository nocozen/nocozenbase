/**
 * This file implements the Business Intelligence (BI) API router for the NocoZenBase application.
 * It provides endpoints for data analysis operations including distinct value queries, aggregation,
 * and collection management. The router uses HyperExpress framework and connects to MongoDB for data operations.
 */
import HyperExpress from "hyper-express";
import config from '../utils/config.js';
import Mongo from "../api/mongo/mongoDB.js";
import { DistinctOption } from "../types/apiMeta.js"
import { logger } from "../utils/logger.js";
import dayjs from "dayjs";

/**
 * BI Router Configuration
 * @description Router for Business Intelligence API endpoints
 */
const dimSplit = config.mongo.dimSplit; // newly modified to "|"
const apiRoot = config.http.apiRoot; // Read API root path from configuration file
const biRouter = new HyperExpress.Router();

// Determine methods to be included in this file based on future requirements
biRouter.post(apiRoot + '/dist', distinct);
biRouter.post(apiRoot + '/agg', aggregate);
biRouter.post(apiRoot + '/colls', getCollections);

/**
 * Get the default database name from configuration.
 * @returns {string} - The default database name
 */
function getDefaultDBname() {
  return config.mongo.mainDb;
}

/**
 * Find all distinct values of a specified field.
 * Restricts access to metadata tables and main data tables.
 * @param {HyperExpress.Request} request - The request object containing DistinctOption parameters
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with distinct values or error message
 */
async function distinct(request, response) {
  let reqparam: DistinctOption = await request.qbJson();
  // let reqparam: DistinctOption = await request.body;
  let result: any[] = [];
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();

    let dbname = getDefaultDBname();
    if ("dbname" in reqparam) {
      dbname = reqparam.dbname;
    }
    let filter = {} as any;
    if ("filter" in reqparam) {
      filter = reqparam.filter;
    }
    result = await ins!.distinct(dbname, reqparam.collection, reqparam.field, filter, {});

  } catch (e) {
    msg = "distinct:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    msg: msg
  })
}

/**
 * Execute MongoDB aggregation pipeline with flexible result formatting.
 * Restricts access to metadata tables and main data tables.
 * @param {HyperExpress.Request} request - The request object containing aggregation pipeline and options
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with aggregated results and status message
 */
async function aggregate(request, response) {
  let reqparam = await request.qbJson();
  let result: any[] = [];
  let msg: string = "ok";
  let dbname = getDefaultDBname();
  if ("dbname" in reqparam) {
    dbname = reqparam.dbname;
  }
  try {
    const ins = await Mongo.getInstance();
    let pip = reqparam.pipline;
    let objList = await ins.aggregate(dbname, reqparam.collection, pip);
    // "datatype": "array" | "object"; Whether records in the result set are objects or arrays, first item of array type is field name array;
    let datatype = "object";
    if ("datatype" in reqparam) {
      datatype = reqparam.datatype;
    }
    if (objList.length > 0) {
      if (datatype == "object") {
        result = objList;
      } else if (datatype == "array") {
        // Convert to array type, first row is field array, followed by data arrays
        let arrayList: any[] = [];
        // Add field array
        let fmeta = Object.keys(objList[0]);
        if (objList[0]._id == null) {
          fmeta[0] = "";
          arrayList.push(fmeta);
          for (let obj of objList) {
            let newObj = Object.values(obj);
            newObj[0] = "";
            arrayList.push(newObj);   // Add array record array
          }
        } else {
          fmeta[0] = Object.keys(objList[0]._id).join(dimSplit);
          arrayList.push(fmeta);
          for (let obj of objList) {
            let temp = Object.values(obj._id);    // Get all property values of _id object
            let newObj = Object.values(obj);
            newObj[0] = temp.map((key: any) => {
              if (key == null || typeof key == 'string' || typeof key == 'number') {
                return key;
              } else if (key instanceof Date) {
                // Fault tolerance handling, should actually be handled by client in query statement;
                return dayjs(key).format('YYYY-MM-DD HH:mm:ss');
              } else if (Array.isArray(key)) {
                return key.map((k: any) => k.name).join(",")
              } else {
                return key.name;
              }
            }).join(dimSplit);
            arrayList.push(newObj);   // Add array record array
          }
        }
        result = arrayList;
      } else if (datatype == "table") {   // For statistics
        let tableList = [] as any;
        for (let obj of objList) {
          let tempObj = { ...obj };
          delete tempObj._id;
          tableList.push({ ...obj._id, ...tempObj });
        }
        result = tableList;
      } else if (datatype == "default") { // For detailed queries
        result = objList;
      }
    }
  } catch (e) {
    msg = "aggregate:" + e;
    logger.error(msg);
  }
  await response.qbJson({
    data: result,
    msg: msg
  })
}

/**
 * Get a list of collections in a specified database.
 * @param {HyperExpress.Request} request - The request object containing database name and options
 * @param {HyperExpress.Response} response - The response object for sending results
 * @returns {Promise<void>} - Sends JSON response with collection list and status message
 */
async function getCollections(request, response) {
  let reqparam: {
    dbname: string,
    filter?: any,
    options?: any
  } = await request.qbJson();

  let result: any;
  let msg: string = "ok";
  let dbname = ""

  try {
    const ins = await Mongo.getInstance();
    if ("dbname" in reqparam) {
      dbname = reqparam.dbname;
    }
    let options = { nameOnly: true };
    if ("options" in reqparam) {
      options = reqparam.options;
    }
    let filter = {};
    if ("filter" in reqparam) {
      filter = reqparam.filter;
    }
    let objList = await ins!.getCollections(dbname, filter, options);
    result = objList;
  } catch (e) {
    msg = "getCollections:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    msg: msg
  })
}

export default biRouter