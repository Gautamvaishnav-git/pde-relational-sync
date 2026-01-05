import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function run() {
    try {
        console.log('1. Creating document...');
        const docRes = await axios.post(`${BASE_URL}/documents`, {
            title: 'Concurrency Test Doc',
            createdBy: 'Tester',
            content: 'Initial v1'
        });
        const docId = docRes.data.id;
        console.log(`   -> Created: ${docId}, Version: 1`);

        console.log('2. Launching 5 parallel version updates...');
        const promises = [];
        for (let i = 1; i <= 5; i++) {
            const p = axios.post(`${BASE_URL}/documents/${docId}/versions`, {
                content: `Content update #${i}`
            }).then(res => {
                console.log(`   -> Update #${i} SUCCESS: v${res.data.version_number}`);
                return res.data;
            }).catch(err => {
                console.error(`   -> Update #${i} FAILED:`, err.response?.data || err.message);
                throw err;
            });
            promises.push(p);
        }

        // this responsible to exexcute the promises in parrallel
        await Promise.allSettled(promises);

        console.log('3. Fetching latest version from API...');
        const finalRes = await axios.get(`${BASE_URL}/documents/${docId}`);
        console.log('   -> Final State:', finalRes.data);

        if (finalRes.data.version === 6) {
            console.log('\n✅ SUCCESS: Version count is as expected (6). Concurrency handled correctly.');
        } else {
            console.log(`\n❌ FAILURE: Expected version 6, got ${finalRes.data.version}.`);
        }

    } catch (e: any) {
        console.error('Test script error details:', JSON.stringify(e, null, 2));
        if (e instanceof Error) console.error(e.stack);
    }
}

// Wait for server to start (manual delay or assumption)
setTimeout(run, 5000);
