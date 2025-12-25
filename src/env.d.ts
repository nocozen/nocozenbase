declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    INIT_PWD: string;
    LOG_LEVEL: string;

    MONGO_IP: string;
    MONGO_PORT: string;
    MONGO_USERNAME: string;
    MONGO_PASSWORD: string;
    MONGO_MAINDB: string;
    MONGO_BUSIDB: string;
    MONGO_GFSDB: string;
    MONGO_JOBDB: string;
    MONGO_BUCKETNAME: string;
    MONGO_DIMSPLIT: string;

    HTTP_SERVER_PORT: string;
    HTTP_ONESERVER: string;
    HTTP_APIROOT: string;
    HTTP_STATICDIR: string;
    HTTP_MAXLIMIT: string;
    HTTP_WORKERID: string;
    HTTP_JWTKEY: string;
    HTTP_TOKEN_EXPIRESIN: string;
    HTTP_JWT_LRU_MAX: number;
    
    PATH_IMAGEBASE: string;
    PATH_LOGPATH: string;
  }
}