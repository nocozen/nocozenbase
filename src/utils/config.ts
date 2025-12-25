import { config } from '@dotenvx/dotenvx';
import * as M from '../types/meta';
import { ConfigManager } from "../utils/conf.js";

config();

const configManager = ConfigManager.getInstance();
const cm = configManager.getAll();

const con: M.EnvConfig = {
  init: {
    "password": cm.INIT_PWD as string
  },
  mongo: {
    "ip": cm.MONGO_IP as string,
    "port": cm.MONGO_PORT as string,
    "userName": cm.MONGO_USERNAME as string,
    "passWord": cm.MONGO_PASSWORD as string,

    "mainDb": cm.MONGO_MAINDB as string,
    "busiDb": cm.MONGO_BUSIDB as string,
    "gfsDb": cm.MONGO_GFSDB as string,
    "bucketName": cm.MONGO_BUCKETNAME as string,
    "dimSplit": cm.MONGO_DIMSPLIT as string
  },
  http: {
    "serverPort": process.env.HTTP_SERVER_PORT,
    "oneServer": process.env.HTTP_ONESERVER == 'true',
    "apiRoot": process.env.HTTP_APIROOT as string,
    "staticDir": process.env.HTTP_STATICDIR as string,
    "maxLimit": Number(process.env.HTTP_MAXLIMIT) || 1000,
    "workerId": Number(process.env.HTTP_WORKERID),
    "jwtKey": '2OQEIA8lQXjQQxQEEA0BSxR1AnSZ4na+cdIFdB7xD5E=', 
    "jwtLRUMax": Number(process.env.HTTP_JWT_LRU_MAX) || 1000,
    "tokenExpiresIn": process.env.HTTP_TOKEN_EXPIRESIN as any
  },
  path: {
    "imageBase": process.env.PATH_IMAGEBASE as string,
    "logPath": process.env.PATH_LOGPATH as string
  }
};

export default con