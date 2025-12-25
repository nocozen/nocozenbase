/**
 * This file implements data synchronization functionality for NocoZenBase.
 * It provides methods for synchronizing data between forms based on configurable rules,
 * including data mapping, filtering, and conditional execution.
 * 
 */
import { Job } from "@pulsecron/pulse";
import * as M from "../types/meta.js";
import Mongo from "../api/mongo/mongoDB.js";
import { getMainDBname, insertOneBiLog } from "./coreApi.js";
import { LimitColl, EventType, MapRulePilotOpt, Operators, ElTypeGroup } from "../types/enum.js";
import { RulePilot, Rule } from "rulepilot";
import { logger } from "../utils/logger.js";
import createMapper from 'map-factory';
import uidv1 from "../utils/uid/index.js";

const maxDataSyncNumer = 100;   // Maximum limit for batch data sync modifications and deletions

// map-factory configuration
const options = {
  // true: a transform will always be called even if the source value was not available on the source object.
  // false: a transform will only be called if the source value was available on the source object.
  alwaysTransform: true,
  // true: nested structure will be created even if the source value was not available on the source object.
  // false: structure will only be create if the source value was available on the source object.
  alwaysSet: true,
};

// todo: cache optimization
async function getMapper(config: Array<M.ConditionConfig>) {
  // Create mapper instance
  const mapper = createMapper(options);
  // Configure mapping rules
  for (let condit of config) {
    let targetField = condit.preFieldName;
    let sourceField = condit.valueFieldValue;
    if (condit.preParentName) {
      targetField = `${condit.preParentName}[].${condit.preFieldName}`;
    }
    if (condit.valueType == 'bind') {
      sourceField = condit.valueFieldValue;
      if (condit.valueParentName) {
        sourceField = `${condit.valueParentName}[].${condit.valueFieldValue}`;
      }
      if (sourceField) {  // If empty, mapping would assign the entire object;
        mapper.map(sourceField).to(targetField);
      }
    } else {
      // Null values cannot be mapped; if necessary, add null value fields after mapping;
      mapper.set(targetField, sourceField);
    }
  }

  return mapper;
}


interface Condition {
  field: string,
  operator: string,
  value: any
}

// Generate trigger condition rules
async function mapRule(combiType: string, triggerCondition: Array<M.ConditionConfig>) {
  // Generate rule;
  const ruleCondition = [] as any;    // Array for all or any conditions
  for (let cd of triggerCondition) {
    let condit: Condition = {} as any;
    let field = cd.preFieldName;  // Default;

    // Generate value rules based on field type
    if (ElTypeGroup.objectTypes.includes(cd.preFieldType as any)) { // Object type
      field = cd.preFieldName + '.name';
    } else if (ElTypeGroup.arrayTypes.includes(cd.preFieldType as any)) { // Multi-select array type 
      field = `map(${cd.preFieldName}, $.name)`;
    }

    // Operators supported by rulePilot
    if (MapRulePilotOpt[cd.operator]) {
      condit = {
        field: cd.preFieldName + '.name',   // Handle nested objects!!!
        operator: MapRulePilotOpt[cd.operator],
        value: cd.valueFieldValue // Trigger condition only has custom values, no binding type; type restrictions handled in UI;
      }
    } else if ([Operators.Null, Operators.NotNull].includes(cd.operator as any)) {
      // Handle null and not null conditions; (Range, Dynamic not supported yet);
      condit = {
        field: cd.preFieldName,
        operator: Operators.Null == cd.operator ? '==' : '!=',
        value: null   // Trigger condition only has custom values, no binding type;
      }
    } else {
      return null;
    }
    ruleCondition.push(condit);
  }

  let combiTypeName = combiType == 'and' ? 'all' : 'any';
  // Currently only one condition group is used; all/any won't be used simultaneously; extendable later;
  const rule: Rule = {
    conditions: [
      {
        [combiTypeName]: ruleCondition,
      }
    ],
    default: false  // When all condition groups are not met or empty []
  }
  return rule;
}

