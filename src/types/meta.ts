interface Regiter {
  en: Enterprise,
  acc: Account,
}

interface Base {
  _id?: any,
  name: string
}

interface NestBase {
  uid: number | undefined,
  name: string
}

interface EnBase {
  _id?: any,
  createAt?: Date,
  updateAt?: Date,
  en_id: string
}

interface Order {
  _id?: any,
  suf_id: string | null,   // Next node _id, used for sorting; soft delete marker: delete
}

interface Node extends Order {
  parent_id: string | null,   // Backup: used when adding group management;
}

interface ParamNode extends Node {
  dropPosition?: 'before' | 'inside' | 'after'
}


// Mainly used for additional fields in business table system
interface EnMeta extends EnBase {
  createBy?: AccBase,   // Form creator, flow initiator
}

interface Enterprise extends Base {
  logo?: any,   // Can store image source files
  // Other properties will be added later
  wbComps: Array<LayoutComp>, // provider needs to be compatible with vgl layout structure: LayoutNode: { uid: , layout: , hiddenItems: }

  createAt?: Date,
  updateAt?: Date,
}

interface AppNode extends Base, EnBase, Node {
  icon: string,
  iconColor: string,
  type: 'app' | 'app-group'
  home_id: Array<string> | null,     // Supports binding multiple app types to [Home] dashboard ids; when home==[] for normal users, the first menu item is loaded;
  dbName?: string     // Allows application module business data to specify database separately according to database sharding rules;
  imports?: Array<Base>,
}

interface ModuleNode extends Base, EnBase, Node {
  app_id: string | null,
  icon: string,
  iconColor: string,
  type: 'group' | 'form' | 'flow' | 'board'
  moduleConfig_id?: string | null,
}

interface LayoutNode {
  uid: number,    // Layout uid, used to support nested layouts
  layout: Array<LayoutItem>,
  hiddenItems?: Array<LayoutItem>,
  initFlag?: number,   // Update flag for monitoring
}

interface Tab {
  uid: number,
  name: string,
}

interface LayoutComp extends LayoutItem {
  config?: any,   // Extended configuration
  value?: any,    // Component instance values: text content, image arrays, module arrays
}

interface CompBase {
  nodeUid?: number,    // LayoutNode.uid top layer uid==0; first summarize groups, then process sequentially;
  i: string,        // 
  type: string,     // Component type
  title: string,

  nestUid?: Array<number>,  // Nested layout uid collection; when there are multiple, the order is consistent with tabs;
  tabs?: Array<Tab>,

  [key: string]: any;
  fieldValue?: any,     // Component input value; [Auxiliary field]
}

interface CompStyle {
  titleStyle?: any,
  bgStyle?: any,
}

interface ChartOptions extends CompStyle {
  legend?: any,
  tooltip?: any,
  label?: any,
}

interface DataBind {
  moduleConfig_id: string | null,
  collName: string | null,
  metaData: Array<any>
}

// Drop component basic properties
interface DropItem {
  key: string,
  label: string,
  type: 'bi-date' | 'bi-number' | 'bi-text',  // Field metadata type, equivalent to field classification, added bi prefix to distinguish from other types;
}

// Common axis configuration items
interface AxisDropItem extends DropItem {
  alias?: string,   // Display name
  // d3.js axis scale types, can dimension axes and metric axes be categorized?？;
  axisType?: 'band' | 'linear' | 'time' | 'pow' | 'log' | 'symlog' | 'ordinal' | 'point' | 'sequential' | 'diverging' | 'quantile' | 'threshold',
}

// Dimension field configuration
interface ChartDim extends AxisDropItem {
  sortFieldType: 'group' | 'dim'  // Compatible with old version: dimension fine-grained stacking
  sortType: "auto-sort" | "asc" | "desc" | "custom-sort",     // Only dimensions can be sorted; sorting provides all available fields;
  sortField: string,
  // Currently only dimension axes support date grouping types
  dateType?: any,     // Date grouping types: year-month-day year-month year year-quarter year-week | quarter month month-day week-number weekday day | hour-minute-second hour minute second | year-month-day-hour-minute-second year-month-day-hour year-month-day-hour-minute 
  dateFmType?: "dash" | "detail" | "slash"     // Date formats(x-x-x, year month day, x/x/x)
}

