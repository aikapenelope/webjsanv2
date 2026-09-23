import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';

export const sanityProjectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID || '6ezakoyw';
export const sanityDataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';
export const sanityApiVersion = '2024-01-01';

export const sanityClient = createClient({
  projectId: sanityProjectId,
  dataset: sanityDataset,
  apiVersion: sanityApiVersion,
  useCdn: true, // `false` si se prefiere evitar caché de CDN en tiempo real
});

const imageBuilder = createImageUrlBuilder(sanityClient);

export function urlFor(source: any) {
  return imageBuilder.image(source);
}

export interface SanityPost {
  _id: string;
  title: string;
  slug: string;
  kicker?: string;
  description?: string;
  pubDate: string;
  readingTime?: number;
  author?: string;
  mainImage?: any;
  body?: any[];
}

/**
 * Obtiene todos los artículos publicados en Sanity ordenados por fecha descendente.
 * Retorna un arreglo vacío si la consulta falla o no hay artículos aún.
 */
export async function getSanityPosts(): Promise<SanityPost[]> {
  try {
    const query = `*[_type == "post" && defined(slug.current)] | order(pubDate desc) {
      _id,
      title,
      "slug": slug.current,
      kicker,
      description,
      pubDate,
      readingTime,
      author,
      mainImage,
      body
    }`;
    const posts = await sanityClient.fetch<SanityPost[]>(query);
    return posts || [];
  } catch (error) {
    console.warn('[Sanity] Error al obtener artículos de Sanity:', error);
    return [];
  }
}

/**
 * Obtiene un artículo específico por su slug desde Sanity.
 */
export async function getSanityPostBySlug(slug: string): Promise<SanityPost | null> {
  try {
    const query = `*[_type == "post" && slug.current == $slug][0] {
      _id,
      title,
      "slug": slug.current,
      kicker,
      description,
      pubDate,
      readingTime,
      author,
      mainImage,
      body
    }`;
    const post = await sanityClient.fetch<SanityPost | null>(query, { slug });
    return post || null;
  } catch (error) {
    console.warn(`[Sanity] Error al obtener artículo por slug "${slug}":`, error);
    return null;
  }
}
