export default function AlertMessage({ message, type = 'error' }) {
  if (!message) return null;
  
  // Accept either an object { tipo: 'error', texto: '...' } or string
  const alertType = message.tipo || type;
  const alertText = message.texto || message;

  return (
    <div className={`alert alert-${alertType}`}>
      {alertText}
    </div>
  );
}