// Metric field configuration
interface ChartMetric extends AxisDropItem {
  numFormat?: {
    type: 'number' | 'percent',
    separator: boolean,
    decimal: number,
    unit: string,
  },    // Numeric format (number/percent, thousand separator, decimal places, suffix)
  aggType: "sum" | "avg" | "media" | "max" | "min" | "stdDevPop" | "variance" | "count",   // Median, standard deviation, variance
  filter: Filter | null,     // Statistical field filter configuration; detail field filtering is saved in compConfig.filter;
}

interface Filter {
  candition: 'and' | 'or',    // todo: Modify to: combinationType
  fieldName: string,
  fieldType: 'bi-text' | 'bi-number' | 'bi-date',
  operator: 'equal' | 'notEqual' | 'range',   // Can be expanded gradually as needed
  filerValue: Array<string | number>    // String type supports multiple strings; number and date support selection range: [minimum value, maximum value]
}

interface ChartFilter extends DropItem {
  filter: Filter | null
}

interface ChartComp extends CompBase {
  chartType?: string,
  dims?: Array<ChartDim>,
  metrics?: Array<ChartMetric>,
  filter?: Array<ChartFilter>,
  dataBind?: any,         // Module configuration _id; (whether to redundantly save fields? Synchronization is needed after redundancy;)
  options?: Array<ChartOptions>     // The first item of the array is [All] graph configuration; there are multiple configurations for mixed or multi-layer graphs;
}

interface Range {
  min: number,
  max: number
}

interface Relation {
  module_id: string,
  moduleConfig_id: string,
  collName: string,
  fieldName: Array<string> | string | null,   // Bound field
  sortFieldName: string | null,
  descSort: boolean,   // Default false
  addPerm?: boolean,     // Default false: controls the [Add] button in nested forms
}

interface ListItem {
  label: string,
  value?: string | number,
  color?: string,
  selected?: boolean,
}

// todo: Unify Filter type
interface CascadeFilter {
  comparison: string | null,
  filterFieldName: string | null,
  filterFieldType: string | null,
  triggerFieldName: string | null,
  triggerFieldType: string | null
}

interface FieldsMap {
  sourceField: string | null,
  sourceType: string | null,
  mapField: string | null,
  mapType: string | null
}

interface DividerStyle {
  color: string,      // hex | transparent
  textColor: 'default',   // If color has a value, set font: white
  textAlign: 'left' | 'center',
  lineType: 'solid' | 'dashed',
  lineWidth: string,
  shapeType: string,    // DividerShapes
}

interface SequenceRule {
  fixedString: string | null,
  dateString: string | null,
  counterLength: number,
  counterType: 'year' | 'month' | 'day' | 'never',
  subRuleOrder: Array<'fixedString' | 'dateString'>
}

interface FormComp extends CompBase {
  // fieldAlias?: string,   // Field Chinese name / label name
  fieldName: string,   // Auto-generated: _mf_1111111; structure: _mf_<i> 
  fieldType: 'String' | 'Number' | 'Boolean' | 'Date' | 'Array' | 'Object' | 'ObjectId' | 'Binary' | 'Null' | 'Regular' | 'Timestamp' | 'Decimal128',    // Storage mapping type

  selfColl?: boolean,       // false: current collection nesting, true: independent collection storage
  selfCollName?: string,    // Collection name when stored in independent collection: _mc_<i>

  showTitle?: boolean,      // Whether to show title
  placeholder?: string,     // Input placeholder text

  style?: DividerStyle | any,   // Divider style, can also be extended to other components

  formatType?: string,      // Text format, number format...
  formatValue?: string,     // For example: date type format string, regular expression string;
  lengthRange?: Range | null,      // String length range
  numberRange?: Range | null,      // Numeric value range
  memberRange?: any,        // Member selection range, corresponding to the object type design in the member selection dialog;
  dataLimit?: any,          // Date optional range: optional weekdays, earliest optional time, latest optional time
  decimalPlaces?: number | null,   // Decimal places

