
import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
dotenv.config();

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
};

export const DIFF_QUEUE_NAME = 'document-diff-queue';

export const diffQueue = new Queue(DIFF_QUEUE_NAME, {
    connection
});
