import * as dotenv from 'dotenv';
import { defineConfig } from "prisma/config";

// This manually loads your .env file from the root
dotenv.config();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});