  listType?: 'custom' | 'relation' | 'cascade',   // relation: associated form data cascade: data linkage (trigger)
  listItems?: Array<ListItem>,   // Object array, objects store option settings, colors and other parameters
  selectRange?: Range | null,       // Optional quantity range
  listVertical?: boolean,   // Option list default vertical arrangement 
  relation?: Relation,      // Associated form
  // Data linkage implementation: events are triggered through Provider method bridging, and event parameters confirm whether it is a field input event that needs to be responded to;
  // Data linkage: after inputting the cascadeFieldName field in the current form, it triggers a query based on cascadeFilter to get bindFieldName from cascadeModule_id
  // Filter conditions required for cascade data linkage settings: input trigger field, current table filter field; depends on [relation]
  cascadeFilters?: Array<CascadeFilter>,  // {comparison, filterFieldName, triggerFieldName}
  mapFields?: Array<FieldsMap>,   // [Select Data] configuration [Data Linkage] mapping fields;
  mappedFieldNames?: Array<string>,    // Convenient for displaying binding icons [mark bound-select data component id] component fieldName; corresponds to mapFields binding

  controlRules?: Array<any>,  // Control rules configuration for display/hide, etc.
  canCustomItem?: boolean,    // Allow adding options during input

  defValue?: any,       // Default value
  defValueType?: 'custom' | 'cascade' | 'formula' | 'currentValue',   // Default value type, default: 'custom'; cascade: data linkage formula: formula editing
  formula?: any,                    // formula: formula configuration
  sequenceRule?: SequenceRule,

  required?: boolean,       // Required
  unique?: boolean,         // Unique

  // Field permissions
  viewPerm?: boolean,       // Visible
  editPerm?: boolean,       // Editable
}

interface CompConfig extends ChartComp, FormComp {


}

interface FormConfig {   // _id: saves form collection name _mc_111111 ; name: saves collection Chinese name
  collName?: string,     // Main form collection name _mc_111111 
  collAlias?: string,    // Main collection Chinese name / module name
  triggerType?: 'none' | 'update' | 'flow',   // none | update: concurrent sync, scheduled sync, sequential sync... | flow
  lablePlace: 'left' | 'top',
  lableWidth: number | 'auto',
  lableAlign: 'left' | 'right'
}

interface LayoutItem {
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
  type: string,
  hidden?: boolean,
  nestUid?: Array<number>,      // Contains layout uid, used to support nested layouts
  dragData?: any,   // Drag object parameter data
  event?: 'add' | null    //  Add component: new
}

interface FormLayoutConfig {
  layoutType: 'form' | 'board',   // 'form' | 'board'
  isEditable: boolean,
  draggable?: boolean,    // Solve nested table mouse event conflict in edit state
  layoutPadding: Array<number>,
  colNum: number,
  defCompWidth: number,
  defCompHeight: number,
  rowHeight: number,
  itemPadding: Array<number>,
  vglHeightPadding: number
}

// Common structure for dropdown list items
interface Option {
  label: string,
  value: string,
  type: string
}

// DynamicTagsOption only has label, value; need to be compatible, other properties are optional;
interface Tag {
  label: string,
  value: string,
  type?: 'dept' | 'role' | 'member' | 'dynamic' | 'dynamicHead',
  dynamicType?: 'dept' | 'member' | 'createBy',   // Dynamic field source component type
  avatar?: string,     // avatar | icon ... extended use
}

// 【Deprecated, use Tag】 Node owner/approver/candidate
// interface Candidate {
//   // Node owner/approver/candidate: department, role, member,
//   // Dynamic owner: [Flow initiator], [Member field], [Department field], supervisor: [Flow initiator/Applicant employee], [Direct/1/2/3.. level]
//   type: 'dept' | 'role' | 'member' | 'dynamic' | 'dynamicHead',
//   // Search ids for each type: department _id, role _id, member _id; corresponding field: _id
//   // Flow initiator/Member field/Department field/.../ corresponding field: fieldName   
//   value: string,    
// label: string,   // Display name // Flow initiator/Member field/Department field/.../ corresponding field: title
// }

