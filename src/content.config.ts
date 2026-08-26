import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    kicker: z.string(),
    readingTime: z.number().default(4),
    author: z.string().default('Hidromáticos J-SAN'),
  }),
});

export const collections = { blog };
