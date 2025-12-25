const enum WebPath {
  ResetSequence = '/resetSequence',
  GetCurrSequence = '/getCurrSequence',
  GetConfigBy = '/getConfigBy',
  Register = '/register',
  Login = '/login',
  GetAccInfo = '/getAccInfo',
  GetAppModules = '/getAppModules',
  InsertAppNode = '/insertAppNode',
  InsertModuleNode = '/insertModuleNode',
  GetAppList = '/getAppList',
  FindAppNode = '/findAppNode',
  UpdateAppOrder = '/updateAppOrder',
  MarkAppDelete = '/markAppDelete',
  MarkModuleDelete = '/markModuleDelete',
  UpdateAppHome = '/updateAppHome',
  EditAppNode = '/editAppNode',
  EditModuleNode = '/editModuleNode',
  UpdateModuleNode = '/updateModuleNode',
  UpdateModuleOrder = '/updateModuleOrder',
  UpdateModuleConfig = '/updateModuleConfig',
  GetModuleConfig = '/getModuleConfig',
  GetAllModuleConfig = '/getAllModuleConfig',
  InsertBusiData = '/insertBusiData',
  UpdateBusiData = '/updateBusiData',
  DeleteBusiData = '/deleteBusiData',
  FindBusiData = '/findBusiData',
  BulkWrite = '/bulkWrite',
  FindAllFlowTasks = '/findAllFlowTasks',
  UpdateFlowInstance = '/updateFlowInstance',
  InitFlowInstance = '/initFlowInstance',
  FindAllFlowEnabled = '/findAllFlowEnabled',
  GetAccountsBy = '/getAccountsBy',
  UpdateEn = '/updateEn',
  GetEnInfo = '/getEnInfo',

  GetDept = '/getDept',
  InsertDept = '/insertDept',
  UpdateDeptOrder = '/updateDeptOrder',
  DeleteDept = '/deleteDept',

  GetRole = '/getRole',
  InsertRole = '/insertRole',
  UpdateRoleOrder = '/updateRoleOrder',
  DeleteRole = '/deleteRole',
  UpdateDeptName = '/updateDeptName',
  UpdateRoleName = '/updateRoleName',
  SetDeptManager = '/setDeptManager',
  GetParentDept = '/getParentDept',
  GetDeptMaxLevel = '/getDeptMaxLevel',

  NewAccount = '/newAccount',
  UpdateAccountEn = '/updateAccountEn',
  UpdateAccount = '/updateAccount',

  GetPermGroupCount = '/getPermGroupCount',
  NewPermGroup = '/newPermGroup',
  UpdatePgOrder = '/updatePgOrder',
  UpdatePermGroup = '/updatePermGroup',
  DeletePermGroup = '/deletePermGroup',
  GetPermGroups = '/getPermGroups',

  GetAdminGroups = '/getAdminGroups',
  UpdateAdminGroup = '/updateAdminGroup',
  NewAdminGroup = '/newAdminGroup',
  DeleteAdminGroup = '/deleteAdminGroup',
  UpdateAgOrder = '/updateAgOrder',

  GetFileMeta = '/getFileMeta',
  UploadGfs = '/uploadGfs'
}

enum AuditApi {
  insertAppNode = 'Add Application',
  insertModuleNode = 'Add Module',
  updateAppOrder = 'Update Application Order',
  markAppDelete = 'Delete Application',
  markModuleDelete = 'Delete Module',
  updateAppHome = 'Update Application Home',
  editAppNode = 'Edit Application Node',
  editModuleNode = 'Edit Module Name, Icon and Others',
  updateModuleNode = 'Update Module Export References and Others',
  updateModuleOrder = 'Update Module Order',
  updateModuleConfig = 'Update Module Configuration',
  insertBusiData = 'Insert Business Data',
  updateBusiData = 'Update Business Data',
  DeleteBusiData = 'Delete Business Data',
  updateFlowInstance = 'Update Flow Instance',
  updateEn = 'Update Enterprise Information',

  insertDept = 'Add Department',
  updateDeptOrder = 'Update Department Order',
  deleteDept = 'Delete Department',

  insertRole = 'Add Role',
  updateRoleOrder = 'Update Role Order',
  deleteRole = 'Delete Role',
  updateDeptName = 'Update Department Name',
  updateRoleName = 'Update Role Name',
  setDeptManager = 'Set Department Manager',

  newAccount = 'Add User',
  updateAccountEn = 'Update Account Extension Information',
  updateAccount = 'Update Account Information',

  newPermGroup = 'Add Permission Group',
  updatePgOrder = 'Update Permission Group Order',
  updatePermGroup = 'Update Permission Group',
  deletePermGroup = 'Delete Permission Group',

  updateAdminGroup = 'Update Admin Group',
  newAdminGroup = 'Add Admin Group',
  deleteAdminGroup = 'Delete Admin Group',
  updateAgOrder = 'Update Admin Order',
}

enum LimitColl {
  // Synchronization tasks
  JOBS = '_mc_601697328735115',
  Sequence = '_mc_601697328735116',