interface FieldPerm {
  fieldType: string,
  fieldName: string,    // Field id
  // title: string,     // Field Chinese name [Deprecated], changed to be dynamically obtained from component configuration

  viewPerm: boolean,    // Read-only
  editPerm: boolean,     // Editable
  abstract?: boolean     // Show in summary

  children?: Array<FieldPerm>
}

// Approval comments
interface ApproveOpinion {
  showTitle: boolean,
  required: string,
  requiredOpts: Array<any>,   // Required selection: [Required for specified operations] needs to configure operation buttons;
  Presets: string,            // Preset values: agree, disagree...
  defValue: string            // Default value
  attachment?: any,           // Approval comment attachment
}

interface FlowNode {
  uid: number,
  name: string,
  type: 'start' | 'end' | 'send' | 'approve',   // NodeTypes
  x: number,
  y: number,

  // Approval types: joint sign, any sign, level-by-level sign, sequential sign, vote sign
  approveType?: 'jointSign' | 'orSign' | 'levleBySign' | 'orderSign' | 'voteSign',
  // Node owner/approver/candidate: department, role, member,
  // Dynamic owner: [Flow initiator], [Member field], [Department field], supervisor: [Flow initiator/Applicant employee], [Direct/1/2/3.. level]
  candidates?: Array<Tag>,    // Approval candidates
  orderSignEnd?: string,      // Approval endpoint department level, starting from top level: 1 ~ 10 levels; default uses department supervisor configured in node owner and traceable to top level;
  carbonCopy?: Array<Tag>,    // Carbon copy recipients, same configuration as dynamic owner;
  fieldPerm?: Array<FieldPerm>, // Field permissions: read-only, editable, summary
  // Approval operation button enable configuration: [Submit], send back, [Reject], save draft, [Add sign], [Transfer], end flow
  nodeOpt?: {
    sendBack: boolean,
    addSign: boolean,
    transfer: boolean,
    cancel: boolean,
    reject: boolean,
  },   // Enabled items are added to the array, disabled items are not included in the array; [Identifier] is translated to Chinese through TaskOpt enum class
  opinion?: ApproveOpinion | boolean,     // Approval comments
  sign?: { required: string, requiredOpts: Array<any> } | undefined,    // Signature

  hasLink?: boolean   // Not necessary, redundant, [Auxiliary]
}

// Flow chart drawing [Auxiliary] properties
interface FlowLinkExt extends FlowLink {
  sX?: number,
  sY?: number,
  tX?: number,
  tY?: number,
  titleWidth?: number,
  coord?: { sX: number, sY: number, tX: number, tY: number, sPos: string, tPos: string },
  pathD?: string,
  points?: Array<any>,
  polygonPoints?: string,
  arrowPoints?: string | null,
  titlePos?: { x: number, y: number },
}

interface Candition {
  fieldName: string | null,
  fieldType: string,
  comparison: string,
  value: any,
  logicalOpt: string
}

interface FlowLink {
  uid: number,
  name: string | null,
  sourceId: number,
  sourcePos: string,
  targetId: number,
  targetPos: string,

  canditions?: Array<Candition> | 'else',     // Default []
}

interface FlowDefinition {
  uid: number,
  verId: number, // Version number V<sequential increment>, associated with uid, version number is for display only; new flows use the latest version;
  nodes: Array<FlowNode>,
  links: Array<FlowLink>,
  enable: boolean,    // Currently enabled flow, only one version can be enabled;
}


interface ConditionConfig {
  combinationType: 'and' | 'or',
  preParentName?: string | null,   // NestEditTable component child elements need to attach parent component fieldName
  preFieldName: string,
  preFieldType: string,    // Component type FormElType,
  operator: string,   //'null' | 'equal' | 'notEqual' | 'range',   // Can be expanded gradually as needed
  valueParentName?: string | null, // NestEditTable component child elements need to attach parent component fieldName
  valueType: 'bind' | 'custom',
  valueFieldValue: any,    // valueType-bind: fieldName; valueType-custom: any
  valueFieldType: string | null  // Component type FormElType
}


