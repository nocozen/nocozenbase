/**
 * Meta Router - API routing for metadata operations
 * 
 * This module provides API endpoints for:
 * - Sequence number generation and management
 * - Business data CRUD operations
 * - Flow instance management
 * - Module configuration management
 * 
 * Technologies used:
 * - HyperExpress (router)
 * - MongoDB (database operations)
 * - dayjs (date handling)
 * - radashi (utility functions)
 */
import HyperExpress from "hyper-express";
import config from "../utils/config.js";
import Mongo from "../api/mongo/mongoDB.js";
import {
  QueryOption,
  InsertOption,
  FindOption,
  InsertResult,
  UpdateOption,
  BulkUpsertOption,
} from "../types/apiMeta.js";
import { Mark, LimitColl, WebPath, ComplatedState, MetaPrefix } from "../types/enum.js";
import * as M from "../types/meta.js";
import {
  delOne,
  findData,
  insertTreeNode,
  markNodeDelete,
  updateMenuMoveNode,
  updateSufIds,
  updateOne,
  insertOneBiLog,
  findOne,
} from "./coreApi.js";
import { formatDocs, objListToArray } from "../utils/dataHelper.js";
import { logger } from "../utils/logger.js";
import { getMainDBname, getBusiDBname } from "./coreApi.js";
import { dataSyncNow } from "./pulse.js";
import { BulkWriteResult } from "mongodb";
import dayjs from "dayjs";
import { isEmpty } from "radashi";

// HyperExpress router instance for metadata API endpoints
const metaRouter = new HyperExpress.Router();

// API root path from configuration file
const apiRoot = config.http.apiRoot;

// Default maximum number of returned records
const maxLimit = config.http.maxLimit;

metaRouter.post(apiRoot + WebPath.ResetSequence, resetSequence);
metaRouter.post(apiRoot + WebPath.GetCurrSequence, getCurrSequence);
metaRouter.post(apiRoot + WebPath.FindBusiData, findBusiData);
metaRouter.post(apiRoot + WebPath.BulkWrite, bulkWrite);
metaRouter.post(apiRoot + WebPath.InsertBusiData, insertBusiData);
metaRouter.post(apiRoot + WebPath.UpdateBusiData, updateBusiData);
metaRouter.post(apiRoot + WebPath.DeleteBusiData, deleteBusiData);
metaRouter.post(apiRoot + WebPath.InitFlowInstance, initFlowInstance);
metaRouter.post(apiRoot + WebPath.FindAllFlowEnabled, findAllFlowEnabled);
metaRouter.post(apiRoot + WebPath.UpdateFlowInstance, updateFlowInstance);
metaRouter.post(apiRoot + WebPath.FindAllFlowTasks, findAllFlowTasks);
metaRouter.post(apiRoot + WebPath.GetAllModuleConfig, getAllModuleConfig);
metaRouter.post(apiRoot + WebPath.GetModuleConfig, getModuleConfig);
metaRouter.post(apiRoot + WebPath.EditModuleNode, editModuleNode);
metaRouter.post(apiRoot + WebPath.UpdateModuleNode, updateModuleNode);
metaRouter.post(apiRoot + WebPath.MarkModuleDelete, markModuleDelete);
metaRouter.post(apiRoot + WebPath.UpdateModuleConfig, updateModuleConfig);
metaRouter.post(apiRoot + WebPath.UpdateModuleOrder, updateModuleOrder);
metaRouter.post(apiRoot + WebPath.InsertModuleNode, insertModuleNode);
metaRouter.post(apiRoot + WebPath.UpdateAppHome, updateAppHome);
metaRouter.post(apiRoot + WebPath.EditAppNode, editAppNode);
metaRouter.post(apiRoot + WebPath.MarkAppDelete, markAppDelete);
metaRouter.post(apiRoot + WebPath.UpdateAppOrder, updateAppOrder);
metaRouter.post(apiRoot + WebPath.InsertAppNode, insertAppNode);
metaRouter.post(apiRoot + WebPath.GetAppModules, getAppModules);
metaRouter.post(apiRoot + WebPath.GetAppList, getAppList);
metaRouter.post(apiRoot + WebPath.FindAppNode, findAppNode);
metaRouter.get("/test", test);

async function test(request, response) {
  response.send("Hello apiGet");
}