/**
 * Trigger condition validation: form data => configuration => validation result: true | false
 * Validate conditions one by one: any - ends when one condition matches; all - all conditions must match
 * @param {string} combiType - Combination type: 'and' or 'or'
 * @param {Array<M.ConditionConfig>} triggerCondition - Array of trigger conditions
 * @param {M.BiDataLog} biLog - BI data log containing trigger data
 * @returns {Promise<boolean>} - Validation result
 */
async function checkTriggerCondition(combiType: string, triggerCondition: Array<M.ConditionConfig>, biLog: M.BiDataLog) {
  if (triggerCondition.length == 0) return true;  // Return true when no conditions are specified;

  // All: return false if any condition fails; Any: return true if any condition matches;
  const rule = await mapRule(combiType, triggerCondition);
  const data = biLog.triggerType == 'delete' ? biLog.oldDoc : biLog.newDoc;

  try {
    const result = await RulePilot.evaluate<boolean>(rule!, data);
    return result;
  } catch (e: any) {
    logger.error(e)
    return false;
  }

}

async function mapObject(updateFilter: Array<M.ConditionConfig>, newDoc: any) {
  const filterMap = await getMapper(updateFilter);
  const filterObj = filterMap.execute(newDoc);
  const filter = Object.entries(filterObj).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      // Handle two-level array structure
      return value.flatMap((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // Expand array element properties and add prefix
          return Object.entries(item).map(([subKey, subValue]) => ({
            [key + '.' + subKey]: subValue
          }));
        }
        return { [`${key}[${index}]`]: item };
      });
    }
    return { [key]: value };
  })
  // Default object doesn't need conversion (and format: $and: [ {}, {} ]);
  // or format: $or: [ {}, {} ]
  return filter;
}

async function mapRelation(updateFilter: Array<M.ConditionConfig>, newDoc: any) {
  const relationMap = await getMapper(updateFilter);
  const relationObj = relationMap.execute(newDoc);
  return relationObj;
}

/**
 * Form filtering: target form data => filter configuration => filter result array
 * @param {string} combiType - Combination type: 'and' or 'or'
 * @param {Array<M.ConditionConfig>} updateFilter - Array of filter conditions
 * @param {any} newDoc - New document data to filter
 * @returns {Promise<any>} - Filter result object
 */
async function mapFilter(combiType: string, updateFilter: Array<M.ConditionConfig>, newDoc: any) {
  // Default objects don't need conversion (and format: $and: [ {}, {} ]);
  // or format: $or: [ {}, {} ]
  const filter = await mapObject(updateFilter, newDoc);
  let result = {} as any;
  if ('or' == combiType) {
    result = { $or: filter }
  } else {
    result = { $and: filter }
  }
  return result;
}

async function syncLog(collName: string, type: 'add' | 'edit' | 'delete', en_id: string, oldDoc: any, newDoc: any) {
  // Write data log
  const logOption = {
    collName,
    type: type,
    account: { _id: 'system', name: 'System' },
    en_id: en_id,
    // Temporarily not saving old data for modifications to avoid rapid data growth, especially for nested fields; can be configured later;
    oldDoc: type == 'delete' ? oldDoc : null,
    newDoc: newDoc
  }
  // Record data sync in current target collection log
  const logResult = await insertOneBiLog(logOption);
}


async function dataToUpdate(collName: string, filter: any, data: Record<string, any>, relation: any) {
  let dbname = getMainDBname();
  const ins = await Mongo.getInstance();
  const updateCmd = {} as any; // $set content
  const arrayFilters: Record<string, any>[] = [];

  Object.entries(data).forEach(([key, value]) => {
    // Handle array nested objects
    if (Array.isArray(value)) {
      const fieldRelation = relation[key];

      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const elemIdentifier = `element${index}`;
          const matchCondition: Record<string, any> = {};
          let hasMatchFields = false;
          Object.entries(item).forEach(([nestKey, nestValue]) => {
            updateCmd[`${key}.$[${elemIdentifier}].${nestKey}`] = nestValue;
          })
          Object.entries(fieldRelation[index]).forEach(([relationKey, relationvalue]) => {
            matchCondition[`${elemIdentifier}.${relationKey}`] = relationvalue;
            hasMatchFields = true;
          })

          if (hasMatchFields) {
            arrayFilters.push(matchCondition);
          }
        }
      });
    } else {
      updateCmd[key] = value;
    }
  });

  updateCmd['updateAt'] = new Date();
  const update = { $set: updateCmd };
  const options = { arrayFilters: arrayFilters };

  const updateResult = await ins.update(dbname, collName, filter, update, options);
  return updateResult;
}

