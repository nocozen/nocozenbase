/**
 * System Router - Handles system-level API endpoints
 * This module provides routing for enterprise management, user authentication,
 * permission management, and other system-related functionalities.
 */
import HyperExpress from "hyper-express";
import config from "../utils/config.js";
import Mongo from "../api/mongo/mongoDB.js";
import * as M from "../types/meta.js";
import { LimitColl, LoginFildMap, WebPath } from "../types/enum.js";
import { FindOption, InsertOption, InsertResult, UpdateOption } from "../types/apiMeta.js";
import {
  findOne,
  updateSufIds,
  findData,
  insertTreeNode,
  updateNTreeMoveNode,
  deleteTreeNode,
  updateOne,
} from "./coreApi.js";
import { isEmpty, unique } from "radashi";
import { checkHashPwd, getHashPwd, isBcrypt } from "../utils/crypto-msgpack.js";
import { UAParser } from "ua-parser-js";
import { logger } from "../utils/logger.js";
import { getMainDBname } from "./coreApi.js";
import { generateToken } from "../utils/jwt.js";
import { ConfigManager } from "../utils/conf.js";
import dayjs from "dayjs";

const metaRouter = new HyperExpress.Router();
const apiRoot = config.http.apiRoot; // Read from configuration file

metaRouter.post(apiRoot + WebPath.UpdateAgOrder, updateAgOrder);
metaRouter.post(apiRoot + WebPath.DeleteAdminGroup, deleteAdminGroup);
metaRouter.post(apiRoot + WebPath.NewAdminGroup, newAdminGroup);
metaRouter.post(apiRoot + WebPath.UpdateAdminGroup, updateAdminGroup);
metaRouter.post(apiRoot + WebPath.GetAdminGroups, getAdminGroups);

metaRouter.post(apiRoot + WebPath.GetPermGroupCount, getPermGroupCount);
metaRouter.post(apiRoot + WebPath.GetPermGroups, getPermGroups);
metaRouter.post(apiRoot + WebPath.DeletePermGroup, deletePermGroup);
metaRouter.post(apiRoot + WebPath.NewPermGroup, newPermGroup);
metaRouter.post(apiRoot + WebPath.UpdatePgOrder, updatePgOrder);
metaRouter.post(apiRoot + WebPath.UpdatePermGroup, updatePermGroup);

metaRouter.post(apiRoot + WebPath.UpdateAccountEn, updateAccountEn);
metaRouter.post(apiRoot + WebPath.UpdateAccount, updateAccount);
metaRouter.post(apiRoot + WebPath.NewAccount, newAccount);

metaRouter.post(apiRoot + WebPath.UpdateRoleName, updateRoleName);
metaRouter.post(apiRoot + WebPath.DeleteRole, deleteRole);
metaRouter.post(apiRoot + WebPath.UpdateRoleOrder, updateRoleOrder);
metaRouter.post(apiRoot + WebPath.InsertRole, insertRole);
metaRouter.post(apiRoot + WebPath.GetRole, getRole);

metaRouter.post(apiRoot + WebPath.GetDeptMaxLevel, getDeptMaxLevel);
metaRouter.post(apiRoot + WebPath.GetParentDept, getParentDept);
metaRouter.post(apiRoot + WebPath.SetDeptManager, setDeptManager);
metaRouter.post(apiRoot + WebPath.UpdateDeptName, updateDeptName);
metaRouter.post(apiRoot + WebPath.DeleteDept, deleteDept);
metaRouter.post(apiRoot + WebPath.UpdateDeptOrder, updateDeptOrder);
metaRouter.post(apiRoot + WebPath.InsertDept, insertDept);
metaRouter.post(apiRoot + WebPath.GetDept, getDept);

