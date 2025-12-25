/**
 * Core API Module
 * 
 * This module provides core database operations and business logic functions
 * for the application, including data CRUD operations, logging, and tree structure management.
 */

import Mongo from "../api/mongo/mongoDB.js";
import { InsertResult, DeleteResult } from "../types/apiMeta.js";
import config from "../utils/config.js";
import * as M from "../types/meta.js";
import { LimitColl, Mark, MetaPrefix } from "../types/enum.js";
import { logger } from "../utils/logger.js";
import { isEmpty } from "radashi";
import { ConfigManager } from "../utils/conf.js";
import dayjs from "dayjs";

// Default maximum number of records to return
const maxLimit = config.http.maxLimit;

/**
 * Get the main database name
 * @returns Main database name from config or 'main' as default
 */
export function getMainDBname() {
  return config.mongo.mainDb || 'main';
}

/**
 * Get the business database name
 * @returns Business database name from config or 'main' as default
 */
export function getBusiDBname() {
  return config.mongo.mainDb || 'main';
}

/**
 * Get the GridFS database name
 * @returns GridFS database name from config or 'main' as default
 */
export function getGFSDBname() {
  return config.mongo.mainDb || 'main';
}

/**
 * Get the bucket name for GridFS
 * @returns Bucket name from config or 'qbfs' as default
 */
export function getBucketDBname() {
  return config.mongo.bucketName || 'qbfs';
}

/**
 * Insert a single business log entry
 * @param option - Log entry options
 * @returns The created log entry
 */
async function insertOneBiLog(
  option: {
    collName: string,
    type: 'add' | 'edit' | 'delete' | 'flow-complete',
    account: M.AccBase,
    en_id: any,
    oldDoc: any,
    newDoc: any
  },
) {
  const logCollName = option.collName.replace(MetaPrefix.Coll, MetaPrefix.Log);
  const ins = await Mongo.getInstance();
  let dbname = getMainDBname();
  
  // Insert data log; dump historical data
  const dataId = option.oldDoc ? option.oldDoc._id.toString() : option.newDoc._id.toString();
  const { _id, name, avatar } = option.account;
  
  let biLog: M.BiDataLog = {
    data_id: dataId,
    triggerType: option.type,
    oldDoc: option.oldDoc,
    newDoc: option.newDoc,
    optAccount: { _id, name, avatar },
    execResult: true,
    resultMsg: 'Single operation successful',
    errCode: null,
    logAt: new Date(),
    en_id: option.en_id
  };
  
  const logResult = await ins.insertOne(dbname, logCollName, biLog, {});
  
  if (!logResult.insertedId) {
    logger.error("insertBusiData error: insManyResult.insertedId: " + option.newDoc._id);
  }
  
  return biLog;
}

/**
 * Insert multiple business log entries
 * @param option - Log entry options
 * @param insManyResult - Result from bulk insert operation
 * @param docs - Original documents inserted
 * @returns Promise<void>
 */
async function insertManyBiLogs(
  option: { collName: string, type: 'add' | 'edit' | 'delete' | 'flow-complete', account: M.AccBase, en_id: any },
  insManyResult: any,
  docs: any
) {
  const logCollName = option.collName.replace(MetaPrefix.Coll, MetaPrefix.Log);
  const { _id, name, avatar } = option.account;
  const ins = await Mongo.getInstance();
  let dbname = getMainDBname();
  
  // Only handle successfully inserted documents; todo: consider how to handle error document logs later
  const biLog = Object.entries(insManyResult.insertedIds).map(([index, _id]) => ({
    type: option.type,
    data: { _id, ...docs[Number(index)] }, // Get original document by index
    optAccount: { _id, name, avatar },
    execResult: true,
    resultMsg: 'Batch insertion successful',
    errCode: null,
    logAt: new Date(),
    en_id: option.en_id
  }));
  
  const logResult = await ins.insertMany(dbname, logCollName, biLog, { ordered: false });
  
  if (docs.length != insManyResult.insertedCount || logResult.insertedCount != insManyResult.insertedCount) {
    logger.error("insertBusiData error: insManyResult.insertedIds: " + insManyResult.insertedIds +
      ",logResult.insertedIds:" + logResult.insertedIds);
  }
}

/**
 * Delete a single document
 * @param collName - Collection name
 * @param filter - Query filter
 * @returns Object containing deletion result and message
 */
