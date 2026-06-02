# Plan de Migración a WhatsApp Business API (Producción)

> Documento de referencia para migrar CronoCorte del Sandbox de Twilio a un número de WhatsApp real.
> Creado: Junio 2026. Aplicar durante la semana antes de abrir a clientes reales.

---

## ¿Por qué migrar?

El **Sandbox de Twilio** (número +14155238886) solo sirve para pruebas:
- Cada cliente debe enviar manualmente `join <código>` al número antes de recibir mensajes
- La sesión expira a las 24-72h, hay que re-activarla constantemente
- Inviable para clientes reales

Para producción se necesita un **WhatsApp Sender** propio registrado en la WhatsApp Business Platform.

---

## Modelo de cobro (pay-as-you-go, NO mensualidad)

Tres componentes de costo:

1. **Renta del número:** ~$1-2 USD/mes por tener el número de teléfono.
2. **Fee de Twilio:** desde $0.005 USD por mensaje enviado o recibido (markup de Twilio sobre Meta).
3. **Fee de Meta:** desde julio 2025 es por mensaje individual (antes era por conversación de 24h).

### Tipos de mensaje y su costo en CronoCorte
- **Confirmación de reserva + recordatorios 24h/1h** → plantillas de UTILIDAD (business-initiated). Costo bajo por mensaje.
- **Verificación de comprobante** → el cliente escribe primero (envía la foto), abre ventana de servicio → gratis o casi gratis.

### Estimación para Jamon Barber (~80 reservas/mes)
Costo total estimado: **unos pocos dólares USD al mes** (renta + mensajes de utilidad). Muy por debajo de los $15 USD de crédito trial ya disponibles.

---

## Requisitos

- **NO** se necesita la app de WhatsApp Business. Se usa la WhatsApp Business *Platform* (la API), que es distinto.
- Un **número de teléfono que NO tenga WhatsApp activo** (ni normal ni Business app). Si ya tiene WhatsApp, borrarlo primero o usar un número nuevo.
- Una **cuenta de Meta Business** (gratis, se crea en el proceso).

---

## DECISIÓN: usar chip prepago propio (NO comprar número en Twilio)

Benja usará un **chip físico prepago chileno** dedicado a la barbería, en su mismo teléfono (línea personal en eSIM + chip barbería físico). Ventajas:
- No se paga renta mensual de número a Twilio (~$1-3 USD/mes ahorrados)
- Número chileno real → más confianza para el cliente
- Separa lo personal del negocio

### Reglas críticas del chip
1. **NUNCA activar WhatsApp** (ni normal ni Business app) en el número de la barbería. Si se activa, hay que borrar esa cuenta antes de poder registrarlo en la API. Un número está en WhatsApp normal O en la API Business, nunca en ambos.
2. **Para el registro:** el chip debe estar en el teléfono para recibir el SMS/llamada de verificación de Twilio/Meta.
3. **Después del registro:** los mensajes de WhatsApp de clientes los maneja Twilio y los procesa la app (se ven en el dashboard de CronoCorte, NO llegan al teléfono). El chip solo es el "dueño" del número.
4. **Mantener el chip con saldo/activo** con recargas mínimas periódicas, por si Meta/Twilio piden re-verificación por SMS. Si el número se desactiva, se pierde la verificación y hay que re-registrar.

---

## Paso a paso

### 1. Salir del modo trial
En la consola de Twilio, hacer upgrade de la cuenta (se pueden usar los $15 USD de crédito). Esto habilita el registro de senders reales.

### 2. Crear un WhatsApp Sender
**Messaging → Senders → WhatsApp senders → Create new sender**

### 3. Conectar la Meta Business Account
Twilio pide vincular o crear una cuenta de Meta Business. El asistente redirige a Facebook/Meta para autorizar.

### 4. Registrar el número de teléfono
Elegir entre:
- Comprar un número nuevo en Twilio, o
- Usar un número propio sin WhatsApp activo (llega código de verificación por SMS o llamada)

### 5. Verificar el negocio con Meta
Meta pide datos del negocio (nombre, dirección, etc.). Para volúmenes bajos a veces no exige verificación completa de inmediato, pero conviene completarla para subir los límites de envío.

### 6. Crear plantillas de mensaje (REQUIERE CÓDIGO)
Los mensajes que la app inicia son "business-initiated" y necesitan plantillas pre-aprobadas por Meta.
**Messaging → Content Template Builder**. Crear plantillas para:
- Confirmación de reserva pendiente de pago
- Recordatorio 24h
- Recordatorio 1h

Aprobación: de minutos a unas horas por plantilla.

### 7. Actualizar el código (REQUIERE CÓDIGO)
- Cambiar `TWILIO_WHATSAPP_FROM` en Vercel por el número nuevo (formato `whatsapp:+569XXXXXXXX`)
- Adaptar los mensajes salientes en `notify/route.ts` y `cron/reminders/route.ts` para usar las plantillas aprobadas (ContentSid + ContentVariables) en lugar de texto libre

---

## Archivos a modificar en el paso 7

| Archivo | Qué cambiar |
|---------|-------------|
| Variable Vercel `TWILIO_WHATSAPP_FROM` | Nuevo número `whatsapp:+569XXXXXXXX` |
| `src/app/api/whatsapp/notify/route.ts` | Usar plantilla aprobada para confirmación de reserva |
| `src/app/api/cron/reminders/route.ts` | Usar plantillas aprobadas para recordatorios 24h y 1h |
| Configuración Sandbox de Twilio | El webhook entrante se mueve a la config del nuevo sender |

**Nota:** La verificación de comprobante (webhook entrante) NO necesita plantilla porque el cliente inicia la conversación. Solo cambia la URL del webhook a la config del nuevo sender.

---

## Importante: estructura de las plantillas

Las plantillas usan variables tipo `{{1}}`, `{{2}}` que se rellenan al enviar. Ejemplo para confirmación:

```
Hola {{1}}! Tu hora en {{2}} está pendiente de pago.
Servicio: {{3}} con {{4}}
Fecha: {{5}} a las {{6}}
Total: {{7}}
Envía tu comprobante para confirmar.
```

Al enviar desde el código se pasa el ContentSid de la plantilla aprobada + un objeto ContentVariables con los valores. Esto reemplaza el `Body` de texto libre actual.

---

## Estado actual (al crear este documento)

- Sandbox funcionando para pruebas
- Flujo completo probado y operativo: reservas individuales y grupales, verificación de pago con IA, recordatorios
- $15 USD de crédito trial disponibles
- Pendiente: ejecutar este plan para abrir a clientes reales
