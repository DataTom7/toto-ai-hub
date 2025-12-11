// Temporary script to validate renderableMessages generation
const { normalizeCaseResponse } = require('./dist/utils/responseValidation');

const resp = normalizeCaseResponse({
  success: true,
  message: 'Hola, ¿en qué puedo ayudarte?',
  metadata: {
    quickActions: { showHelpActions: true },
  },
});

console.log('Result keys:', Object.keys(resp));
console.log('Renderable messages length:', resp.renderableMessages?.length);
console.log('First renderable:', resp.renderableMessages?.[0]);