interface DataSync extends NestBase {
  enable: boolean,    // Whether to enable
  triggerType: 'form' | 'schedule' | 'http' | 'button',   // Trigger condition: form, schedule, http, button;
  triggerForm: string | undefined,  // Form _id
  triggerConfig: any,   // Form | trigger time, frequency, etc.
  triggerAction: ['add' | 'edit' | 'delete' | 'flow-complete'],     // [Add], [Edit], [Delete]
  triggerConditCombiType: 'and' | 'or',
  triggerCondition: Array<ConditionConfig>,  // Trigger condition
  updateForm: string | undefined,     // Sync form _id
  updateConfig: any,      // Update form...
  updateAction: 'add' | 'edit' | 'delete',     // [Add], [Edit], [Delete]
  updateFilterCombiType: 'and' | 'or',
  updateFilter: Array<ConditionConfig>,      // Filter condition (data to be updated)
  upsert: boolean,     // Whether to add when data is not found, etc.
  addFieldMap: Array<ConditionConfig>,           // Field mapping for adding
  updateFieldMap: Array<ConditionConfig>,           // Field mapping for updating
  editRelation: Array<ConditionConfig>       // Association matching when modifying multiple items; need to set for many-to-many modification (e.g., one-to-many nested details, nested table type, associated data type?);
  nestUpsert: boolean        // Whether to insert nested table data if it cannot be associated with task data; todo: currently multiple array fields share one configuration, can be extended to independent configuration for each child later;
}

// Forms, layouts, component configurations... etc. need to be updated independently and initialized uniformly when created;
interface ModuleConfig extends AppMeta {
  // app_id: string | null,
  moduleType: 'form' | 'flow' | 'board',
  formConfig: any,      // Form, report basic configuration: title, appearance style...// 
  vglConfig: any,    // vgl layout configuration parameters, store copies separately; global parameter modifications do not affect created form layouts;
  layouts: Array<LayoutNode>,   // vgl component layout 
  compConfigs: Array<CompConfig>,   // Component independent updates 
  flowDefs?: Array<FlowDefinition>,    // Multiple entries needed for version control;
  ext?: any,
  dataSync?: Array<DataSync>     // Data synchronization configuration
  dataFlow?: any,
  publish?: any,        // Public access, permission control   

  // Associated query ModuleNode
  moduleNode?: ModuleNode
}

interface BiDoc extends AppMeta {
  // Draft: 'draft', review: 'review', confirmed: 'confirmed', cancelled: 'cancel'
  complatedState: 'draft' | 'review' | 'confirmed' | 'cancel',
  [key: string]: any;
}

interface AppMeta extends EnMeta {
  app_id?: string | null,
}

interface ActiveNode extends FlowNode {
  taskAssignCount: number,     // Number of assigned tasks,
  taskExecCount: number,       // Number of executed tasks; joint sign: flow after all assigned tasks are executed, vote sign: flow after specified ratio is completed;
  taskActOrder: number,   // Current sequential execution node order;
  complete: boolean,      // Marked as true after flow; no attribute or marked as false if not flowed; In Progress | Completed
  createAt: Date,
  updateAt: Date,

  // Mark whether the task is abnormal, displayed in the flow log through task association;
  execStatus: 'normal' | 'warning' | 'error',
  execMsg: string
}


