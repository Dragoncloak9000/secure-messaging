import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { createWsRelayServer } from "@trystero-p2p/ws-relay/server";

const httpsServer = createServer({
  key: readFileSync("./certificates/localhost-key.pem"),
  cert: readFileSync("./certificates/wss-cert.pem"),
});

const relay = createWsRelayServer({
  server: httpsServer,
  path: "/relay",
  maxTopicLength: 256,
  maxSubscriptionsPerSocket: 128,
  maxSubscriptions: 10_000,
  maxMessagesPerSecond: 200,
  maxBurstMessages: 400,
});

await relay.ready;

httpsServer.listen(3001, "0.0.0.0", () => {
  console.log("WSS relay listening at wss://your-domain.example/relay");
});