async function delOne(collName: string, filter: any) {
  let result: DeleteResult = {
    acknowledged: false,
    deletedCount: 0,
  };
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    let dbname = getMainDBname();
    result = await ins!.deleteOne(dbname, collName, filter, {});
  } catch (e) {
    msg = "delOne:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Find a single document
 * Currently only used by getEnInfo
 * @param collName - Collection name
 * @param filter - Query filter
 * @returns Object containing found document, count, and message
 */
async function findOne(collName: string, filter: any) {
  let result;
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    result = await ins!.findOne(dbname, collName, filter, {});
  } catch (e) {
    msg = "findOne:" + e;
    logger.error(msg);
  }

  return {
    data: [result],
    count: 1,
    msg: msg,
  };
}

/**
 * Find multiple documents with pagination support
 * @param collName - Collection name
 * @param filter - Query filter (must include en_id)
 * @param opt - Query options (sort, page, size, projection)
 * @returns Object containing found documents, total count, and message
 */
async function findData(
  collName: string,
  filter: {
    en_id: string;
    [key: string]: any;
  },
  opt: { sort?: any; page?: number; size?: number; projection?: any }
) {
  let result: any[] = [];
  let count = -1; // Non-paginated query can use array length directly, no need for additional counting
  let msg: string = "ok";
  
  if (!('en_id' in filter)) {
    throw new Error('filter must contain en_id property');
  }
  
  try {
    const ins = await Mongo.getInstance();
    const options: any = {}; 
    let dbname = getMainDBname();
    
    opt.sort && (options.sort = opt.sort);
    
    if (opt.page && opt.size) {
      options.skip = Math.max(opt.page - 1, 0) * opt.size;
    }
    
    options.limit = opt.size ? opt.size : maxLimit;
    
    // Non-paginated query can use array length directly, no need for additional counting
    count = await ins!.count(dbname, collName, filter, {});
    options.projection = opt.projection;
    
    let objList = await ins!.find(dbname, collName, filter, options);
    
    // General queries do not allow returning array result sets, which would cause field names and values to be misaligned
    result = objList;
  } catch (e) {
    msg = "findData:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    count: count,
    msg: msg,
  };
}

/**
 * Insert a tree node into a collection
 * @param collName - Collection name
 * @param node - Node data to insert
 * @param en_id - Enterprise ID
 * @returns Object containing insertion result and message
 */
