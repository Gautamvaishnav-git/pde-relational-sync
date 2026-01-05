import express = require('express');
import * as dotenv from 'dotenv';
import { initDB } from './config/db';
import redis from './config/redis';
import documentRoutes from './routes/documents';
import { runWorker } from './worker';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', documentRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const start = async () => {
    try {
        await initDB();

        // Start Worker
        runWorker();

        await redis.connect().catch(err => {
            console.error("Redis connection failed, continuing (it might be lazy)", err);
        });
        // If lazyConnect is true, it might not connect until a command is issued.
        // But let's just try a ping.
        await redis.ping().then(() => console.log("Redis PING successful"));

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (e) {
        console.error("Failed to start server:", e);
        process.exit(1);
    }
};

start();
