import { z } from "zod";

export const OAuthAccessTokenResponse = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  scope: z.string(),
});