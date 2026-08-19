const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function main() {
  const imagePath = '/Users/andrevalleortega/Desktop/Captura de pantalla 2026-08-17 a la(s) 1.28.11 p.m..png';
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Extrae el horario de clases de esta imagen. Devuelve UNICAMENTE un JSON válido con esta estructura: [{ "name": "Nombre de la Materia", "professor": "Profesor", "schedule": "Lunes 10:00-11:30, Miercoles..." }]',
          }
        ],
      }
    ],
  });

  console.log(response.content[0].text);
}

main().catch(console.error);
