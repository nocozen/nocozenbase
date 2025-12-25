/**
 * This file implements Pulse task scheduling functionality for NocoZenBase.
 * It initializes and configures Pulse with MongoDB integration, defines scheduled jobs,
 * and provides an API for manual job execution.
 * 
 * Technologies used:
 * - Pulse (@pulsecron/pulse): Task scheduling library with MongoDB persistence
 * - MongoDB: For storing job data and state
 * - TypeScript: For type safety
 */
import { Pulse } from "@pulsecron/pulse";
import { logger } from "../utils/logger.js";
import { LimitColl, TaskName } from "../types/enum.js";
import { dataSync } from "./syncJob.js";

let pulse;
/**
 * Initialize Pulse task scheduling
 * @param {any} db - MongoDB database connection to reuse
 * @returns {Promise<Pulse>} - The initialized Pulse instance
 */
export async function initPulse(db: any) {
  pulse = new Pulse({
    mongo: db, // Reuse MongoDB connection
    db: { collection: LimitColl.JOBS } as any, // Specify collection name
    defaultConcurrency: 4, // Default concurrency
    maxConcurrency: 4,
    processEvery: "10 seconds", // Task scanning interval
    resumeOnRestart: true,
  });

  defineJobs(pulse); // Register jobs

  // Start Pulse
  await pulse.start();
  console.log("✅ Task scheduler started");
  logger.info("✅ Task scheduler started");

  return pulse;
}

/**
 * Define and register scheduled jobs
 * @param {Pulse} pulse - The Pulse instance to register jobs with
 */
export function defineJobs(pulse: Pulse) {
  // Data sync job registration
  pulse.define(TaskName.DataSync, dataSync);

}

/**
 * Execute the data sync job immediately
 * @param {any} data - Data to pass to the data sync job
 * @returns {Promise<any>} - The created job instance
 */
export async function dataSyncNow(data: any) {
  const job = await pulse.now(TaskName.DataSync, data);
  return job;
}

