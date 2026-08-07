import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || "9090", 10);

const metricReader = new PrometheusExporter({ port: PROMETHEUS_PORT });

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: "arcswarm-api",
  [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || "0.1.0",
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
});

const sdk = new NodeSDK({
  resource,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http": { enabled: true },
      "@opentelemetry/instrumentation-express": { enabled: true },
      "@opentelemetry/instrumentation-pg": { enabled: true },
      "@opentelemetry/instrumentation-redis": { enabled: true },
    }),
  ],
});

sdk.start();
logger.info({ port: PROMETHEUS_PORT }, "OpenTelemetry + Prometheus exporter started");

process.on("SIGTERM", () => {
  sdk.shutdown().then(() => logger.info("OpenTelemetry shut down"));
});

export { sdk };