// todo: Dump to history table after a certain time when flow ends, can the structure be unified with the instance table?
interface FlowInstance extends AppMeta {
  // app_id: string | null,
  module_id: string,
  moduleName: string,
  formMeta: any,            // 【Deprecated】2020.3.15 Get field names and permission information from FlowNode.fieldPerm;
  formData: BiDoc,           // Form _id
  flowDef: FlowDefinition,   // Flow definition
  // Current active nodes of the flow; concurrent collection control: can only be executed after all connected nodes are completed;
  activeNodes: Array<ActiveNode>, // 
  // Current pending tasks 
  activeTasks: Array<FlowTask>,   // 'notActive' | 'sendBack' | 'todo' 
  activeCCopy: Array<CCopyTask>,   // Unread carbon copies
  flowLogs?: Array<FlowLog>,          // Flow dynamic/approval logs
  comments?: Array<any>,          // Comments,
  // Flow status: In progress, ended (completed; terminated; withdrawn; revoked; rejected; abnormal interruption)
  status: 'active' | 'complete' | 'cancel' | 'withdraw' | 'revoke' | 'reject' | 'abort',

  // Limited by update tasks that cannot update multiple arrays at the same time,
  // Currently, the solution retains historical records in activeTasks and activeCCopy;
  // History of completed tasks; for historical dump;
  // Current: Query results use hisTasks and hisCCopy aliases as temporary dump field names to avoid modifying the interface; contains all historical and currently active data;
  hisTasks?: Array<FlowTask>,  // 'withdraw' | 'revoke' | 'approve' | 'sendBack' | 'transfer' | 'reject' | 'cancel'
  hisCCopy?: Array<CCopyTask> // Read carbon copies, carbonCopy; for historical dump;

  creatorDeptId?: string,     // Temporarily save one when the flow initiator belongs to multiple departments; 
}

// todo: Not yet determined to enable, flow information is obtained through active nodes;
interface FlowLog {
  uid: number,          // Task date Uid
  nodeUid: number,      // Belonging flow node
  nodeName: string,     // Node name
  nodeType: string,     // Node type
  // Operation type: flow status, task status...; node entry/flow: activation/task generation, node approval, etc. operations;
  // Create task, execute task, task abnormal interruption...
  optType: string,
  executor: Base,   // Task executor
  optMsg?: string,  // Approval comments | system log messages
  createAt: Date,
}

interface FlowTask {
  uid: number,          // Task Uid
  nodeUid: number,      // Belonging flow node
  approveType: string,  // Approval type
  execOrder: number,     // Sequential task order number, not activated when not yet reached; all concurrent signatures set to 0; taskActOrder mark
  // Flow operations: [To be activated], [Pending], [Withdraw], [Revoke: initiator termination], [Approve], [Return], [Transfer], [Reject], [Invalid/Interrupt end]
  // When generating sequential tasks, activate the first one first, then the next one; withdraw: before the next node is approved;
  status: 'notActive' | 'todo' | 'withdraw' | 'revoke' | 'approve' | 'sendBack' | 'transfer' | 'reject' | 'cancel',
  opinion?: string,           // Approval comments
  attachment?: Array<string>, // Approval comment attachments
  sign?: string,              // Signature [image id]
  executor: Base,   // Task executor
  limitedTime?: string,   // Limited processing time days:D hours:H minutes:M
  urged?: Date,   // Urge: effective display for 5 minutes; update time when urging here;
  createAt: Date,
  updateAt: Date,
}

interface CCopyTask {
  uid: number,          // Task Uid
  nodeUid: number,      // Belonging flow [carbon copy node] or [approval node]
  fieldPerm: Array<FieldPerm>,    // Field permissions obtained from the belonging node
  isRead: boolean,      // Whether read
  executor: Base,   // Task executor
  limitedTime?: string,   // Limited processing time days:D hours:H minutes:M
  urged?: Date,   // Urge: effective display for 5 minutes; update time when urging here;
  createAt: Date,
  updateAt: Date,
}

interface Dept extends Base, EnBase, Order {
  manager?: Array<Base>,   // Department managers
  parent_id: string | null,
}

interface Role extends Base, EnBase, Order {
  parent_id: string,
  type: 'group' | 'role',   // group role
}