metaRouter.post(apiRoot + WebPath.GetEnInfo, getEnInfo);
metaRouter.post(apiRoot + WebPath.UpdateEn, updateEn);
metaRouter.post(apiRoot + WebPath.GetAccountsBy, getAccountsBy);
metaRouter.post(apiRoot + WebPath.GetAccInfo, getAccountInfo);
metaRouter.post(apiRoot + WebPath.Login, login);
metaRouter.post(apiRoot + WebPath.Register, register);

metaRouter.post(apiRoot + "/initConfig", initConf);
metaRouter.post(apiRoot + "/setConfig", setConf);
metaRouter.post(apiRoot + "/getAllConfig", getAllConf);
metaRouter.post(apiRoot + "/testmsg", testmsg);


async function initConf(request, response) {
  let msg = 'ok'
  try {
    const configManager = ConfigManager.getInstance();
    const data = configManager.getAll();
    configManager.set('INIT_TIME', dayjs().format('YYYY-MM-DD HH:mm:ss'));
  } catch (e: any) {
    msg = "init error: " + e;
    logger.error(msg)
  }
  await response.qbJson({
    msg
  });
}

async function getAllConf(request, response) {
  let msg = 'ok';
  let data = {} as any;
  let reqparam: { admin: string, pwd: any } = await request.qbJson();
  try {
    const configManager = ConfigManager.getInstance();
    let allConfig = configManager.getAll();
    if (reqparam.admin != 'qbone' || reqparam.pwd != allConfig.INIT_PWD) {
      throw new Error('Incorrect account or password')
    }
    data = allConfig;
  } catch (e: any) {
    msg = "init config error: " + e;
  }
  await response.qbJson({
    msg,
    data
  });
}

async function setConf(request, response) {
  let msg = 'ok'
  let reqparam: { key: string, value: any, pwd: string } = await request.qbJson();
  const configManager = ConfigManager.getInstance();

  try {
    if (reqparam.pwd != configManager.get('INIT_PWD')) {
      throw new Error('Incorrect account or password')
    }
    if (reqparam.key) {
      configManager.set(reqparam.key, reqparam.value);
      configManager.set('INIT_TIME', dayjs().format('YYYY-MM-DD HH:mm:ss'));
    }

  } catch (e: any) {
    msg = "set config error: " + e;
    logger.error(msg)
  }
  await response.qbJson({
    msg
  });
}

async function testmsg(request, response) {
  const data = await request.qbJson();
  console.log(data);
  response.qbJson({ data: "qqq" });
}

async function updateAgOrder(request, response) {
  const collName = LimitColl.AdminGroup;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateSufIds(collName, update);
  await response.qbJson(result);
}

async function deleteAdminGroup(request, response) {
  const collName = LimitColl.AdminGroup;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await deleteTreeNode(collName, update);
  await response.qbJson(result);
}

async function newAdminGroup(request, response) {
  const collName = LimitColl.AdminGroup;
  let reqparam: InsertOption = await request.qbJson();
  const node = reqparam.docs[0];
  const result = await insertTreeNode(collName, node, request.en_id);
  await response.qbJson(result);
}

