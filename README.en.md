# nocozenbase

<h4 align="right"><a href="./README.md">简体中文</a> | <strong>English</strong></h4>

## 🌟 Project Introduction

NocoZenBase is the companion server-side for the NocoZen project, a high-performance web server application developed based on Node.js, providing API interface services, data processing, and database interaction functions.

## 🚀 Key Advantages

### 1. High Performance
- Built on hyper-express and uWebSockets.js, providing excellent concurrent processing capabilities
- Uses MessagePack serialization technology to optimize data transmission efficiency
- Supports asynchronous non-blocking I/O operations, fully utilizing system resources

### 2. Secure and Reliable
- Implements JWT authentication mechanism to ensure user identity security
- Supports environment variable configuration to protect sensitive information
- Uses MongoDB database to provide data persistence and high availability

### 3. Easy to Use
- Clean API design for quick developer integration
- Provides complete development and production environment configuration
- Supports multiple startup methods to meet different deployment needs

### 4. Flexible Extension
- Modular project structure for easy feature expansion
- Supports custom routing and middleware
- Provides task scheduling system supporting scheduled tasks and event triggers

## 📦 Quick Start

### Environment Requirements

- Node.js >= 20.0.0
- npm >= 10.0.0
- MongoDB >= 7.0.0

### Development Environment

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

Find the [.env] file and open it with a text editor,
modify the HTTP server port:
HTTP_SERVER_PORT=8000
The default is 8000, you can change it to the port number you need, save after modification,
the service can be started after saving the port configuration.
The front-end NocoZen deploys static files to the current project and shares the server port,
when the front-end NocoZen starts its own development server, you need to modify the port in the front-end [.env] file to keep it consistent.

3. Start the service

```bash
npm run dev
```

After the first startup is successful (indicated by a message such as: "Webserver started on port 8000"),
after the frontend project NocoZen is started, enter the initialization configuration page address in the browser to open the initialization configuration login page
(format example: https://127.0.0.1:8000/init);

## 🛠️ Technology Stack

### Core Dependencies

| Dependency Name      | Purpose                     |
|----------------------|-----------------------------|
| hyper-express        | High-performance web server framework |
| mongodb              | MongoDB database driver     |
| uWebSockets.js       | WebSocket and HTTP server (dependency of hyper-express) |
| @dotenvx/dotenvx     | Environment variable management |
| jose                 | JWT authentication and encryption |
| @msgpack/msgpack     | MessagePack serialization   |
| @pulsecron/pulse     | Task scheduling system      |
| pino                 | High-performance logging system |
| radashi              | Utility function library    |

## 📁 Project Structure

```
nocozenbase/
├── src/
│   ├── api/               # API interface implementation
│   ├── router/            # Route definitions
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── server.ts          # Server entry file
├── .env                   # Development environment configuration
├── .env.production        # Production environment configuration
├── tsconfig.json          # TypeScript configuration
├── tsup.config.ts         # tsup build configuration
├── package.json           # Project dependencies and scripts
├── README.md              # English documentation
└── README.zh.md           # Chinese documentation
```

## ✨ Main Features

### Implemented Features

- ✅ High-performance web server framework
- ✅ JWT authentication and authorization system
- ✅ MongoDB database connection and operations
- ✅ RESTful API interface design
- ✅ MessagePack data serialization
- ✅ Environment variable configuration management
- ✅ Task scheduling system
- ✅ High-performance logging system

### Planned Development Features

- 📍 Multi-database support such as PostgreSql
- 📍 Object storage support such as Minio、OSS、S3
- 📍 AI service support
- 📍 Service interfaces for monitoring and performance analysis tools

## 🌐 Repository Mirrors

The canonical source of this project is hosted on **GitHub**. A read-only mirror is maintained on **Gitee** to provide faster access for users in mainland China.

- **Main (GitHub)**: https://github.com/nocozen/nocozen
- **Mirror (Gitee)**: https://gitee.com/nocozen/nocozen

> 🔔 Please submit all issues, pull requests, and discussions on **GitHub**. The Gitee repository is a mirror.

## 📄 License

[![Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