// periodType: 'year' | 'month' | 'day' | 'never'
function getCurrentType(periodType: string, now: Date): Date | null {
  switch (periodType) {
    case 'year':
      return dayjs(now).startOf('year').toDate();     // 2025
    case 'month':
      return dayjs(now).startOf('month').toDate();   // 202504
    case 'day':
      return dayjs(now).startOf('day').toDate(); // 20250401
    case 'never':
      return null; // Never reset, not dependent on period
    default:
      throw new Error(`Unsupported periodType: ${periodType}`);
  }
}

/**
 * Get the next sequence number for a component based on its sequence rule configuration.
 * @param {string} collName - Collection name
 * @param {string} key - Sequence key in format (usually includes component ID)
 * @returns {Promise<string>} - Formatted sequence number
 */
async function getNextSequence(collName: string, key: string) {
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();

  const now = new Date();
  // Query field configuration in metadata
  let splitArr = key.split("_");
  const compId = splitArr.length == 3 ? splitArr[2] : null;
  if (!compId) {
    throw new Error("Component Id cannot be empty");
  }
  const metaResult = await ins.findOne(dbname, LimitColl.ModuleConfig,
    { 'formConfig.collName': collName, 'compConfigs.i': compId },
    { projection: { 'compConfigs.$': 1, _id: 0 } }
  )
  const sequenceRule: M.SequenceRule = metaResult?.compConfigs?.[0]?.sequenceRule;
  if (!sequenceRule) {
    throw new Error(`Component [${compId}] configuration not found`);
  }

  // Query sequence number
  const currentPeriodStart = getCurrentType(sequenceRule.counterType, now);

  const filter = { compId: compId };
  const update = [
    {
      $set: {
        count: {
          $cond: {
            // Key logic: If 'never', directly +1; otherwise compare periodStart
            if: {
              $or: [
                { $eq: ["$periodType", "never"] },           // Type is never
                { $eq: ["$periodStart", currentPeriodStart] } // Or period matches
              ]
            },
            then: { $add: ["$count", 1] }, // Increment
            else: 1                        // Reset to 1
          }
        },
        // Update fields
        periodType: sequenceRule.counterType,
        periodStart: currentPeriodStart,
        updatedAt: now
      }
    }
  ];
  const nextSeqCount = await ins!.findOneAndUpdate(dbname, LimitColl.Sequence, filter, update,
    {
      upsert: true,
      returnDocument: 'after',
      projection: { count: 1, _id: 0 }
    });

  // Assemble serial number; Order: fixed characters + date characters + sequence number; or date characters + fixed characters + sequence number
  if (!nextSeqCount?.count || nextSeqCount.count < 1) {
    throw new Error('Sequence number retrieval error');
  }
  let seqId = ''      // Padding
  // Add prefix and date characters in order
  for (const subRule of sequenceRule.subRuleOrder) {
    if (Object.hasOwn(sequenceRule, subRule) && sequenceRule[subRule]) {
      seqId += sequenceRule[subRule];
    }
  }
  return seqId + String(nextSeqCount.count).padStart(sequenceRule.counterLength, '0');
}

