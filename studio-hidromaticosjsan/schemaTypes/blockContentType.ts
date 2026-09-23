import { defineType, defineArrayMember } from 'sanity';

export const blockContentType = defineType({
  title: 'Contenido del Artículo',
  name: 'blockContent',
  type: 'array',
  of: [
    defineArrayMember({
      title: 'Párrafo',
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'Título 2 (H2)', value: 'h2' },
        { title: 'Título 3 (H3)', value: 'h3' },
        { title: 'Cita destacada', value: 'blockquote' },
      ],
      lists: [
        { title: 'Viñetas (Puntos)', value: 'bullet' },
        { title: 'Numerada', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: 'Negrita', value: 'strong' },
          { title: 'Cursiva', value: 'em' },
          { title: 'Código', value: 'code' },
        ],
        annotations: [
          {
            title: 'Enlace web',
            name: 'link',
            type: 'object',
            fields: [
              {
                title: 'URL de destino',
                name: 'href',
                type: 'url',
              },
            ],
          },
        ],
      },
    }),
    defineArrayMember({
      type: 'image',
      title: 'Foto interna',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Texto descriptivo (para Google)',
          description: 'Describe qué se ve en la foto (ej: Desarme de caja CVT Nissan)',
        },
        {
          name: 'caption',
          type: 'string',
          title: 'Pie de foto visible',
        },
      ],
    }),
  ],
});
