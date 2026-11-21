import { createSupabaseContext } from '@supabase/server';
import type { FastifyRequest } from 'fastify';
import { config } from './config';

export async function verifyUserAuth(req: FastifyRequest) {
  if (!config.supabaseUrl || !req.headers.authorization) return null;

  try {
    const webReq = new Request(`http://${req.hostname}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
    });

    const { data, error } = await createSupabaseContext(webReq, {
      auth: 'user',
      env: {
        url: config.supabaseUrl,
        publishableKeys: { default: config.supabasePublishableKey },
        secretKeys: { default: config.supabaseSecretKey },
      },
    });

    if (error || !data) return null;
    return data.userClaims;
  } catch {
    return null;
  }
}
