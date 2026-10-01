import { z } from "zod";
import { text, uuid } from "./common";

export const proofReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("aprobar"), proof_id: uuid }),
  z.object({ decision: z.literal("rechazar"), proof_id: uuid, motivo: text(3, 500) }),
]);