async function updateAdminGroup(request, response) {
  // 名称、注释；操作权限、字段权限、数据权限；部门角色成员；
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.AdminGroup;
  const filter = reqparam.filter;
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function getAdminGroups(request, response) {
  const collName = LimitColl.AdminGroup;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

/**
 * Get permission group count with permission checking
 * @param {HyperExpress.Request} request - The request object
 * @param {HyperExpress.Response} response - The response object
 */
async function getPermGroupCount(request, response) {
  let reqparam = await request.qbJson();
  // Default to current account _id
  let account = request.account;
  let resultAcc: any = {};
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    let filter = {};
    const deptIds = account.dept.map((d) => d._id);
    const roleIds = account.role.map((d) => d._id);
    // Ensure all parent departments are included
    let parentDepts = new Set(deptIds);
    for (let dept of deptIds) {
      let currDeptId = dept;
      let level = 1;
      while (currDeptId) {
        const findDept = await await ins!.findOne(
          dbname,
          LimitColl.Dept,
          { _id: currDeptId },
          {}
        );
        if (!findDept) {
          break;
        }
        parentDepts.add(findDept._id.toString());
        // If no parent node or parent_id is null, end the loop
        if (!findDept.parent_id) {
          break;
        } else {
          currDeptId = findDept.parent_id;
          level = level + 1;
        }
      }
    }

    // If filter conditions are passed, do not use _id parameter;
    filter = {
      ...(reqparam.app_id && { app_id: reqparam.app_id }),
      $or: [
        { "accountAuth._id": account._id },
        { "deptAuth._id": { $in: [...parentDepts] } },
        { "roleAuth._id": { $in: roleIds } },
      ],
    };

    let pip = [
      {
        $match: filter,
      },
      {
        $group: {
          _id: {
            app_id: "$app_id",
            module_id: "$parent_id",
          },
          module_perm: {
            $push: {
              id: "$_id",
              type: "$type",
              name: "$name",
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id.app_id",
          app_perm: { $sum: 1 },
          module_ids: { $addToSet: "$_id.module_id" },
          module: {
            $push: {
              module_id: "$_id.module_id",
              module_perm: "$module_perm",
            },
          },
        },
      },
      {
        $project: {
          app_perm: 1,
          module_ids: 1,
          module: 1,
          _id: 1,
        },
      },
    ];
    resultAcc = await ins!.aggregate(dbname, LimitColl.ModulePermGroup, pip);
  } catch (e) {
    msg = "getPermGroupCount:" + e;
    logger.error(msg);
    resultAcc = { count: 0 };
  }

  await response.qbJson({
    data: resultAcc,
    count: 1,
    msg: msg,
  });
}

async function getPermGroups(request, response) {
  const collName = LimitColl.ModulePermGroup;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

async function newPermGroup(request, response) {
  const collName = LimitColl.ModulePermGroup;
  let reqparam: InsertOption = await request.qbJson();
  const node = reqparam.docs[0];
  const result = await insertTreeNode(collName, node, request.en_id);
  await response.qbJson(result);
}

async function updatePgOrder(request, response) {
  const collName = LimitColl.ModulePermGroup;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateSufIds(collName, update);
  await response.qbJson(result);
}

/**
 * Update permission group
 * @param {HyperExpress.Request} request - The request object
 * @param {HyperExpress.Response} response - The response object
 */
async function updatePermGroup(request, response) {
  // Name, comment; operation permissions, field permissions, data permissions; department role members;
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.ModulePermGroup;
  const filter = reqparam.filter;
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function deletePermGroup(request, response) {
  const collName = LimitColl.ModulePermGroup;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await deleteTreeNode(collName, update);
  await response.qbJson(result);
}

async function updateAccount(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.Account;
  const filter = reqparam.filter;

  let set = {};
  if ("update" in reqparam) {
    const update = reqparam.update;
    if ("password" in update) {
      if (update.password == "reset") {
        update.password = {
          $substrCP: [
            "$phone",
            { $subtract: [{ $strLenCP: "$phone" }, 6] }, // 计算起始位置
            6,
          ],
        };
      } else {
        if ("oldPwd" in request.filter && "_id" in request.filter) {
          // Verify old password
          try {
            const ins = await Mongo.getInstance();
            const dbname = getMainDBname();
            const checkResult = await ins!.findOne(
              dbname,
              LimitColl.Account,
              { _id: request.filter._id },
              {}
            );
            const checkOldPwd = await checkHashPwd(
              request.filter.oldPwd,
              checkResult.password
            );
            if (checkOldPwd) {
              update.password = await getHashPwd(update.password);
            } else {
              throw new Error("Old password is incorrect!");
            }
          } catch (e) {
            await response.qbJson({
              data: null,
              msg: "Old password is incorrect!",
            });
          }
        }
      }
    }
    set = [
      {
        $set: update,
      },
    ];
  }
  const update = set;
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function updateAccountEn(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.AccountEn;
  const filter = reqparam.filter;
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

// New user account：account、account_en；
async function newAccount(request, response) {
  let reqparam = await request.qbJson();
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

    let metaBase: M.EnMeta = {
      createBy: request.account,
      createAt: new Date(),
      updateAt: new Date(),
      en_id: request.en_id,
    };

    // Account
    let acc: M.Account = reqparam.acc;
    acc.en_ids = [request.en_id];
    acc.createBy = request.account;
    acc.createAt = new Date();
    acc.updateAt = new Date();

    let insAccResult = await ins.insertOne(dbname, LimitColl.Account, acc, {});
    result = {
      acknowledged: insAccResult.acknowledged,
      insertedCount: insAccResult.acknowledged ? 1 : 0,
      insertedIds: [insAccResult.insertedId],
      insertedUids: [],
    };
    // Account extension
    let { _id, ...accEn } = reqparam.accEn;
    accEn.acc_id = insAccResult.insertedId; // ObjectId supports lookup queries
    accEn.en_id = request.en_id;
    accEn = { ...accEn, ...metaBase };
    let insAccEnResult = await ins.insertOne(
      dbname,
      LimitColl.AccountEn,
      accEn,
      {}
    );
  } catch (e: any) {
    msg = e.message;
    logger.error("newAccount:" + e);
  }

  await response.qbJson({
    data: result,
    msg: msg,
  });
}

async function updateRoleName(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.Role;
  const filter = reqparam.filter;
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function deleteRole(request, response) {
  const collName = LimitColl.Role;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await deleteTreeNode(collName, update);
  await response.qbJson(result);
}

async function updateRoleOrder(request, response) {
  const collName = LimitColl.Role;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateNTreeMoveNode(collName, update);
  await response.qbJson(result);
}

async function insertRole(request, response) {
  const collName = LimitColl.Role;
  let reqparam: InsertOption = await request.qbJson();
  const node = reqparam.docs[0];
  const result = await insertTreeNode(collName, node, request.en_id);
  await response.qbJson(result);
}

async function getRole(request, response) {
  const collName = LimitColl.Role;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

// Set department manager, support multiple;
async function setDeptManager(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.Dept;
  const filter = reqparam.filter;
  const update = { $set: { manager: reqparam.update } }; // Set manager to override existing settings, to support canceling existing managers
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function updateDeptName(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.Dept;
  const filter = reqparam.filter;
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function deleteDept(request, response) {
  const collName = LimitColl.Dept;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await deleteTreeNode(collName, update);
  await response.qbJson(result);
}

async function updateDeptOrder(request, response) {
  const collName = LimitColl.Dept;
  let reqparam: UpdateOption = await request.qbJson();
  const update = reqparam.update;
  const result = await updateNTreeMoveNode(collName, update);
  await response.qbJson(result);
}

// Get department accounts: account information, account extension information; Parameters: department id; account status, field value matching;
async function getAccountsBy(request, response) {
  let result: Array<any> = [];
  let msg: string = "ok";

  const en_id = request.en_id;
  const reqparam: FindOption = await request.qbJson();
  const accFilter = reqparam.filter.accFilter;
  const accExtFilter = reqparam.filter.accExtFilter;
  let beforeFilter = { en_id: en_id };
  accExtFilter && (beforeFilter = { ...beforeFilter, ...accExtFilter });
  let afterFilter = {};
  if (accFilter) {
    afterFilter = Object.entries(accFilter).map(([key, value]) => {
      if (typeof value == "string") {
        return { [`newAccount.${key}`]: new RegExp(value as string, "i") };
      } else {
        return { [`newAccount.${key}`]: value };
      }
    });
    afterFilter &&
      (afterFilter = isEmpty(afterFilter) ? {} : { $or: afterFilter });
  }

  // Query: department id; first query account extension table -- then query account table, and filter account status;
  let beforeMatch = {
    $match: beforeFilter,
  };
  let afterMatch = {
    $match: afterFilter,
  };

  let lookup = {
    $lookup: {
      from: LimitColl.Account,
      localField: "acc_id",
      foreignField: "_id",
      as: "newAccount",
    },
  };
  let unwind = {
    $unwind: "$newAccount",
  };

  let project = {
    $project: {
      _id: 1,
      acc_id: 1,
      loginName: "$newAccount.loginName",
      nickName: "$newAccount.nickName",
      code: "$newAccount.code",
      name: "$newAccount.name",
      phone: "$newAccount.phone",
      email: "$newAccount.email",
      avatar: "$newAccount.avatar",
      active: "$newAccount.active",
      onJob: "$newAccount.onJob",
      dept: 1,
      role: 1,
    },
  };

  let pipline = [beforeMatch, lookup, unwind, afterMatch, project];
  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();

    //
    result = await ins!.aggregate(dbname, LimitColl.AccountEn, pipline);
  } catch (e) {
    msg = "getAccountsBy:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    count: 1,
    msg: msg,
  });
}

async function getDeptMaxLevel(request, response) {
  let result: any = {};
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    let pip = [
      { $match: { en_id: request.en_id } },
      {
        $addFields: {
          id: { $toString: "$_id" }, // Convert _id to string
        },
      },
      {
        $graphLookup: {
          from: LimitColl.Dept,
          startWith: "$id",
          connectFromField: "id",
          connectToField: "parent_id",
          as: "ancestors",
          depthField: "depth",
        },
      },
      {
        $project: {
          depth: { $size: "$ancestors" },
        },
      },
      {
        $group: {
          _id: null,
          maxDepth: { $max: "$depth" },
        },
      },
    ];
    result = await ins!.aggregate(dbname, LimitColl.Dept, pip);
  } catch (e) {
    msg = "getDeptMaxLevel:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: [],
    count: result[0].maxDepth + 1,
    msg: msg,
  });
}

async function getParentDept(request, response) {
  const reqparam: FindOption = await request.qbJson();
  let result: any = [];
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    const filter = reqparam.filter;
    let currDeptId = filter._id;
    let level = 1;
    while (currDeptId) {
      const currentDept = await await ins!.findOne(
        dbname,
        LimitColl.Dept,
        { _id: currDeptId },
        {}
      );
      if (!currentDept) {
        break;
      }
      result.push({ ...currentDept, level });
      // If no parent node or parent_id is null, end the loop
      if (!currentDept.parent_id) {
        break;
      } else {
        currDeptId = currentDept.parent_id;
        level = level + 1;
      }
    }
  } catch (e) {
    msg = "getParentDept:" + e;
    logger.error(msg);
  }

  await response.qbJson({
    data: result,
    count: 1,
    msg: msg,
  });
}

async function getDept(request, response) {
  const collName = LimitColl.Dept;
  let reqparam: FindOption = await request.qbJson();
  let filter = reqparam.filter || {} as any;
  filter['en_id'] = request.en_id;
  const result = await findData(collName, filter, {});
  await response.qbJson(result);
}

async function insertDept(request, response) {
  const collName = LimitColl.Dept;
  let reqparam: InsertOption = await request.qbJson();
  const node = reqparam.docs[0];
  const result = await insertTreeNode(collName, node, request.en_id);
  await response.qbJson(result);
}

async function getEnInfo(request, response) {
  const collName = LimitColl.Enterprise;
  const result = await findOne(collName, { _id: request.en_id });
  if (result.data.length > 0) {
    result.data = [{
      ...result.data[0],
    }]
  }
  await response.qbJson(result);
}

async function updateEn(request, response) {
  const reqparam: UpdateOption = await request.qbJson();
  const collName = LimitColl.Enterprise;
  const filter = { _id: request.en_id };
  const update = { $set: reqparam.update };
  const options = reqparam.options || {};
  const result = await updateOne(collName, filter, update, options);
  await response.qbJson(result);
}

async function register(request, response) {
  let reqparam: M.Regiter = await request.qbJson();
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
    let enResult = await ins!.getCollections(dbname, { name: LimitColl.Enterprise }, {});
    if (!isEmpty(enResult)) {
      throw new Error('Enterprise has been registered, please do not register again');
    }
    // Enterprise
    let en = reqparam.en;
    let insEnResult = await ins.insertOne(dbname, LimitColl.Enterprise, en, {});
    // Department
    let dept: M.Dept = {
      en_id: insEnResult.insertedId.toString(),
      name: en.name,
      manager: [], // Department managers
      parent_id: null,
      suf_id: null, // Suffix node _id, used for sorting;
    };
    let insDeptResult = await ins.insertOne(dbname, LimitColl.Dept, dept, {});
    // Account
    let acc: M.Account = reqparam.acc;
    acc.createAt = new Date();
    acc.updateAt = new Date();
    acc.en_ids = [insEnResult.insertedId];
    let insAccResult = await ins.insertOne(dbname, LimitColl.Account, acc, {});
    result = {
      acknowledged: insAccResult.acknowledged,
      insertedCount: insAccResult.acknowledged ? 1 : 0,
      insertedIds: [insAccResult.insertedId],
      insertedUids: [],
    };
    // Account extension
    let accEn: M.AccountEn = {
      acc_id: insAccResult.insertedId, // Account association: account._id == accountEn.acc_id
      en_id: insEnResult.insertedId.toString(),
      dept: [{ _id: insDeptResult.insertedId.toString(), name: en.name }],
      role: [],
    };
    let insAccEnResult = await ins.insertOne(
      dbname,
      LimitColl.AccountEn,
      accEn,
      {}
    );
    // Admin group: enterprise creator
    let adGroup: M.AdminGroup = {
      en_id: insEnResult.insertedId.toString(),
      name: "Enterprise Creator",
      type: "creator",
      member: [{ _id: insAccResult.insertedId.toString(), name: acc.name }],
    };
    // Admin group: system admin group
    let superGroup: M.AdminGroup = {
      en_id: insEnResult.insertedId.toString(),
      name: "System Admin Group",
      type: "super",
      member: [],
    };
    let creatorAdGroupResult = await ins.insertOne(
      dbname,
      LimitColl.AdminGroup,
      adGroup,
      {}
    );
    let superAdGroupResult = await ins.insertOne(
      dbname,
      LimitColl.AdminGroup,
      superGroup,
      {}
    );
  } catch (e: any) {
    msg = e.message;
    logger.error('register error:' + e);
  }

  await response.qbJson({
    data: result,
    msg: msg,
  });
}

async function login(request, response) {
  let reqparam = await request.qbJson();
  // Password encryption
  let filter = {};
  filter[LoginFildMap[reqparam.loginNameField]] = reqparam.loginName;
  filter["active"] = true;
  filter["onJob"] = true;

  let msg: string = "ok";
  let dbname = getMainDBname();
  let currAcc;
  let token = "";
  try {
    const ins = await Mongo.getInstance();
    currAcc = await ins!.findOne(dbname, LimitColl.Account, filter, {});
    if (currAcc) {
      // Verify password
      let pwd = currAcc.password;
      if (isBcrypt(pwd)) {
        const checkPwd = await checkHashPwd(reqparam.loginPwd, pwd);
        if (!checkPwd) throw new Error("Incorrect password!");
      } else {
        if (pwd != reqparam.loginPwd) throw new Error("Incorrect password!");
        // Password verified, encrypt password
        const hash = await getHashPwd(pwd);
        ins!.updateOne(
          dbname,
          LimitColl.Account,
          { _id: currAcc._id },
          { $set: { password: hash } },
          {}
        );
      }

      // Account association: account._id == accountEn.acc_id
      let resultEn = await ins!.find(
        dbname,
        LimitColl.AccountEn,
        { acc_id: currAcc._id },
        {}
      );
      let resultAg = await ins!.find(
        dbname,
        LimitColl.AdminGroup,
        { "member._id": currAcc._id.toString() },
        {}
      );

      // Enterprise id needs to be selected by the client after login or default to the first one, here we default to the first one,
      const currEnId = currAcc.en_ids[0];
      let payload = {
        account: {
          _id: currAcc._id,
          name: currAcc.name,
          loginName: currAcc.loginName,
          dept: resultEn ? resultEn[0].dept : [],
          role: resultEn ? resultEn[0].role : [],
          avatar: currAcc.avatar,

          adminGroup: resultAg
            ? unique(resultAg.map((ag: any) => ag.type))
            : [], // { _id, type } ; creator / super / system
        },
        en_id: currEnId, // After enabling multi-enterprise, usually after login, it can be determined after selecting the login enterprise;
      };
      // Can use custom conversion method instead of JSON.parse(JSON.stringify(payload))
      token = await generateToken(JSON.parse(JSON.stringify(payload)));
      const ua = new UAParser(request.headers["user-agent"]).getResult();
      // After enabling multi-enterprise, logs should be recorded after selecting the enterprise to associate logs with enterprise id;
      const loginLog: M.LoginLog = {
        acc_id: currAcc._id,
        login: reqparam.loginName,
        name: currAcc.name,
        avatar: currAcc.avatar,
        ip: request.ip,
        os: ua.os.name || "",
        osVersion: ua.os.version || "",
        browser: ua.browser.name || "",
        browserVersion: ua.browser.version || "",
        device: ua.device.type || "desktop",
        en_id: currEnId,
        logAt: new Date(),
      };
      await ins!.insertOne(
        dbname,
        LimitColl.LoginLog,
        loginLog,
        {}
      );
    } else {
      msg = "Account or password error!";
    }
  } catch (e: any) {
    msg = "Login failed:" + e.message;
    logger.error(msg);
  }

  await response.qbJson({
    token: token,
    msg: msg,
  });
}

async function getAccountInfo(request, response) {
  let reqparam = await request.qbJson();
  // Default to current account _id
  let accountId = request.account._id;
  // If _id is passed, use the passed value
  if (reqparam._id) {
    accountId = reqparam._id;
  }
  let resultAcc: any = null
  let msg: string = "ok";

  try {
    const ins = await Mongo.getInstance();
    const dbname = getMainDBname();
    let filter = {};
    // If filter conditions are passed, do not use _id parameter;
    if (reqparam.filter) {
      filter = reqparam.filter;
    } else {
      filter = { _id: accountId };
    }
    let pip = [
      {
        $match: filter,
      },
      {
        $lookup: {
          from: LimitColl.AccountEn, // Collection name to join
          localField: "_id", // Field from the input documents
          foreignField: "acc_id", // Field from the documents of the "from" collection
          as: "extAccount", // Output array field
        },
      },
      {
        $unwind: {
          path: "$extAccount",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          phone: 1,
          email: 1,
          avatar: 1,
          en_ids: 1,
          dept: "$extAccount.dept",
          role: "$extAccount.role",
          en_id: "$extAccount.en_id",
        },
      },
    ];
    resultAcc = await ins!.aggregate(dbname, LimitColl.Account, pip);
    const resultEn = await ins!.findOne(
      dbname,
      LimitColl.Enterprise,
      { _id: request.en_id },
      {}
    );
    if (resultEn && resultAcc.length == 1) {
      resultAcc[0]["en_name"] = resultEn.name;
    }
  } catch (e: any) {
    msg = e.message;
    logger.error("getAccountInfo:" + e);
  }

  await response.qbJson({
    data: resultAcc,
    count: 1,
    msg: msg,
  });
}

export default metaRouter;