  Enterprise = '_mc_601697328735217',
  Account = '_mc_601697328735219',
  AccountEn = '_mc_601697328735221',
  AdminGroup = '_mc_601697328735223',

  Dept = '_mc_611697328735225',
  Role = '_mc_611697328735227',
  App = '_mc_611697328735229',
  ModuleNode = '_mc_611697328735231',
  ModuleConfig = '_mc_611697328735233',

  FlowInstance = '_mc_621697328735235',

  ModulePermGroup = '_mc_621697328735237',    // Permission group

  LoginLog = '_mc_621697328735239',    // Login logs
  DataSyncLog = '_mc_621697328735241',  // Data synchronization logs
  MetaEditLog = '_mc_621697328735245'   // Metadata table add, modify, delete logs;

}

// Supports inconsistent login collection fields and login parameters;
const LoginFildMap = {
  'loginName': 'loginName',
  'name': 'name',
  'phone': 'phone',
  'email': 'email',
  'password': 'password'
}

const enum Mark {
  Delete = 'delete',    // Record soft delete mark, suf_id, parent_id field mark
}

// 'active' | 'complete' | 'cancel' | 'revoke' | 'reject'
const enum FlowStauts {
  Active = 'active',      // [Active]
  Complete = 'complete',  // [Complete] [End flow]
  Cancel = 'cancel',      // [Cancel] [End flow]
  Withdraw = 'withdraw',  // [Withdraw] [End flow] Can withdraw before approval starts
  Reject = 'reject',      // [Reject] [End flow]
  Abort = 'abort',        // [Abort] Exceptional interruption, e.g., approver not found, can be reactivated after admin reassigns approver;
}

const enum ComplatedState {
  Draft = 'draft',
  Review = 'review',
  Confirmed = 'confirmed',
  Cancel = 'cancel'
}

const enum EventType {
  Add = 'add',
  Edit = 'edit',
  Delete = 'delete',

  FlowComplete = 'flow-complete'
}

const enum TaskName {
  DataSync = 'DataSync',    // Data synchronization task
}

// Comparison condition operators
const enum Operators {  // Maps rulepilot operators
  Equal = 'equal',              // Equal  [rulepilot] ==
  NotEqual = 'notEqual',        // Not equal  [rulepilot] !=

  GreaterThan = 'greaterThan',   // Greater than  [rulepilot] >
  LessThan = 'lessThan',        // Less than  [rulepilot] <
  GreaterThanOrEqual = 'greaterThanOrEqual', // Greater than or equal  [rulepilot] >=
  LessThanOrEqual = 'lessThanOrEqual',       // Less than or equal  [rulepilot] <=

  EqualAny = 'equalAny',        // Equal any  [rulepilot] in
  NotEqualAny = 'notEqualAny',  // Not equal any  [rulepilot] not in
  Includes = 'includes',        // Includes  [rulepilot] contains
  IncludesAny = 'includesAny',  // Includes any  [rulepilot] contains any
  NotIncludes = 'notIncludes',  // Not includes  [rulepilot] not contains
  NotIncludesAny = 'notIncludesAny',  // Not includes any  [rulepilot] not contains any

  Matches = 'matches',          // Regular match  [rulepilot]
  NotMatches = 'notMatches',    // Regular not match  [rulepilot]

  Null = 'null',                // Empty
  NotNull = 'notNull',          // Not empty
  Range = 'range',              // Value range
  Dynamic = 'dynamic',          // Dynamic value
}

const MapRulePilotOpt: { [key: string]: string } = {
  [Operators.Equal]: '==',              // Equal  [rulepilot] ==
  [Operators.NotEqual]: '!=',        // Not equal  [rulepilot] !=

  [Operators.GreaterThan]: '>',   // Greater than  [rulepilot] >
  [Operators.LessThan]: '<',        // Less than  [rulepilot] <
  [Operators.GreaterThanOrEqual]: '>=', // Greater than or equal  [rulepilot] >=
  [Operators.LessThanOrEqual]: '<=',       // Less than or equal  [rulepilot] <=

  [Operators.EqualAny]: 'in',        // Equal any  [rulepilot] in
  [Operators.NotEqualAny]: 'not in',  // Not equal any  [rulepilot] not in
  [Operators.Includes]: 'contains',        // Includes  [rulepilot] contains
  [Operators.IncludesAny]: 'contains any',  // Includes any  [rulepilot] contains any
  [Operators.NotIncludes]: 'not contains',  // Not includes  [rulepilot] not contains
  [Operators.NotIncludesAny]: 'not contains any',  // Not includes any  [rulepilot] not contains any

  [Operators.Matches]: 'matches',          // Regular match  [rulepilot]
  [Operators.NotMatches]: 'notMatches',    // Regular not match  [rulepilot]

  // The following types are not supported by rulepilot
  [Operators.Null]: '',                // Empty [needs escape processing: == null]
  [Operators.NotNull]: '',          // Not empty [needs escape processing: != null]
  [Operators.Range]: '',              // Value range [needs escape processing: <= >=]
  [Operators.Dynamic]: '',          // Dynamic value [needs escape processing]
}

