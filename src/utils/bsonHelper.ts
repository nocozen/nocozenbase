import { ObjectId } from "mongodb";


export function convetMongoType(data) {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (data instanceof ObjectId) {
    return data.toHexString(); 
  }

  if (data instanceof Date) {
    return data.getTime();
  }

  if (Array.isArray(data)) {
    return data.map(convetMongoType);
  }

  if (data instanceof Map) {
    return Object.fromEntries(data);
  }

  const result = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      result[key] = convetMongoType(data[key]);
    }
  }
  return result;
}