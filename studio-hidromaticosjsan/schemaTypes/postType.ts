import { defineField, defineType } from 'sanity';

export const postType = defineType({
  name: 'post',
  title: 'Artículos del Blog',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Título del Artículo',
      type: 'string',
      description: 'El título principal que verán los lectores y Google (ej: Por Qué Patina la Caja Automática en Subida)',
      validation: (Rule) => Rule.required().error('El título es obligatorio'),
    }),
    defineField({
      name: 'slug',
      title: 'Enlace web (URL)',
      type: 'slug',
      description: 'Haz clic en "Generate" para crear el enlace web a partir del título.',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required().error('El enlace web es obligatorio'),
    }),
    defineField({
      name: 'kicker',
      title: 'Etiqueta o Categoría corta (Kicker)',
      type: 'string',
      description: 'Texto corto en mayúsculas sobre el título (ej: MANTENIMIENTO, DIAGNÓSTICO, TRANSMISIONES CVT)',
      initialValue: 'GUÍA MECÁNICA',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Resumen corto (para Google y redes)',
      type: 'text',
      rows: 3,
      description: 'Una breve explicación de 2 o 3 líneas que enganche al lector en la lista del blog y en Google.',
      validation: (Rule) => Rule.required().error('El resumen es obligatorio'),
    }),
    defineField({
      name: 'mainImage',
      title: 'Imagen de portada',
      type: 'image',
      description: 'Foto principal para compartir en redes sociales y encabezado.',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Descripción de la imagen (para accesibilidad y SEO)',
        },
      ],
    }),
    defineField({
      name: 'pubDate',
      title: 'Fecha de publicación',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'readingTime',
      title: 'Tiempo estimado de lectura (minutos)',
      type: 'number',
      initialValue: 4,
      validation: (Rule) => Rule.min(1).max(60),
    }),
    defineField({
      name: 'author',
      title: 'Autor',
      type: 'string',
      initialValue: 'Hidromáticos J-SAN',
    }),
    defineField({
      name: 'body',
      title: 'Cuerpo del Artículo',
      type: 'blockContent',
      description: 'Escribe aquí el contenido completo con subtítulos, párrafos, listas e imágenes explicativas.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      kicker: 'kicker',
      media: 'mainImage',
      date: 'pubDate',
    },
    prepare(selection) {
      const { title, kicker, media, date } = selection;
      const formattedDate = date ? new Date(date).toLocaleDateString('es-VE') : '';
      return {
        title: title,
        subtitle: `${kicker || 'BLOG'} · ${formattedDate}`,
        media: media,
      };
    },
  },
});
