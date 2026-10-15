import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import memberRouter from "./routes/memberRoute.js";
import bookRoutes from "./routes/bookRoutes.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const allowedOrigins = ["https://test-app.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin.startsWith("http://localhost") ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);

app.use((req, _res, next) => {
  for (const key of ["body", "params", "headers"]) {
    if (req[key]) {
      req[key] = mongoSanitize.sanitize(req[key]);
    }
  }

  Object.defineProperty(req, "query", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: mongoSanitize.sanitize(req.query),
  });

  next();
});

app.use("/api/members", memberRouter);

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
    },
  });
});

app.use("/api/books", bookRoutes);
app.use((_req, _res, next) => {
  next(Object.assign(new Error("Route not found"), { status: 404 }));
});

app.use((error, _req, res, _next) => {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: { message: error.message },
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: { message: "Invalid identifier" },
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { message: "That record already exists" },
    });
  }

  const status = error.status || error.statusCode;

  if (!status) {
    console.error(error);
  }

  res.status(status || 500).json({
    success: false,
    error: {
      message: status ? error.message : "Internal server error",
    },
  });
});

export default app;
