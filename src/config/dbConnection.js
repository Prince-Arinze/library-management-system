import { connect } from "mongoose";
import dns from "node:dns/promises";

export const connectDB = async () => {
  dns.setServers(["1.1.1.1"]);
  await connect(process.env.MONGO_URI);
  console.log("Database connected successfully");
};