// Initialize default permission groups
// Each permission group corresponds to one view;
// Presets: 1. Add only, 2. Add and manage personal data, 3. Add and view all data, 4. Add and manage all data, 5. Manage all data, 6. View all data,
// 7. Custom: multiple, and have permission definitions;
// Presets only need type, can be customized if not satisfied;
// Extension properties of ModulePermGroup, no separate collection;
interface PermGroup {
  type: 'add' | 'add-edit-self' | 'add-view-all' | 'add-edit-all' | 'edit-all' | 'view-all' | 'custom',
  view_id: string,    // ModuleView._id todo: Use form, table based on default view, expand card later
  optAuth: Array<any>,    // Operation permissions, buttons...
  fieldAuth: Array<any>,   // Field permissions
  dataAuth: Array<any>    // Data permissions: filter conditions
}

// todo: View not used temporarily; use form, table based on default view, expand card later
interface ModuleView extends EnBase, Base {
  module_id: string,                // Application module
  type: 'form' | 'table' | 'card',
  config: any                       // Different configuration items for different types
}

// One module => multiple permission groups ModulePermGroup ; 
// ModulePerm.name == PermGroup.name
interface ModulePermGroup extends PermGroup, EnBase, Base {   // name as permission group name
  app_id: string,
  parent_id: string,          // Application module id
  moduleType: 'form' | 'flow' | 'board',
  active: boolean,            // Enable, disable
  accountAuth: Array<AccBase>,   // Member collection
  deptAuth: Array<Base>,      // Department collection
  roleAuth: Array<Base>,      // Role collection
  notes: string,              // Notes
  suf_id: string | null,
}

// Administrator, department management: whether management functions are available, management application scope, management role scope;
// Application management group: cannot add or delete, only responsible for modifying configuration;
interface AdminGroup extends Base, EnBase {
  type: "creator" | "super" | "system" | 'app',   // (Enterprise) creator, system administrator, general management group, application management group
  member: Array<AccBase>,
  appCd?: boolean,   // Whether can add or delete applications;
  appPerm?: Array<any>,   // Manageable applications; [General management group] dedicated
  modulePerm?: Array<any>, // Manageable modules; [Application management group] dedicated
  deptPerm?: Array<Base>,     // Optional departments for form publication scope
  rolePerm?: Array<Base>,     // Optional roles for form publication scope
  orgPerm?: any,     // Internal departments: visible and manageable; internal roles: visible, manageable
  parent_id?: string,
  suf_id?: string | null,
}

interface AccBase extends Base {
  avatar?: string | undefined,      // Avatar image metaId found in Gfs, use the last one;
}

interface Account extends AccBase {
  loginName?: string,    // Real name, name is account name
  nickName?: string,    // Nickname
  code?: string,    // Employee ID unique
  phone?: string,
  email?: string,
  password?: string,
  active?: boolean,    // Enable, disable
  onJob?: boolean,     // On job, resigned
  en_ids?: Array<any>,   // An account can join multiple enterprises, if there are multiple when logging in, need to pop up selection interface or default to log in to the first one
  createBy?: Base,
  createAt?: Date,
  updateAt?: Date
}

interface AccountEn extends EnMeta {  // _id taken from Account
  // _id?: string,
  acc_id: any,
  dept: Array<Base>,    // ?? 
  role: Array<Base>
}

interface BaseLog {
  _id?: string,
  logAt: Date,
  en_id: string,
}

interface BiDataLog extends BaseLog {
  data_id: string,
  triggerType: 'add' | 'edit' | 'delete' | 'flow-complete',   // Operation type that triggers synchronization, (different from next step: synchronization execution type)
  oldDoc: any,    // Data before modification, before deletion
  newDoc: any,    // Data after addition/modification; complete record; retains values before and after modification; _mf_xxxx old_mf_xxxxx
  optAccount: AccBase,
  execResult: boolean,
  resultMsg: string,
  errCode: number | null
}

interface OptLog extends BaseLog {
  optAccount: AccBase,
  app_id: string,
  optMsg: string, // Operation message corresponding to interface: whether xx table add/modify/delete xx operation was successful, error message...
  exeResult: boolean,
}

interface LoginLog extends BaseLog {
  acc_id: any,
  login: string,
  name: string,
  avatar: string,
  ip: string,
  os: string,
  osVersion: string,
  browser: string,
  browserVersion: string,
  device: string,
}