/**
 * Reset sequence numbers for a component or all components.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function resetSequence(request, response) {
  let reqparam = await request.qbJson();
  let result;
  let msg: string = "ok";

  let { compId } = reqparam;
  const now = new Date();
  const filter = compId ? { compId: compId } : {};

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    const updateDoc = {
      $set: {
        count: 0, // Note: Set to 0, getNextSequence will +1 → return 1
        updatedAt: now
      }
    };

    result = await ins!.updateOne(dbname, LimitColl.Sequence, filter, updateDoc, {});
  } catch (e) {
    msg = "resetSequence:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: [result],
    msg: msg,
  });
}

async function getCurrSequence(request, response) {
  let reqparam = await request.qbJson();
  let result;
  let msg: string = "ok";

  let { compId } = reqparam;
  if (isEmpty(compId)) {
    throw new Error("Component Id cannot be empty");
  }
  const filter = { compId: compId };
  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();

    result = await ins!.findOne(dbname, LimitColl.Sequence, filter, {});
    console.log(result)
  } catch (e) {
    msg = "resetSequence:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: [result],
    msg: msg,
  });
}

/**
 * Perform bulk write operations (insert/update) on business data.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function bulkWrite(request, response) {
  let msg: string = "ok";
  let result: BulkWriteResult = {} as any;
  let reqparam: BulkUpsertOption = await request.qbJson();

  // Complete system fields:
  const { _id, name, avatar } = request.account;
  let docBase = {
    complatedState: 'confirmed',
    createBy: { _id, name, avatar },
    createAt: new Date(),
    updateAt: new Date(),
    en_id: request.en_id,
  };

  try {
    const ins = await Mongo.getInstance();
    let dbname = getBusiDBname();
    if ("dbname" in reqparam) {
      dbname = reqparam.dbname;
    }
    const collName = request.collName ? request.collName : reqparam.collection;
    const docs = reqparam.docs;
    const meta = reqparam.meta;
    const option = reqparam.options || { ordered: false };
    if (docs?.length == 0 || meta?.length == 0) {
      throw new Error('Metadata and data cannot be empty')
    }
    const newDocs = formatDocs(docs, meta!, docBase);
    result = newDocs as any;
    // Default to generate hash; default not to deduplicate; performance first, deduplication should be handled in mongodb management terminal when needed
    // Do not deduplicate first, but generate hash; deduplication can be processed later, and provide configuration to select which fields to combine;
    // Default type conversion, fields not in metadata will not be imported;
    let bulkOps = newDocs?.map(data => {
      const document = { ...data };
      // Handle _id: If it does not exist or is empty, delete the field
      if (!document._id) {
        delete document._id;
      }
      // Build filter: Use _id if it exists, otherwise empty
      const filter = document._id ? { _id: document._id } : {};
      if (document._id) {
        return {
          updateOne: {
            filter: filter,
            update: { $set: document },
            upsert: true
          }
        };
      } else {
        return {
          insertOne: {
            document: document,
          },
        };
      }

    });

    // Temporarily not recording operation logs to ensure bulk insert performance; Plan whether logs are needed and how to implement them later;
    result = await ins.bulkWrite(dbname, collName, bulkOps, option);
  } catch (e) {
    msg = "bulkWrite:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    msg: msg,
  });
}

/**
 * Business data pagination query with collection validation to prevent system collection operations.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function findBusiData(request, response) {
  let reqparam: FindOption = await request.qbJson();
  let result: any[] = [];
  let count = -1; // Non-paginated queries can directly use array length, no need to add statistics
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const options: QueryOption = { limit: maxLimit }; // Merge FindOption??
    let collection = "";
    let filter = {};
    if (reqparam.collection) {
      collection = reqparam.collection;
    } else {
      collection = request.collection;
    }
    if (reqparam.filter) {
      filter = reqparam.filter;
    } else {
      filter = request.filter;
    }
    if (reqparam.sort && Object.keys(reqparam.sort).length > 0) {
      options.sort = reqparam.sort;
    } else {
      options.sort = { updateAt: -1 };
    }
    let dbname = getBusiDBname();
    if ("dbname" in reqparam) {
      dbname = reqparam.dbname;
    }
    if ("page" in reqparam && "size" in reqparam) {
      options.skip = Math.max(reqparam.page - 1, 0) * reqparam.size;
      options.limit = reqparam.size;
      // Non-paginated queries can directly use array length, no need to add statistics
      count = await ins!.count(dbname, collection, filter, {});
    }
    // After upgrading to version 6.x, you may have to use find().projection()
    if ("projection" in reqparam) {
      options.projection = reqparam.projection;
    }
    let objList = await ins!.find(dbname, collection, filter, options);
    // "datatype": "array" | "object"; Whether the records in the result set are objects or arrays, the first item of array type is the field name array;
    let datatype = "object";
    if ("datatype" in reqparam) {
      datatype = reqparam.datatype;
    }
    // Provide directly map processed data for vTable related component queries: object, array to string; number formatting; etc;
    // Server-side map? Or client-side processing? Currently client-side processing first; adjust later if needed;
    if (objList.length > 0 && datatype != "object") {
      result = objListToArray(objList); // Align field names and values;!!!General queries are not allowed to return array result sets, which will cause field names and values to be misaligned
    } else {
      result = objList;
    }
  } catch (e) {
    msg = "findBusiData:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    count: count,
    msg: msg,
  });
}

/**
 * Insert business data with core API reuse and collection validation to prevent system collection operations.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function insertBusiData(request, response) {
  let reqparam: InsertOption = await request.qbJson();
  // let reqparam: InsertOption = await request.body;
  let result: InsertResult = {
    acknowledged: false,
    insertedCount: 0,
    insertedIds: [],
    insertedUids: [],
  };
  let msg: string = "ok";
  let insertedUids: Array<any> = [];

  try {
    const ins = await Mongo.getInstance();
    let dbname = getBusiDBname();
    if ("dbname" in reqparam) {
      dbname = reqparam.dbname;
    }
    const collName = request.collName ? request.collName : reqparam.collection;
    // Log table corresponding to business data table
    const logCollName = collName.replace(MetaPrefix.Coll, MetaPrefix.Log);

    if (request.collName != LimitColl.FlowInstance &&
      Object.values(LimitColl).includes(collName as LimitColl)) {
      // Cannot operate metadata tables
      logger.error(
        "📛Security Violation!!!" +
        {
          ip: request.originalUrl,
          acc_id: request.account._id,
          collName: collName,
          docs: reqparam.docs,
        }
      );
      console.log("📛Security Violation!!!");
      throw new Error("Security Violation!!!");
    }
    // Prevent inserting remaining documents when previous document insertion fails in array.
    let options = { ordered: false };   // true: default for bulk insert, execute sequentially, throw exception on error; false: skip errors and continue inserting during bulk insert;
    if ("options" in reqparam) {
      options = reqparam.options;
    }

    let docs = reqparam.docs;
    let newDocs = [] as any; // If records in docs are in array format, need to convert to objects
    const { _id, name, avatar } = request.account;
    let metaBase: M.EnMeta = {
      createBy: { _id, name, avatar },
      createAt: new Date(),
      updateAt: new Date(),
      en_id: request.en_id,
    };
    // Determine whether it is array or object structure
    let isArray = Array.isArray(docs[0]);
    if (isArray) {
      let metaDoc = docs.shift(); // Delete the first element and return it
      for (let item of docs) {
        // The first item in docs is the field name, each subsequent record needs to be merged to generate object format
        const docObject: any = {};
        for (const [index, key] of metaDoc.entries()) {
          if (key.startsWith(MetaPrefix.FeSequenceId)) {
            docObject[key] = await getNextSequence(collName, key); // Get serial number asynchronously
          } else {
            docObject[key] = item[index]; // Directly assign values to ordinary fields
          }
        }
        newDocs.push({ ...docObject, ...metaBase });
      }
    } else {
      for (let item of docs) {
        // Handle doc in object form (non-array case)
        for (let key in item) {
          if (key.startsWith(MetaPrefix.FeSequenceId)) {
            // If it is a serial number field, call getNextSequence to get the value
            item[key] = await getNextSequence(collName, key);
          }
        }
        newDocs.push({ ...item, ...metaBase });
      }
    }

    if (newDocs.length == 1) {
      let insOneResult = await ins.insertOne(dbname, collName, newDocs[0], options);
      result = {
        acknowledged: insOneResult.acknowledged,
        insertedCount: insOneResult.acknowledged ? 1 : 0,
        insertedIds: [insOneResult.insertedId],
        insertedUids: insertedUids,
      };
      if (insOneResult.insertedId) {
        if (ComplatedState.Confirmed == newDocs[0].complatedState) {
          // Insert add data log; dump historical data;
          const biLog = await insertOneBiLog({ collName, type: 'add', account: request.account, en_id: request.en_id, oldDoc: null, newDoc: newDocs[0] });
          // Trigger synchronization upon successful update;
          await dataSyncNow({ collName, biLog });
        }
      }
    } else {
      let insManyResult = await ins!.insertMany(
        dbname,
        collName,
        newDocs,
        options
      );
      result = {
        acknowledged: insManyResult.acknowledged,
        insertedCount: insManyResult.insertedCount,
        insertedIds: Object.values(insManyResult.insertedIds),
        insertedUids: insertedUids,
      };
      if (result.insertedCount > 0) {   // Not used temporarily
        // Only process successfully inserted documents; consider how to handle logs of error documents later
        // await insertManyBiLogs({ collName, type: 'add', account: request.account, en_id: request.en_id }, null, newDocs);
        // Temporarily provide a method for each item, consider how to synchronize if batch needed??
        for (let doc of newDocs) {
          if (ComplatedState.Confirmed == doc.complatedState) {
            // If only processing successful ones, need to add judgment insManyResult.insertedIds contains
            // Insert data log; dump historical data;
            const biLog = await insertOneBiLog({ collName, type: 'add', account: request.account, en_id: request.en_id, oldDoc: null, newDoc: doc });
            // Trigger synchronization upon successful update;
            await dataSyncNow({ collName, biLog });
          }
        }
        logger.warn(newDocs, 'Batch add data need to ensure correct results!!');
      }
    }
  } catch (e) {
    msg = "insertBusiData:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    msg: msg,
  });

}

/**
 * Update business data with collection validation to prevent system collection operations.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function updateBusiData(request, response) {
  let reqparam: UpdateOption = await request.qbJson();
  const { _id, ...updateDoc } = reqparam.update;
  const filter = { _id };
  const update = { $set: updateDoc };
  const collName = reqparam.collection;
  const findOldResult = await findOne(collName, filter);
  const oldDoc = findOldResult.msg == 'ok' && findOldResult.data.length == 1 && findOldResult.data[0] || null;

  if (Object.values(LimitColl).includes(collName as LimitColl)) {
    // Cannot operate metadata tables
    logger.error(
      "📛Security Violation!!!" +
      {
        ip: request.originalUrl,
        acc_id: request.account._id,
        collName: collName,
        filter: filter,
        update: update,
      }
    );
    console.log("📛Security Violation!!!");
    throw new Error("Security Violation!!!");
  }
  // Get synchronization configuration, if exists: generate synchronization statement;

  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  if ("ok" == result.msg) {
    const newDoc = { ...oldDoc, ...updateDoc }   // Merge oldDoc and update
    if (ComplatedState.Confirmed == newDoc.complatedState) {
      // Insert data log; dump historical data;
      const biLog = await insertOneBiLog({ collName, type: 'edit', account: request.account, en_id: request.en_id, oldDoc, newDoc: newDoc },);
      // Trigger synchronization after successful update;
      await dataSyncNow({ collName, biLog });
    }
  }
  await response.qbJson(result);

}

/**
 * Delete business data with collection validation to prevent system collection operations.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function deleteBusiData(request, response) {
  let reqparam: UpdateOption = await request.qbJson();
  const collName = reqparam.collection;
  if (Object.values(LimitColl).includes(collName as LimitColl)) {
    // Cannot operate on metadata tables
    logger.error(
      "📛Security Violation!!!" +
      {
        ip: request.originalUrl,
        acc_id: request.account._id,
        collName: collName,
        filter: reqparam.filter,
      }
    );
    console.log("📛Security Violation!!!");
    throw new Error("Security Violation!!!");
  }
  // Get synchronization configuration, if exists: generate synchronization statement;
  const findOldResult = await findOne(collName, reqparam.filter);
  const oldDoc = findOldResult.msg == 'ok' && findOldResult.data.length == 1 && findOldResult.data[0] || null;

  const result = await delOne(collName, reqparam.filter);
  if ("ok" == result.msg) {
    // Insert data log
    const biLog = await insertOneBiLog({ collName, type: 'delete', account: request.account, en_id: request.en_id, oldDoc, newDoc: null });
    // Trigger synchronization upon successful deletion;
    await dataSyncNow({ collName, biLog });
  }

  await response.qbJson(result);
}

/**
 * Initialize a flow instance by inserting business data into the FlowInstance collection.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function initFlowInstance(request, response) {
  request.collName = LimitColl.FlowInstance;
  await insertBusiData(request, response);
}

/**
 * Find all flow tasks with filtering and pagination support.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function findAllFlowTasks(request, response) {
  const account = request.account;
  let reqparam: FindOption = await request.qbJson();
  let dbname = getMainDBname();

  let result: any[] = [];
  let countResult: any[] = [];
  let count = -1;
  let msg: string = "ok";
  // let filter = {} as any;

  let projection = {
    app_id: 1,
    module_id: 1,
    moduleName: 1,
    collName: 1,
    formMeta: 1,
    formData: 1,
    flowDef: 1,
    activeNodes: 1,
    // Used for original name filtering results, temporarily use dump field name here to avoid modifying interface, including all historical and current active data
    hisTasks: "$activeTasks",
    hisCCopy: "$activeCCopy",
    status: 1,
    createBy: 1,
    createAt: 1,
    updateAt: 1,
    creatorDeptId: 1,
  } as any;
  let match = {};

  // If flow center adds filtering, pay attention to handling [status]
  const { type, ...filter } = reqparam.filter;
  filter["en_id"] = request.en_id;
  // console.log(type, filter)
  if ("todo" == type) {
    filter["status"] = "active";
    projection["activeTasks"] = {
      $filter: {
        input: "$activeTasks",
        as: "task",
        cond: {
          $and: [
            { $eq: ["$$task.executor._id", account._id] },
            { $in: ["$$task.status", ["todo", "sendBack"]] },
          ],
        },
      },
    };
    match = { activeTasks: { $ne: [] } };
  } else if ("started" == type) {
    if ("status" in reqparam.filter) {
      filter["status"] = reqparam.filter.status;
    }
    filter["createBy._id"] = account._id;
  } else if ("handled" == type) {
    if ("status" in reqparam.filter) {
      filter["status"] = reqparam.filter.status;
    }
    filter["activeTasks.executor._id"] = account._id;
    filter["activeTasks.status"] = {
      $in: ["approve", "sendBack", "transfer", "reject"],
    };
    match = { activeTasks: { $ne: [] } };
  } else if ("received" == type) {
    let filterConditions = [{ $eq: ["$$ccopy.executor._id", account._id] }];
    filter["activeCCopy.executor._id"] = account._id;
    if ("isRead" in reqparam.filter) {
      filter["activeCCopy.isRead"] = reqparam.filter.isRead;
      filterConditions.push({
        $eq: ["$$ccopy.isRead", reqparam.filter.isRead],
      });
    }
    projection["activeCCopy"] = {
      $filter: {
        input: "$activeCCopy",
        as: "ccopy",
        cond: {
          $and: filterConditions,
        },
      },
    };
    match = { activeCCopy: { $ne: [] } };
  }
  let page = 1;
  reqparam.page && (page = reqparam.page);
  let size = 100;
  reqparam.size && (size = reqparam.size);
  let sort = {};
  if (reqparam.sort && Object.keys(reqparam.sort).length > 0) {
    sort = reqparam.sort;
  } else {
    sort = { updateAt: -1 };
  }

  try {
    const ins = await Mongo.getInstance();
    let pip = [
      {
        $match: filter,
      },
      {
        $project: projection,
      },
      {
        $match: match, // Filter out process instances where activeTasks or activeCCopy are empty arrays
      },
      {
        $sort: sort,
      },
      {
        $skip: (page - 1) * size, // Skip the first (page - 1) * pageSize records
      },
      {
        $limit: size, // Limit the result set size to pageSize
      },
    ];
    let pipCount = [
      {
        $match: filter,
      },
      {
        $project: projection,
      },
      {
        $match: match, // Filter out documents where activeTasks or activeCCopy are empty arrays
      },
      {
        $count: "count",
      },
    ];
    countResult = await ins.aggregate(dbname, LimitColl.FlowInstance, pipCount);
    countResult && countResult.length > 0 && (count = countResult[0].count);
    result = await ins.aggregate(dbname, LimitColl.FlowInstance, pip);
  } catch (e) {
    msg = "findAllFlowTasks:" + e;
    logger.error(msg);
  }
  await response.qbJson({
    data: result,
    msg: msg,
    count: count,
  });
}

async function findAllFlowEnabled(request, response) {
  const collName = LimitColl.FlowInstance;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

async function updateFlowInstance(request, response) {
  let reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.FlowInstance;
  const filter = reqparam.filter;
  // Client has custom $ keyword processing; will gradually tighten later, not allowing clients to directly write Mongodb statements;
  const update = reqparam.update;
  const options = reqparam.options || {};
  // Update flow instance
  const result = await updateOne(collName, filter, update, options);

  const biCollName = reqparam.collection;
  const formData = reqparam.formData;
  if ('ok' == result.msg && biCollName && formData) {
    const biFilter = { _id: formData._id };
    const biUpdate = { $set: { complatedState: ComplatedState.Confirmed } }
    // Update business data storage status to Confirmed
    const biDataResult = await updateOne(biCollName, biFilter, biUpdate, {});
    // Update data record as confirmed; record logs and trigger data synchronization;
    const biLog = await insertOneBiLog({
      collName: biCollName,
      type: 'flow-complete',
      account: request.account,
      en_id: request.en_id,
      oldDoc: null,
      newDoc: reqparam.formData
    });
    // Trigger synchronization after successful update;
    await dataSyncNow({ collName: biCollName, biLog: biLog });
  }
  await response.qbJson(result);
}

/**
 * Query all module configurations with filtering support.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function getAllModuleConfig(request, response) {
  const collName = LimitColl.ModuleConfig;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

/**
 * Query a specific module configuration.
 * @param {Object} request - Request object
 * @param {Object} response - Response object
 * @returns {Promise<void>} - No return value, sends JSON response
 */
