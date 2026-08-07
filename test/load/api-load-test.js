import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 VUs
    { duration: "1m", target: 10 }, // Stay at 10 VUs
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% failures
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

export default function () {
  // Health endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    "health status is 200": (r) => r.status === 200,
    "health response time < 100ms": (r) => r.timings.duration < 100,
  });

  // Metrics endpoint
  const metricsRes = http.get(`${BASE_URL}/metrics`);
  check(metricsRes, {
    "metrics status is 200": (r) => r.status === 200,
    "metrics contains arcswarm_api_info": (r) =>
      r.body.includes("arcswarm_api_info"),
  });

  // tRPC router (list agents)
  const trpcRes = http.post(
    `${BASE_URL}/trpc/agent.getAll`,
    JSON.stringify({}),
    { headers: { "Content-Type": "application/json" } }
  );
  check(trpcRes, {
    "trpc status is 200": (r) => r.status === 200,
    "trpc response time < 200ms": (r) => r.timings.duration < 200,
  });

  sleep(1);
}
