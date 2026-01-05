import { Worker } from 'bullmq';
import { createTwoFilesPatch } from 'diff';
import pool from './config/db';
import { DIFF_QUEUE_NAME } from './config/queue';
import * as dotenv from 'dotenv';

dotenv.config();

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null, // Required by BullMQ
};

export const runWorker = () => {
    const worker = new Worker(DIFF_QUEUE_NAME, async job => {
        console.log(`[Worker] Processing diff for job ${job.id}`);
        const { documentId, oldVersionId, newVersionId } = job.data;

        try {
            const res = await pool.query(
                'SELECT id, version_number, content FROM versions WHERE id IN ($1, $2)',
                [oldVersionId, newVersionId]
            );

            if (res.rows.length !== 2) {
                console.error('[Worker] Could not find both versions');
                return;
            }

            const vOld = res.rows.find(r => r.id === oldVersionId);
            const vNew = res.rows.find(r => r.id === newVersionId);

            const patch = createTwoFilesPatch(
                `Version ${vOld.version_number}`,
                `Version ${vNew.version_number}`,
                vOld.content,
                vNew.content
            );

            console.log(`[Worker] Generated Diff for Document ${documentId}:`);
            console.log(patch);

        } catch (e) {
            console.error('[Worker] Error processing job', e);
            throw e;
        }
    }, { connection });

    worker.on('ready', () => {
        console.log('Worker is ready and listening...');
    });

    worker.on('error', err => {
        console.error('Worker error', err);
    });
};