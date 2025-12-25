interface DistinctOption {
  metaid?: string,
  dbname: string,
  collection: string,
  field: string,
  filter?: Object,
  option?: Object
}

interface FindOption {
  metaid?: string,
  dbname: string,
  collection: string,
  filterType?: string,
  filter: any,
  sort?: Object,
  page?: number,
  size?: number,
  datatype?: "array" | "object"
}

interface BulkMeta {
  field: string,  // Excel column name: col0, col1...
  fieldName: string, // Field metadata name: _mf_xxxxx
  title: string, // Field Chinese name
  type: string  // Field type: FormElType: FeText...
}

interface BulkUpsertOption {
  metaid?: string,
  dbname?: string,
  collection: string,
  docs: Array<any>,
  meta?: Array<BulkMeta>,
  options?: any,   // Prevent insertion of remaining documents when previous document insertion fails in array during bulk insert.
  type?: "insert" | "update",
  hash?: boolean,  // Whether to enable hash verification, default: false
  convert?: boolean,  // Whether to enable type conversion; default: true
}

interface InsertOption {
  metaid?: string,
  dbname: string,
  collection: string,
  docs: Array<any>,
  options?: any,   // Prevent insertion of remaining documents when previous document insertion fails in array during bulk insert.
}

interface UpdateOption {
  metaid?: string,
  dbname: string,
  collection: string,
  filter: {
    _id?: string,
    [k: string]: any,
  },
  update: any,
  push?: any,
  addToSet?: any,
  pull?: any,
  options?: any,   // Prevent insertion of remaining documents when previous document insertion fails in array during bulk insert.
  formData?: any       // Additional data, data associated with process instances, needed for logs and synchronization after process ends;
}

interface DeleteOption {
  metaid?: string,
  dbname: string,
  collection: string,
  filter: {
    _id?: string,
    uid?: string
  }
}

interface InsertResult {
  acknowledged: boolean,
  insertedCount: number,
  insertedIds: Array<any>,  // Add attributes to api request parameters if needed
  insertedUids: Array<any>  // Add attributes to api request parameters if needed
}

interface UpdateResult {
  acknowledged: boolean,
  matchedCount: number,   // The number of documents that matched the filter
  modifiedCount: number,    // The number of documents that were modified
  upsertedCount: number,    // The number of documents that were upserted
  upsertedId: string,   // The identifier of the inserted document if an upsert took place
}

interface DeleteResult {
  acknowledged: boolean,
  deletedCount: number
}

interface QueryOption {
  sort?: object;
  skip?: number;
  limit: number;
  projection?: any;
}

interface Doc {
  uid?: number;
  [key: string]: any;
}


export { BulkMeta, BulkUpsertOption, Doc, QueryOption, DistinctOption, FindOption, InsertResult, UpdateResult, DeleteResult, InsertOption, UpdateOption, DeleteOption }