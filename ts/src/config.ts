import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
