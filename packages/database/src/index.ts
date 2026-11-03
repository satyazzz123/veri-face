import { PrismaClient } from '@prisma/client';

let globalPrisma: PrismaClient | undefined;

export function getPrismaClient(databaseUrl?: string): PrismaClient {
  if (globalPrisma) {
    return globalPrisma;
  }

  const client = new PrismaClient({
    datasources: databaseUrl
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalPrisma = client;
  }

  return client;
}

export * from '@prisma/client';