async function getModuleConfig(request, response) {
  let reqparam: FindOption = await request.qbJson();
  let result: any = {};
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    const filter = reqparam.filter;
    const options = {};
    const filterKey = Object.keys(filter)[0];
    if ("moduleConfig_id" == filterKey) {
      const newFilter = { _id: filter.moduleConfig_id };
      const moduleConfig = await ins!.findOne(
        dbname,
        LimitColl.ModuleConfig,
        newFilter,
        options
      );
      // ModuleNode query must be in moduleNodeConfig, because _id in filter will be wrapObjectId, moduleNode.moduleConfig_id is ObjectId
      const moduleNode = await ins!.findOne(
        dbname,
        LimitColl.ModuleNode,
        { moduleConfig_id: newFilter._id },
        options
      );
      const { formLayout, boardLayout } = await ins.findOne(dbname, LimitColl.App, { _id: moduleConfig.app_id }, {});
      const defVglConfig = moduleConfig.moduleType == 'board' ? boardLayout : formLayout;
      result = moduleConfig && { ...moduleConfig, moduleNode: moduleNode, defVglConfig };
    } else if ("_id" == filterKey) {
      const moduleNode = await ins!.findOne(
        dbname,
        LimitColl.ModuleNode,
        filter,
        options
      );
      const moduleConfig = await ins!.findOne(
        dbname,
        LimitColl.ModuleConfig,
        { _id: moduleNode.moduleConfig_id },
        options
      );
      const { formLayout, boardLayout } = await ins.findOne(dbname, LimitColl.App, { _id: moduleConfig.app_id }, {});
      const defVglConfig = moduleConfig.moduleType == 'board' ? boardLayout : formLayout;
      result = moduleConfig && { ...moduleConfig, moduleNode: moduleNode, defVglConfig };
    }
  } catch (e) {
    msg = "getModuleConfig:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result ? [result] : [],
    msg: msg,
  });
}