async function dataToPush(collName: string, filter: any, relation: any, updateDoc: any) {
  // Compare old and new data based on relation configuration: insert new data additions;
  let dbname = getMainDBname();
  const ins = await Mongo.getInstance();
  for (let [nestKey, value] of Object.entries(relation)) {
    const mapIn = {} as any;
    Object.keys((value as Array<any>)[0]).forEach((k: string) => {
      mapIn[k] = "$$item." + k
    })
    const project = {
      $project: {
        unmatched: {
          $setDifference: [
            value,
            {
              $map: {
                input: "$" + nestKey,
                as: "item",
                in: mapIn
              }
            }
          ]
        }
      }
    }
    const pip = [
      { $match: filter },
      project
    ]
    const findResult = await ins.aggregate(dbname, collName, pip);
    if (findResult.length > 0) {
      for (let result of findResult) {
        // Insert
        let docs: Array<any> = updateDoc[nestKey];  // Add uid, filter unchanged data;
        const newDoc = docs.map(item => {
          const matchedItem = result.unmatched?.find(filterItem =>
            Object.keys(filterItem).every(key =>
              filterItem[key] === item[key]
            )
          );
          if (matchedItem) {
            return {
              uid: uidv1.NextNumber(),
              ...item
            }
          }
        }).filter(Boolean); 
        // Execute push to insert data
        const update = { $addToSet: { [nestKey]: { "$each": newDoc } } };
        const idFilter = { _id: result._id }
        const pushResult = await ins.updateOne(dbname, collName, idFilter, update, {});
        console.log(pushResult)
      }
    }
  }

}

