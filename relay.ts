import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { createWsRelayServer } from "@trystero-p2p/ws-relay/server";

const server = createServer({
  key: readFileSync("./certificates/localhost-key.pem"),
  cert: readFileSync("./certificates/wss-cert.pem"),
});
// const server = createServer()

const relay = createWsRelayServer({
  server: server,
  path: "/relay",
  maxTopicLength: 256,
  maxSubscriptionsPerSocket: 128,
  maxSubscriptions: 10_000,
  maxMessagesPerSecond: 200,
  maxBurstMessages: 400,
});

await relay.ready;

server.listen(3001, "0.0.0.0", () => {
  console.log(server.address())
});