// Get all module nodes of app;
// Admin permission: Can operate menu editing;
// Common user permission filtering: user_id => form permission set => accessible form results (module_id results merged), empty module groups are also filtered;
async function getAppModules(request, response) {
  // let reqparam: FindOption = await request.qbJson();
  let reqparam: FindOption = await request.qbJson();
  let result: any[] = [];
  let msg: string = "ok";
  let { _id, app_id, parent_id, type, imports } = reqparam.filter as any;
  try {
    let filter = { en_id: request.en_id, suf_id: { $ne: Mark.Delete } };
    if (app_id || parent_id || type || _id || imports) {
      if (app_id) {
        filter["app_id"] = app_id;
      }
      parent_id && (filter["parent_id"] = parent_id);
      if (type) {
        if (Array.isArray(type)) {
          filter["type"] = { $in: type };
        } else {
          filter["type"] = type;
        }
      }
      _id && (filter["_id"] = _id);
      imports && (filter["imports"] = imports);
    }
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    const options = {};
    result = await ins!.find(dbname, LimitColl.ModuleNode, filter, options);
    // console.log(result)
  } catch (e) {
    msg = "getAppModules:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    msg: msg,
  });
}

// Add new module or module group;
async function insertModuleNode(request, response) {
  let reqparam: InsertOption = await request.qbJson();
  const collName = LimitColl.ModuleConfig;
  let msg: string = "ok";

  try {
    let configIds = [] as any;
    let moduleNode = reqparam.docs[0];
    let moduleConfig = reqparam.docs[1];
    const app_id = moduleNode.app_id;
    const en_id = request.en_id;
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    let metaBase: M.AppMeta = {
      app_id: app_id,
      createBy: request.account,
      createAt: new Date(),
      updateAt: new Date(),
      en_id: en_id,
    };
    moduleConfig = { ...moduleConfig, ...metaBase };
    if ("group" != moduleNode.type) {
      const insOneResult = await ins!.insertOne(
        dbname,
        collName,
        moduleConfig,
        {}
      );

      if (insOneResult.insertedId) {
        moduleNode["moduleConfig_id"] = insOneResult.insertedId;
        // Temporary solution, multiple ids without names are easy to confuse, need to be optimized later
        configIds = [insOneResult.insertedId];
      }
    }

    const result = await insertTreeNode(
      LimitColl.ModuleNode,
      moduleNode,
      en_id
    );
    result.data.insertedIds.push(...configIds); // Temporary solution: multiple ids without names are easy to confuse, need further optimization later
    await response.qbJson(result);
  } catch (e) {
    msg = "insertModuleNode:" + e;
    logger.error(msg);
    await response.qbJson({
      data: null,
      msg: msg,
    });
  }
}

