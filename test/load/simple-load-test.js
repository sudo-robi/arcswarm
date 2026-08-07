const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '10', 10);
const DURATION_SECONDS = parseInt(process.env.DURATION_SECONDS || '30', 10);

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalResponseTime = 0;
const responseTimes = [];

async function makeRequest(path) {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        totalRequests++;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
        totalResponseTime += duration;
        responseTimes.push(duration);
        resolve({ status: res.statusCode, duration, data });
      });
    });
    req.on('error', (err) => {
      totalRequests++;
      failedRequests++;
      const duration = Date.now() - start;
      totalResponseTime += duration;
      responseTimes.push(duration);
      resolve({ status: 0, duration, error: err.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      totalRequests++;
      failedRequests++;
      const duration = Date.now() - start;
      totalResponseTime += duration;
      responseTimes.push(duration);
      resolve({ status: 0, duration, error: 'timeout' });
    });
  });
}

async function runLoadTest() {
  console.log(`\n🚀 Starting load test against ${BASE_URL}`);
  console.log(`   Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`   Duration: ${DURATION_SECONDS}s\n`);

  const endTime = Date.now() + (DURATION_SECONDS * 1000);
  const endpoints = ['/api/health', '/metrics'];

  while (Date.now() < endTime) {
    const promises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      promises.push(makeRequest(endpoint));
    }
    await Promise.all(promises);
    // Small delay to avoid overwhelming
    await new Promise(r => setTimeout(r, 100));
  }

  // Calculate statistics
  const avgResponseTime = totalResponseTime / totalRequests;
  const p50 = percentile(responseTimes, 50);
  const p95 = percentile(responseTimes, 95);
  const p99 = percentile(responseTimes, 99);

  console.log('📊 Load Test Results');
  console.log('==================');
  console.log(`Total Requests:     ${totalRequests}`);
  console.log(`Successful:         ${successfulRequests}`);
  console.log(`Failed:             ${failedRequests}`);
  console.log(`Success Rate:       ${((successfulRequests / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Avg Response Time:  ${avgResponseTime.toFixed(2)}ms`);
  console.log(`P50 Response Time:  ${p50}ms`);
  console.log(`P95 Response Time:  ${p95}ms`);
  console.log(`P99 Response Time:  ${p99}ms`);
  console.log(`Requests/sec:       ${(totalRequests / DURATION_SECONDS).toFixed(2)}`);

  // Exit with error if success rate < 99%
  if ((successfulRequests / totalRequests) < 0.99) {
    console.log('\n❌ Load test failed: Success rate below 99%');
    process.exit(1);
  } else {
    console.log('\n✅ Load test passed');
  }
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[pos] || 0;
}

runLoadTest().catch(console.error);
