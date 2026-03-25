import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { readFileSync, existsSync } from "fs";
import { parse } from "url";
import next from "next";
import path from "path";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const certsDir = path.join(import.meta.dirname, "certs");
const keyPath = path.join(certsDir, "key.pem");
const certPath = path.join(certsDir, "cert.pem");
const caPath = path.join(certsDir, "ca.pem");

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const hasCerts = existsSync(keyPath) && existsSync(certPath);

  if (hasCerts) {
    const httpsOptions: { key: Buffer; cert: Buffer; ca?: Buffer } = {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    };
    if (existsSync(caPath)) {
      httpsOptions.ca = readFileSync(caPath);
    }

    createHttpsServer(httpsOptions, async (req, res) => {
      const parsedUrl = parse(req.url!, true);
      await handler(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`> HTTPS ready on https://${hostname}:${port}`);
    });
  } else {
    createHttpServer(async (req, res) => {
      const parsedUrl = parse(req.url!, true);
      await handler(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`> HTTP ready on http://${hostname}:${port}`);
      if (!dev) {
        console.log(
          "> No certs found in certs/. Running without HTTPS. See certs/README.md for setup."
        );
      }
    });
  }
});