// Update module configuration
async function updateModuleConfig(request, response) {
  const reqparam = await request.qbJson();
  const collName = LimitColl.ModuleConfig;
  const filter = reqparam.filter;
  let update = {};
  if ("update" in reqparam) {
    update = { $set: reqparam.update };
  } else if ("pull" in reqparam) {
    update = { $pull: reqparam.pull };
  } else if ("push" in reqparam) {
    update = { $push: reqparam.push };
  } else if ("addToSet" in reqparam) {
    update = { $addToSet: reqparam.addToSet };
  }
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

// Modify title and icon
async function editModuleNode(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const updateModule: M.AppNode = reqparam.update;

  // Eventually merge the same update operation, automatically generate update based on metadata, same method code;
  const filter = { _id: updateModule._id };
  const update = {
    $set: {
      name: updateModule.name,
      icon: updateModule.icon,
      iconColor: updateModule.iconColor,
    },
  };
  const collName = LimitColl.ModuleNode;
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

// Update imports array field, add current app_id to all imported modules;
async function updateModuleNode(request, response) {
  const collName = LimitColl.ModuleNode;
  const reqparam: UpdateOption = await request.qbJson();
  const filter = reqparam.filter;
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

// Delete module node; delete form, delete group; mark delete with suf_id=delete
async function markModuleDelete(request, response) {
  const collName = LimitColl.ModuleNode;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await markNodeDelete(collName, update);
  await response.qbJson(result);
}

// Move and adjust menu nodes
async function updateModuleOrder(request, response) {
  const collName = LimitColl.ModuleNode;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateMenuMoveNode(collName, update);
  await response.qbJson(result);
}

// =========AppNode Business Methods, Module Title, Icon, Group=================
async function updateAppHome(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const { home_id, _id } = reqparam.update;
  // Eventually merge the same update operation, automatically generate update based on metadata, same method code;
  const filter = { _id };
  const update = { $set: { home_id } };
  const collName = LimitColl.App;
  const result = await updateOne(collName, filter, update, {});
  await response.qbJson(result);
}

async function editAppNode(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const updateApp: M.AppNode = reqparam.update;

  // Eventually merge the same update operation, automatically generate update based on metadata, same method code;
  const filter = { _id: updateApp._id };
  const update = {
    $set: {
      name: updateApp.name,
      icon: updateApp.icon,
      iconColor: updateApp.iconColor,
    },
  };
  const collName = LimitColl.App;
  const result = await updateOne(collName, filter, update, {});
  await response.qbJson(result);
}

// Internal method: Support adding applications, modules, module groups;
async function insertAppNode(request, response) {
  const collName = LimitColl.App;
  let reqparam: InsertOption = await request.qbJson();
  const node = reqparam.docs[0]; // docs is for compatibility with InsertOption
  const result = await insertTreeNode(collName, node, request.en_id);
  await response.qbJson(result);
}

async function findAppNode(request, response) {
  const collName = LimitColl.App;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

// Level 2 admins need to filter and return the list of apps they have permission to access;
// Common users need to filter and determine accessible modules based on permissions; if the number is 0, the app is not accessible;
// User_id => form permission set => accessible forms summarize form count based on app_id,
// Common users return app list with module count > 0;
async function getAppList(request, response) {
  let result: any[] = [];
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    const filter = { type: "app", suf_id: { $ne: Mark.Delete } };
    const options = {};
    result = await ins!.find(dbname, LimitColl.App, filter, options);
  } catch (e) {
    msg = "getAppList:" + e;
    logger.error(msg);
  }
  await response.qbJson({
    data: result,
    msg: msg,
  });
}

async function markAppDelete(request, response) {
  const collName = LimitColl.App;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateSufIds(collName, update);
  await response.qbJson(result);
}

// Transaction processing requires mongodb replica set deployment
async function updateAppOrder(request, response) {
  const collName = LimitColl.App;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateSufIds(collName, update);
  await response.qbJson(result);
}

export default metaRouter;