async function execDataSync(config: M.DataSync, biLog: any) {
  let dbname = getMainDBname();
  const ins = await Mongo.getInstance();
  const collName = config.updateConfig.collName;
  // Execute mapping
  // Sync types are divided into three cases
  if (EventType.Add == config.updateAction) {
    // Add: generate new document;
  // Null values cannot be mapped; if necessary, add null value fields after mapping;
    const mapper = await getMapper(config.addFieldMap)
    const targetDoc = mapper.execute(biLog.newDoc);
    const meta = {
      complatedState: 'confirmed',
      createBy: biLog.newDoc?.createBy,
      createAt: new Date(),
      updateAt: new Date(),
      en_id: biLog.newDoc?.en_id,
    }
    const syncDoc = {
      ...targetDoc,
      ...meta
    }
    if (collName) {
      const insertResult = await ins.insertOne(dbname, collName, syncDoc, {});
      if (insertResult.insertedId) {
        // Write data log
        await syncLog(collName, config.updateAction, biLog.newDoc?.en_id, null, syncDoc);
      } else {
        logger.info('Data sync insertion failed: ' + JSON.stringify(config));
      }
    }

  } else if (EventType.Edit == config.updateAction) {
    // Default: only update nested fields;
    // Selecting [Associate No Match Add] won't add nested details that can't be associated;
    // If multiple nested fields need separate upsert configuration, currently only new independent sync operations can be added;
    // Batch modification limit maxDataSyncNumer: 100 records, exceeding won't be executed;
    // Edit: generate update filter and update data
    const filter = await mapFilter(config.updateFilterCombiType, config.updateFilter, biLog.newDoc);
    const relation = await mapRelation(config.editRelation, biLog.newDoc);

    if (collName) {
      const countAll = await ins.count(dbname, collName, filter, {});
      // Exceeding maximum limit will not be processed
      if (countAll < maxDataSyncNumer) {

        // Association conditions apply when 1-1 modification is needed but there are multiple targets or sources:
    // 1-n: when only one record needs modification; n-n: when nested details need to specify association fields
        const mapper = await getMapper(config.updateFieldMap)
        const updateDoc = mapper.execute(biLog.newDoc);
        // Add nested data that doesn't match association conditions; must execute before update
        // Otherwise, updating association field values will cause duplicate insertions;
        if (config.nestUpsert) {    // todo: unified configuration for all associations, extendable to independent configuration later
          // Add nested data that doesn't match association conditions
          const pushResult = await dataToPush(collName, filter, relation, updateDoc);
        }
        console.log(collName, filter, updateDoc, relation)
        // Must execute after push, otherwise updating fields containing association fields will cause duplicate insertions
        const updateResult = await dataToUpdate(collName, filter, updateDoc, relation);
        // Query all updated records' _id, then log each one
        const findAll = await ins.find(dbname, collName, filter, { projection: { _id: 1 } });
        if (updateResult) {
          // Temporarily not saving old data for modifications to avoid rapid data growth, especially for nested fields; can be configured later;
          for (let doc of findAll) {
            // Write data log
            const newDoc = { ...biLog.newDoc, ...updateDoc }   // Merge oldDoc and update
            const en_id = biLog.newDoc?.en_id;
            await syncLog(collName, config.updateAction, en_id, null, newDoc);
          }
        } else {
          logger.info('Data sync update failed: ' + JSON.stringify(config));
        }
      }
    }
  } else if (EventType.Delete == config.updateAction) {
    // Batch deletion limit maxDataSyncNumer: 100 records, exceeding won't be executed;
    // Delete: needs filter: { _id }; has independent data operation logs, can delete directly;
    const filter = await mapFilter(config.updateFilterCombiType, config.updateFilter, biLog.oldDoc);
    if (collName) {
      const findAllDel = await ins.find(dbname, collName, filter, {});
      // Exceeding maximum limit will not be processed
      if (findAllDel.length < maxDataSyncNumer) {
        // Delete and record data logs;
        const delResult = await ins.deleteMany(dbname, collName, filter, {});
        if (delResult.acknowledged) {
          for (let doc of findAllDel) {
            // Write data log
            await syncLog(collName, config.updateAction, biLog.oldDoc?.en_id, doc, null);
          }
        } else {
          logger.info('Data sync deletion failed: ' + JSON.stringify(config));
        }
      }
    }
  }
}

/**
 * Synchronization principles:
 * - Data production source is responsible for synchronizing to all consumers; cascading data sync is not supported
 * - Cross-application data sync is not supported, but data sharing can be achieved through cross-application shared forms
 * - Reasoning: Applications should maintain independence and can be deleted independently
 * 
 * @param {Job<{ collName: string, biLog: M.BiDataLog }>} job - Pulse job containing sync data
 * @returns {Promise<void>} - No return value
 */
export async function dataSync(job: Job<{ collName: string, biLog: M.BiDataLog }>) {
  // Get form metadata and sync configuration by collName;
  const triggerCollName = job.attrs.data.collName;
  if (!triggerCollName) return;
  const biLog = job.attrs.data.biLog;
  const ins = await Mongo.getInstance();
  let dbname = getMainDBname();
  const nameFilter = { 'formConfig.collName': triggerCollName }
  const configResult = await ins.findOne(dbname, LimitColl.ModuleConfig, nameFilter, {});

  if (configResult && configResult.dataSync?.length > 0) {
    const dataSync: Array<M.DataSync> = configResult.dataSync;
    // Process data sync configurations in loop;
    for (let config of dataSync) { // Parse configuration and generate query
      // Check if trigger timing matches and trigger conditions are met;
      // Determine if conditions are met based on trigger conditions and current data;
      const checkTrigger = await checkTriggerCondition(config.triggerConditCombiType, config.triggerCondition, biLog);
      // Execute [enabled] syncs; modify fields to [disable] all syncs; re-[enable] to validate configuration;
      if (config.enable && config.triggerAction.includes(biLog.triggerType) && checkTrigger) {    // Multiple trigger timings allowed
        try {
          await execDataSync(config, biLog);
        } catch (e: any) {
          logger.error('Data sync error: ' + e);
          logger.error('Data sync configuration: ' + JSON.stringify(config));
        }
      }
    }
  }
}