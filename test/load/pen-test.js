const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function log(test, status, detail) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${test}: ${detail}`);
  results.tests.push({ test, status, detail });
  if (status === 'PASS') results.passed++;
  else if (status === 'FAIL') results.failed++;
  else results.warnings++;
}

async function request(path, options = {}) {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runPenTest() {
  console.log('\n🔒 Penetration Testing Suite');
  console.log('============================\n');

  // 1. SQL Injection Tests
  console.log('📋 SQL Injection Tests');
  const sqlPayloads = ["' OR '1'='1", "1; DROP TABLE users--", "' UNION SELECT * FROM users--"];
  for (const payload of sqlPayloads) {
    const res = await request(`/api/health?id=${encodeURIComponent(payload)}`);
    if (res.status === 500 && res.data?.includes('SQL')) {
      log('SQL Injection', 'FAIL', `Vulnerable to: ${payload}`);
    } else {
      log('SQL Injection', 'PASS', `Rejected payload: ${payload}`);
    }
  }

  // 2. XSS Tests
  console.log('\n📋 XSS Tests');
  const xssPayloads = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', 'javascript:alert(1)'];
  for (const payload of xssPayloads) {
    const res = await request(`/api/health?q=${encodeURIComponent(payload)}`);
    if (res.data?.includes(payload)) {
      log('XSS', 'FAIL', `Reflected XSS: ${payload}`);
    } else {
      log('XSS', 'PASS', `Blocked XSS: ${payload}`);
    }
  }

  // 3. Path Traversal
  console.log('\n📋 Path Traversal Tests');
  const pathPayloads = ['../../../etc/passwd', '..\\..\\..\\windows\\system32', '%2e%2e%2f%2e%2e%2f'];
  for (const payload of pathPayloads) {
    const res = await request(`/${payload}`);
    if (res.data?.includes('root:') || res.data?.includes('Windows')) {
      log('Path Traversal', 'FAIL', `Accessible: ${payload}`);
    } else {
      log('Path Traversal', 'PASS', `Blocked: ${payload}`);
    }
  }

  // 4. Security Headers
  console.log('\n📋 Security Headers');
  const res = await request('/api/health');
  const headers = res.headers;
  
  if (headers['x-content-type-options']) {
    log('X-Content-Type-Options', 'PASS', headers['x-content-type-options']);
  } else {
    log('X-Content-Type-Options', 'WARN', 'Missing - should be "nosniff"');
  }

  if (headers['x-frame-options']) {
    log('X-Frame-Options', 'PASS', headers['x-frame-options']);
  } else {
    log('X-Frame-Options', 'WARN', 'Missing - should be "DENY" or "SAMEORIGIN"');
  }

  if (headers['x-xss-protection']) {
    log('X-XSS-Protection', 'PASS', headers['x-xss-protection']);
  } else {
    log('X-XSS-Protection', 'WARN', 'Missing - should be "1; mode=block"');
  }

  if (headers['strict-transport-security']) {
    log('HSTS', 'PASS', headers['strict-transport-security']);
  } else {
    log('HSTS', 'WARN', 'Missing - should be set for HTTPS');
  }

  if (headers['content-security-policy']) {
    log('CSP', 'PASS', headers['content-security-policy']);
  } else {
    log('CSP', 'WARN', 'Missing - Content-Security-Policy recommended');
  }

  // 5. Rate Limiting
  console.log('\n📋 Rate Limiting Test');
  const rateLimitResults = [];
  for (let i = 0; i < 100; i++) {
    const r = await request('/api/health');
    rateLimitResults.push(r.status);
  }
  const blocked = rateLimitResults.filter(s => s === 429).length;
  if (blocked > 0) {
    log('Rate Limiting', 'PASS', `Triggered after ${100 - blocked} requests`);
  } else {
    log('Rate Limiting', 'WARN', 'No rate limiting detected (100 requests)');
  }

  // 6. HTTP Methods
  console.log('\n📋 HTTP Method Tests');
  const methods = ['PUT', 'DELETE', 'PATCH'];
  for (const method of methods) {
    const r = await request('/api/health', { method });
    if (r.status === 404 || r.status === 405) {
      log('HTTP Methods', 'PASS', `${method} properly rejected (${r.status})`);
    } else {
      log('HTTP Methods', 'WARN', `${method} returned ${r.status}`);
    }
  }

  // 7. Error Handling
  console.log('\n📋 Error Handling');
  const errorRes = await request('/api/nonexistent');
  if (errorRes.status === 404) {
    log('Error Handling', 'PASS', 'Returns 404 for unknown routes');
  } else {
    log('Error Handling', 'WARN', `Unknown route returns ${errorRes.status}`);
  }

  // Check for stack traces
  if (errorRes.data?.includes('stack') || errorRes.data?.includes('Error:')) {
    log('Stack Trace Exposure', 'FAIL', 'Stack trace exposed in error response');
  } else {
    log('Stack Trace Exposure', 'PASS', 'No stack traces exposed');
  }

  // 8. tRPC Specific
  console.log('\n📋 tRPC Security');
  const trpcRes = await request('/trpc/agent.getAll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (trpcRes.status === 200 || trpcRes.status === 400) {
    log('tRPC Endpoint', 'PASS', 'Properly handles requests');
  } else {
    log('tRPC Endpoint', 'WARN', `Unexpected status: ${trpcRes.status}`);
  }

  // 9. CORS
  console.log('\n📋 CORS');
  const corsRes = await request('/api/health', {
    headers: { 'Origin': 'https://evil.com' }
  });
  if (corsRes.headers['access-control-allow-origin'] === '*') {
    log('CORS', 'WARN', 'Wildcard CORS - consider restricting');
  } else if (corsRes.headers['access-control-allow-origin']) {
    log('CORS', 'PASS', `Origin: ${corsRes.headers['access-control-allow-origin']}`);
  } else {
    log('CORS', 'PASS', 'No CORS headers (default deny)');
  }

  // 10. Information Disclosure
  console.log('\n📋 Information Disclosure');
  const serverHeader = headers['server'];
  if (serverHeader) {
    log('Server Header', 'WARN', `Exposed: ${serverHeader}`);
  } else {
    log('Server Header', 'PASS', 'Server header hidden');
  }

  const poweredBy = headers['x-powered-by'];
  if (poweredBy) {
    log('X-Powered-By', 'WARN', `Exposed: ${poweredBy}`);
  } else {
    log('X-Powered-By', 'PASS', 'X-Powered-By hidden');
  }

  // Summary
  console.log('\n📊 Penetration Test Summary');
  console.log('==========================');
  console.log(`✅ Passed:   ${results.passed}`);
  console.log(`❌ Failed:   ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  console.log(`📝 Total:    ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\n❌ SECURITY ISSUES FOUND - Must fix before production');
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log('\n⚠️  Some warnings - Review recommended');
  } else {
    console.log('\n✅ All security checks passed');
  }
}

runPenTest().catch(console.error);
