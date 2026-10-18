import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import type { Request } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Meta signs the RAW webhook body. Re-serialising the parsed JSON changes
  // the bytes (key order, whitespace) and the HMAC would never match, so the
  // original buffer is stashed on the request before parsing.
  const captureRawBody = (req: Request, _res: unknown, buf: Buffer) => {
    if (buf?.length) (req as Request & { rawBody?: Buffer }).rawBody = buf;
  };
  app.use(express.json({ verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, verify: captureRawBody }));

  app.use(cookieParser());

  // WEB_ORIGIN accepts a comma-separated list so Vercel preview deployments
  // can talk to the same API as the production domain.
  const origins = config
    .get<string>("WEB_ORIGIN", "http://localhost:5180")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  });

  // Render (and most PaaS hosts) inject the port to bind as PORT.
  const port = Number(process.env.PORT) || config.get<number>("API_PORT", 4000);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
}
bootstrap();