async function insertTreeNode(collName: string, node: any, en_id: string) {
  let result: InsertResult = {
    acknowledged: false,
    insertedCount: 0,
    insertedIds: [],
    insertedUids: [],
  };
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();

    if ([LimitColl.App, LimitColl.ModuleNode].includes(collName as any)) {
      let filter = { en_id: en_id, suf_id: { $ne: Mark.Delete }, type: { $ne: 'group' } };
      const count = await ins!.count(dbname, collName, filter, {});
    }

    const { _id, ...doc } = node; // Avoid automatic _id creation failure when _id exists

    doc["suf_id"] = null;
    let findResult = null as any;
    let filter = {};

    // For role groups, use parent_id as en_id for easier tree structure processing
    if (LimitColl.Role == collName && "group" == doc.type) {
      doc.parent_id = en_id;
    }
    if (LimitColl.AdminGroup == collName) {
      doc.parent_id = en_id;
    }

    // Find the last node, need to handle differently by type
    if (collName == LimitColl.App) {
      filter = { en_id: en_id, type: doc.type, suf_id: null };
    } else {
      // Sort nodes under the same parent
      filter = {
        en_id: en_id,
        app_id: doc.app_id,
        parent_id: doc.parent_id,
        suf_id: null,
      };
    }

    findResult = await ins!.findOne(dbname, collName, filter, {});
    
    // Insert node
    doc["en_id"] = en_id;
    let insOneResult = await ins.insertOne(dbname, collName, doc, {});

    // Update the suf_id of the node where suf_id==null to insOneResult.insertedId.toString()
    if (findResult) {
      const filter = { _id: findResult._id };
      const update = { $set: { suf_id: insOneResult.insertedId.toString() } };
      // Update the suf_id of the previous node to the current node's _id
      let updateResult = await ins!.updateOne(
        dbname,
        collName,
        filter,
        update,
        {}
      );
    }

    result = {
      acknowledged: insOneResult.acknowledged,
      insertedCount: insOneResult.acknowledged ? 1 : 0,
      insertedIds: [insOneResult.insertedId],
      insertedUids: [],
    };
  } catch (e: any) {
    msg = e.message;
    logger.error("insertTreeNode:" + e);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Update node position in an N-tree structure
 * Client provides the node to move and the后置 node at insertion position, server generates update data and updates
 * @param collName - Collection name
 * @param update - Array of nodes to update [moving node, new suf node]
 * @returns Object containing update result and message
 */
async function updateNTreeMoveNode(
  collName: string,
  update: Array<M.ParamNode>
) {
  let result = false;
  let msg: string = "ok";
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();
  const updateSufIds: Array<M.ParamNode> = update; // [moving node, node at drop position]

  try {
    if (updateSufIds.length == 2) {
      const currNode = updateSufIds[0]; // Currently dragged node
      const newSufNode = updateSufIds[1]; // Node at drop position
      const dropPosition = updateSufIds[1].dropPosition
        ? updateSufIds[1].dropPosition
        : "before"; // before | inside | after
      
      if (updateSufIds[0]._id == updateSufIds[1]._id) {
        throw new Error("Parameter error!");
      }
      
      // Find the old previous node and modify its suf_id
      await ins!.updateOne(
        dbname,
        collName,
        { suf_id: currNode._id },
        { $set: { suf_id: currNode.suf_id } },
        {}
      );
      
      // Find the new previous node and modify its suf_id
      let updateCurrNode = {} as any;
      
      if ("before" == dropPosition) {
        await ins!.updateOne(
          dbname,
          collName,
          { parent_id: newSufNode.parent_id, suf_id: newSufNode._id },
          { $set: { suf_id: currNode._id } },
          {}
        );
        
        // Update current node's suf_id
        updateCurrNode = { suf_id: newSufNode._id };
        
        if (currNode.parent_id != newSufNode.parent_id) {
          updateCurrNode["parent_id"] = newSufNode.parent_id;
        }
      } else if ("after" == dropPosition) {
        await ins!.updateOne(
          dbname,
          collName,
          { parent_id: newSufNode.parent_id, _id: newSufNode._id },
          { $set: { suf_id: currNode._id } },
          {}
        );
        
        updateCurrNode = { suf_id: newSufNode.suf_id };
        
        if (currNode.parent_id != newSufNode.parent_id) {
          updateCurrNode["parent_id"] = newSufNode.parent_id;
        }
      } else {
        // 'inside' insert as child node of drop node, suf_id=null
        updateCurrNode = { parent_id: newSufNode.parent_id, suf_id: null };
      }
      
      const updateResult = await ins!.updateOne(
        dbname,
        collName,
        { _id: currNode._id },
        { $set: updateCurrNode },
        {}
      );
      
      if (!updateResult) {
        throw new Error("Data update error!");
      }
    } else {
      throw new Error("Parameter error!");
    }
    
    result = true;
  } catch (e) {
    msg = "updateNTreeMoveNode:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Update menu node position
 * Client provides the node to move and the后置 node at insertion position, server generates update data and updates
 * @param collName - Collection name
 * @param update - Array of nodes to update [moving node, new suf node]
 * @returns Object containing update result and message
 */
async function updateMenuMoveNode(collName: string, update: Array<M.Node>) {
  let result = false;
  let msg: string = "ok";
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();
  const updateSufIds: Array<M.Node> = update; // [moving node, node at drop position]

  try {
    if (updateSufIds.length == 2) {
      const currNode = updateSufIds[0];
      const newSufNode = updateSufIds[1];
      
      if (updateSufIds[0]._id == updateSufIds[1]._id) {
        throw new Error("Parameter error!");
      }
      
      // Find the old previous node and modify its suf_id
      await ins!.updateOne(
        dbname,
        collName,
        { suf_id: currNode._id },
        { $set: { suf_id: currNode.suf_id } },
        {}
      );
      
      // Find the new previous node and modify its suf_id
      await ins!.updateOne(
        dbname,
        collName,
        { parent_id: newSufNode.parent_id, suf_id: newSufNode._id },
        { $set: { suf_id: currNode._id } },
        {}
      );
      
      // Update current node's suf_id
      let update = { suf_id: newSufNode._id };
      
      if (currNode.parent_id != newSufNode.parent_id) {
        update["parent_id"] = newSufNode.parent_id;
      }
      
      const updateResult = await ins!.updateOne(
        dbname,
        collName,
        { _id: currNode._id },
        { $set: update },
        {}
      );
      
      if (!updateResult) {
        throw new Error("Data update error!");
      }
    } else {
      throw new Error("Parameter error!");
    }
    
    result = true;
  } catch (e) {
    msg = "updateMenuMoveNode:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Delete tree nodes completely
 * @param collName - Collection name
 * @param update - Array of nodes to delete
 * @returns Object containing deletion result and message
 */
async function deleteTreeNode(collName: string, update: Array<M.Order>) {
  let result = false;
  let msg: string = "ok";
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();
  const updateSufIds: Array<M.Order> = update;

  try {
    for (const node of updateSufIds) {
      // Modify the suf_id of the previous node to the suf_id of the deleted node
      await ins!.updateOne(
        dbname,
        collName,
        { suf_id: node._id },
        { $set: { suf_id: node.suf_id } },
        {}
      );
      
      // Delete current node
      await ins!.deleteOne(dbname, collName, { _id: node._id }, {});
      
      // Special handling for department roles
      if ([LimitColl.Dept, LimitColl.Role].includes(collName as LimitColl)) {
        // Clear the current department from the department array in the account extension table
        const update = { $pull: { [collName]: { _id: node._id } } };
        const updateResult = await ins!.updateOne(
          dbname,
          LimitColl.AccountEn,
          { [`${collName}._id`]: node._id },
          update,
          {}
        );
        
        if (!updateResult) {
          throw new Error("Module deletion error!");
        }
      }
    }
    
    result = true;
  } catch (e) {
    msg = "deleteTreeNode:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Mark nodes for deletion (soft delete)
 * Cannot be directly merged with app deletion because different containers are used
 * @param collName - Collection name
 * @param update - Array of nodes to mark for deletion
 * @returns Object containing update result and message
 */
async function markNodeDelete(collName: string, update: Array<M.Order>) {
  let result = false;
  let msg: string = "ok";
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();
  const updateSufIds: Array<M.Order> = update;

  try {
    for (const node of updateSufIds) {
      // Modify the suf_id of the previous node to the suf_id of the deleted node
      await ins!.updateOne(
        dbname,
        collName,
        { suf_id: node._id },
        { $set: { suf_id: node.suf_id } },
        {}
      );
      
      let update = { $set: { parent_id: Mark.Delete, suf_id: Mark.Delete } };
      const updateResult = await ins!.updateOne(
        dbname,
        collName,
        { _id: node._id },
        update,
        {}
      );
      
      if (!updateResult) {
        throw new Error("Module deletion error!");
      }
    }
    
    result = true;
  } catch (e) {
    msg = "markNodeDelete:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Update a single document
 * Except for special cases (process instance updates), clients are not allowed to write MongoDB statements directly; server will add strict validation later
 * @param collName - Collection name
 * @param filter - Query filter (must not be empty)
 * @param update - Update operation
 * @param options - Update options
 * @returns Object containing update result and message
 */
async function updateOne(
  collName: string,
  filter: any,
  update: any,
  options: any
) {
  // Except for special cases (process instance updates), clients are not allowed to write MongoDB statements directly; server will add strict validation later
  if (isEmpty(filter)) {
    throw new Error("updateOne filter error");
  }

  let result = false;
  let msg: string = "ok";
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();

  try {
    const updateResult = await ins!.updateOne(
      dbname,
      collName,
      filter,
      update,
      options
    );
    
    if (!updateResult) {
      throw new Error("updateOne result error");
    }
    
    result = true;
  } catch (e) {
    msg = "updateOne:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

/**
 * Update the suf_id sorting field of an ordered list
 * Client generates the node data that needs to be updated, server is only responsible for batch updates
 * @param collName - Collection name
 * @param update - Array of nodes with updated suf_id
 * @returns Object containing update result and message
 */
async function updateSufIds(collName: any, update: Array<M.Node>) {
  let result = false;
  let msg: string = "ok";
  const ins = await Mongo.getInstance();
  const dbname = getMainDBname();
  const updateSufIds = update;

  try {
    for (const node of updateSufIds) {
      let filter = { _id: node._id };
      let update = { suf_id: node.suf_id };
      const updateResult = await ins!.updateOne(
        dbname,
        collName,
        filter,
        { $set: update },
        {}
      );
      
      if (!updateResult) {
        throw new Error("Data update error!");
      }
    }
    
    result = true;
  } catch (e) {
    msg = "updateSufIds:" + e;
    logger.error(msg);
  }

  return {
    data: result,
    msg: msg,
  };
}

export {
  insertOneBiLog,
  insertManyBiLogs,
  updateMenuMoveNode,
  markNodeDelete,
  delOne,
  findOne,
  updateSufIds,
  updateOne,
  deleteTreeNode,
  findData,
  insertTreeNode,
  updateNTreeMoveNode,
};