const enum FormElType {
  FeText = 'FeText',
  FeTextArea = 'FeTextArea',
  FeNumber = 'FeNumber',
  FeDatetime = 'FeDatetime',
  FeRadioGroup = 'FeRadioGroup',
  FeCheckboxGroup = 'FeCheckboxGroup',
  FeSelect = 'FeSelect',
  FeMulSelect = 'FeMulSelect',
  FeUserSelect = 'FeUserSelect',
  FeMulUserSelect = 'FeMulUserSelect',
  FeDeptSelect = 'FeDeptSelect',
  FeMulDeptSelect = 'FeMulDeptSelect',

  FeDivider = 'FeDivider',
  NestTabPane = 'NestTabPane',
  NestEditTable = 'NestEditTable',    // Editable NTable used for form entry
  NestViewTable = 'NestViewTable',

  FeImage = 'FeImage',
  FeAttachment = 'FeAttachment',
  FeAddress = 'FeAddress',
  FeButton = 'FeButton',
  FeDataSelect = 'FeDataSelect',
  FeSignature = 'FeSignature',
  FeSequenceId = 'FeSequenceId',
  FeMobileNumber = 'FeMobileNumber',

  Nest = 'Nest', // Can be used in charts, temporarily not enabled
}

// Component grouping
const ElTypeGroup = {
  simpleTypes: [
    FormElType.FeText,
    FormElType.FeTextArea,
    FormElType.FeNumber,
    FormElType.FeDatetime,
  ],
  // Multi-select array types
  arrayTypes: [
    FormElType.FeCheckboxGroup,
    FormElType.FeMulSelect,
    FormElType.FeMulUserSelect,
    FormElType.FeMulDeptSelect,
  ],
  objectTypes: [
    FormElType.FeRadioGroup,
    FormElType.FeSelect,
    FormElType.FeUserSelect,
    FormElType.FeDeptSelect,
  ],
  // Components whose values can be used for filtering
  filterTypes: [
    FormElType.FeText,
    FormElType.FeTextArea,
    FormElType.FeNumber,
    FormElType.FeDatetime,
    FormElType.FeRadioGroup,
    FormElType.FeCheckboxGroup,
    FormElType.FeSelect,
    FormElType.FeMulSelect,
    FormElType.FeUserSelect,
    FormElType.FeMulUserSelect,
    FormElType.FeDeptSelect,
    FormElType.FeMulDeptSelect,
  ],
  // Types that cannot be mapped in data synchronization
  notMapTypes: [
    FormElType.FeDivider,
    FormElType.FeButton,
    FormElType.Nest,
    FormElType.NestTabPane,
    FormElType.NestViewTable,
    FormElType.NestEditTable,
    FormElType.FeDataSelect
  ]
}

type MetaPrefixKeys = 'Coll' | 'Log' | FormElType; // Need to specifically define FormElType union type
// Mainly used to support: judging field types when server interfaces cannot obtain metadata;
// Already used: 1. Server mongodb interface [date] type processing; 2. Server serial number field identification
// Mapping for mongodb storage types: In principle, add component types, so that component type-storage type 1:1 correspondence can be achieved for easy expansion;
const MetaPrefix: Record<MetaPrefixKeys, string> =  {
  Coll: '_mc_',      // Collection name prefix  
  Log: '_lg_',  

  [FormElType.FeText]: '_tt_',
  [FormElType.FeTextArea]: '_ta_',
  [FormElType.FeNumber]: '_nb_',
  [FormElType.FeDatetime]: '_dt_',
  [FormElType.FeRadioGroup]: '_rd_',
  [FormElType.FeCheckboxGroup]: '_cb_',
  [FormElType.FeSelect]: '_st_',
  [FormElType.FeUserSelect]: '_us_',
  [FormElType.FeDeptSelect]: '_dp_',
  [FormElType.FeMulSelect]: '_ms_',
  [FormElType.FeMulUserSelect]: '_mu_',
  [FormElType.FeMulDeptSelect]: '_md_',

  [FormElType.NestEditTable]: '_et_',    // Editable NTable used for form entry
  [FormElType.NestViewTable]: '_vt_',

  [FormElType.FeImage]: '_ig_',
  [FormElType.FeAttachment]: '_am_',
  [FormElType.FeSignature]: '_sg_',

  [FormElType.FeAddress]: '_ad_',
  [FormElType.FeButton]: '_bt_',
  [FormElType.FeDataSelect]: '_ds_',
  [FormElType.FeSequenceId]: '_sq_',
  [FormElType.FeMobileNumber]: '_mn_',

  [FormElType.NestTabPane]: '_tp_',   // ?[No value type] [Useless] [Only to avoid compilation warnings]
  [FormElType.FeDivider]: '_dd_',    // [No value type] [Useless] [Only to avoid compilation warnings]
  [FormElType.Nest]: '_tp__et__vt_',    // [Useless] [Only to avoid compilation warnings]
} as const

export { 
  MetaPrefix,
  FlowStauts,
  FormElType,
  ElTypeGroup,
  Operators, 
  MapRulePilotOpt, 
  TaskName, 
  EventType, 
  AuditApi, 
  ComplatedState, 
  Mark, 
  LimitColl, 
  LoginFildMap, 
  WebPath 
}