interface DataSyncLog extends BaseLog {
  triggerAt: Date,
  triggerAccount: AccBase | null,   // Trigger person
  execResult: boolean,  // Execution result
  resultMsg: string,   // Execution result message
  dataSyncConfig: { app_id: string, dataSyncUid: number },         // Data synchronization configuration
}

interface GfsMeta {
  metaId: number,   // uid, uniquely identifies the component, query all files bound to the component through metaId
  checkCode: string,    // File unique check code
  fileType?: string,     // File type; file extension
  aliasName?: string,
  contentType?: string
  // en_id?: string,
  // acc_id?: string,
  // app_id: string,
  // module_id?: string,
  // formData_id?: string,   // Form data _id;
  // imgField_id?: string,    // Form data [image field] id, a field can have multiple images;
}

interface GfsFile {
  _id?: any,
  length?: number,
  chunkSize?: number,
  uploadDate?: any,
  filename: string,
  metadata: GfsMeta,      // 
}

interface UserAuth {
  groupRole: 'creator' | 'super' | 'system' | 'app' | 'none',   // Management group role
  agAppPerm: Array<any>,
  adminGroup: Array<any>,

  permGroupCount: Array<any>
}

interface AdvancedModule {
  uuid: string;
  moduleName: string;
  limit: boolean;   // true: available; false: unavailable
}

// Authorization category, customer name, system version, app quantity, module quantity, advanced modules[], date limit
interface SystemAuth {
  uuid: string;   // 46318643c947442d9a98127e5f337c11
  enFullName: string;
  notes: string;  // Authorization description, e.g., authorization reason for different uuids of the same application
  enNmuberLimit: number;    // Enterprise quantity limit,
  appNumberLimit: number;   // Application quantity limit
  userNumberLimit: number;  // User quantity limit
  moduleNumberLimit: number;  // Module quantity limit;
  // formNumberLimit: number;  // Form number limit
  // flowNumberLimit: number;  // Flow form number limit
  // boardNumberLimit: number; // Chart report number limit
  AdvancedModuleLimit?: Array<AdvancedModule>;   // Advanced function limitations
  // free: free without authorization
  // base: authorized free version (increased authorization scope compared to free, appropriately customized according to customer needs);
  // limit: enterprise customized version (limited free, charged by function service), for industry projects and agents
  // nolimit: VIP enterprise version (unlimited functions for project-paying customers, supports clusters), for large project-paying enterprise customers (50,000/year)
  authType: 'free' | 'base' | 'limit' | 'nolimit';
  // Different authTypes share the same code; package version: v1.0_20250726 ; 
  // v1 version changes modify api encryption key, authorization key;
  sysVersion: string;
  dateLimit: false,   // Whether to enable authorization expiration time limit
  dateExpired: number,  // Expiration time timestamp
  customLogo: string | { logo: 'logo.svg', name: 'Qianbo Software Co., Ltd.' }    // Custom system logo and name
}

interface EnvConfig {
  init: {
    password: string
  },
  mongo: {
    ip: string,
    port: string,
    userName: string,
    passWord: string,

    mainDb: string,
    busiDb: string,
    gfsDb: string,
    bucketName: string,
    dimSplit: string
  },
  http: {
    serverPort: string,
    oneServer: boolean,
    apiRoot: string,
    staticDir: string,
    maxLimit: number,
    workerId: number,
    jwtKey: any,
    jwtLRUMax: number,
    tokenExpiresIn: any
  },
  path: {
    imageBase: string,
    logPath: string
  }
}

export {
  SequenceRule,
  SystemAuth,
  EnvConfig,
  ConditionConfig,
  DataSync,
  AccBase,
  BiDataLog,
  OptLog,
  DataSyncLog,
  LoginLog,
  ModulePermGroup,
  GfsFile,
  GfsMeta,
  BiDoc,
  EnMeta,
  AppMeta,
  FlowInstance,
  ModuleConfig,
  ParamNode,
  Node,
  ModuleNode,
  AppNode,
  Order,
  Account,
  AccountEn,
  Dept,
  AdminGroup,
  Regiter
}