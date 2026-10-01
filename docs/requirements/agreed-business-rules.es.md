# Conecta Infusion: reglas de negocio acordadas

Estado: decisiones confirmadas durante la entrevista, registradas el 1 de octubre de 2026.
Documento principal: [intención del producto confirmada (en inglés)](../intent/conecta-infusion.md).
Idioma: **Español** | [English](agreed-business-rules.md).

Ambas versiones deben mantenerse equivalentes y actualizarse en el mismo cambio. Conservar la numeración, los ejemplos, las excepciones y las preguntas pendientes; ninguna traducción introduce decisiones nuevas.

Estos son requisitos para una implementación futura. Los ejemplos ilustran las reglas; no constituyen un catálogo completo ni demuestran que las funciones ya existan. Las correcciones explícitas posteriores de la entrevista sustituyen las suposiciones anteriores.

## 1. Estudio, idioma y configuración

- El estudio admite varias disciplinas, entre ellas yoga, ballet, entrenamiento funcional y K-pop.
- La administración crea la información de las clases que ven los clientes, incluidas descripciones, fotos y videos, y administra los horarios.
- El español es el idioma principal de la aplicación; el inglés estará disponible desde el inicio.
- La operación inicial será en México, con MXN. El país y la moneda deben poder configurarse a futuro; la compatibilidad real del proveedor de pagos con cada país se evaluará por separado.
- El cupo inicial es de 16 personas por clase, se guarda en la configuración de la aplicación y la administración puede modificarlo. Falta especificar los ajustes por sesión y su efecto en las clases ya programadas.
- El precio inicial de una clase individual es de 150 MXN y puede modificarlo la administración autorizada.
- La página pública de inicio, la navegación, el estilo visual y los diseños adaptables a distintos tamaños de pantalla se definirán en la siguiente etapa.

## 2. Separación financiera y cobro

- Las ventas, los gastos y los reportes financieros del estudio y de la cafetería se registran por separado.
- Cada área tiene una cuenta de cobro configurable de forma independiente. Al principio, ambas pueden utilizar la misma cuenta y después operar por separado.
- Los clientes pueden pagar en línea o en persona. Se comenzará con un proveedor de pagos en línea, en lugar de tres integraciones.
- Mercado Pago Checkout Pro es la recomendación de trabajo, no una decisión definitiva sobre el proveedor. PayPal y la aceptación directa de tarjetas se consideraron como alternativas.
- Los clientes sin créditos vigentes pueden consultar los horarios, pero no pueden reservar sin comprar una clase individual o un paquete.
- Para pagos en persona, el personal registra el pago y habilita los créditos correspondientes antes de realizar una reserva. Este requisito sustituye la idea anterior de reservar primero y pagar después.
- Aún no se especifican los flujos de registro de gastos, el detalle de los reportes financieros, los reembolsos, los impuestos ni la liquidación y conciliación de pagos.

## 3. Paquetes, valor de los créditos, vencimiento y selección

- Un crédito de clase puede utilizarse en cualquier disciplina; los paquetes no se restringen por disciplina.
- Los paquetes ofrecen precios por clase con descuento. Cada crédito conserva su valor de compra original para calcular el pago al instructor, incluso si se comparte o se extiende su vigencia.
- El paquete de entrada/prueba ofrece **tres clases por el precio de dos**. Esto corrige el ejemplo inicial de tres por una.
- Los créditos vencen a los 30 días.
- La compra de un paquete que permite renovar la vigencia, es decir, cualquiera excepto el de entrada/prueba, combina los créditos restantes aún vigentes con los nuevos y otorga al saldo combinado una nueva vigencia de 30 días desde la fecha de compra.
- La compra del paquete de entrada/prueba no extiende la vigencia de los créditos existentes.
- Los créditos vencidos no se recuperan automáticamente. El personal puede restablecerlos manualmente.
- La renovación modifica la fecha de vencimiento, no el valor monetario original de los créditos existentes.
- Al reservar, se utiliza primero el crédito que vence antes. Si las fechas de vencimiento coinciden, se utiliza primero el crédito comprado más antiguo.
- Los créditos deben estar vigentes en la fecha de la clase reservada, no solamente al hacer la reserva.
- La reserva aparta el crédito; la asistencia, la cancelación tardía o la inasistencia lo consumen según las reglas siguientes.

## 4. Reservas, cancelaciones y cupo

- Los clientes pueden reservar y cancelar desde la primera versión.
- Cancelar con al menos dos horas de anticipación libera el crédito apartado sin consumirlo.
- Cancelar con menos de dos horas de anticipación consume el crédito. La inasistencia también consume un crédito.
- Las excepciones especiales se atienden mediante ajustes manuales de créditos realizados por el personal.
- Una clase sin lugares disponibles sigue visible y aparece como Llena / Full; se deshabilitan las nuevas reservas.
- La primera versión no requiere lista de espera. Una cancelación que libera un lugar permite una nueva reserva.
- Los clientes pueden enviar comentarios privados al personal para solicitar sesiones adicionales de una clase llena.
- Una función posterior podría mostrar los horarios seleccionados por otros miembros. Su audiencia y funcionamiento detallado siguen pendientes; consultar la [incidencia #1](https://github.com/LFGJ-personal/ConectaInfusionApp/issues/1).

## 5. Créditos compartidos y salida del grupo familiar

- Cada integrante de la familia tiene su propia cuenta y puede reservar utilizando el saldo compartido de créditos familiares.
- Mientras un cliente pertenece a una familia, sus créditos se comparten automáticamente. Para dejar de compartirlos, debe salir del grupo familiar.
- Los créditos conservan la identidad del comprador, el valor original y el vencimiento.
- Un integrante que sale puede retirar únicamente sus propios créditos sin usar y sin reservar, o elegir dejarlos con la familia. No puede retirar créditos comprados por otra persona.
- Los integrantes que permanecen conservan el saldo familiar, sujeto a la decisión del comprador que sale.
- Si no quedan integrantes en la familia, los créditos regresan a sus compradores. Debe especificarse con precisión qué ocurre con los créditos que alguien decidió dejar previamente al grupo.
- Las reservas existentes siguen siendo válidas después de la salida. Los créditos apartados permanecen vinculados a esas reservas y no pueden retirarse de inmediato.
- Si una de esas reservas se cancela posteriormente a tiempo, el crédito liberado regresa al comprador que salió si eligió llevarse sus créditos; de lo contrario, permanece en el saldo familiar.
- Un crédito liberado conserva su valor monetario original y su fecha de vencimiento. Salir de la familia o cancelar una reserva no reinicia su vigencia.

## 6. Ajustes manuales e historial de auditoría

- Todo el personal puede ajustar créditos de clientes, incluidos el restablecimiento de créditos vencidos y las excepciones.
- Restablecer un crédito comprado conserva su valor monetario original para el pago al instructor.
- Al otorgar un crédito de cortesía, el personal especifica el valor que se utilizará para pagar al instructor, aunque el cliente no haya pagado nada.
- Los ajustes registran quién los realizó, cuándo, qué cambió, la cantidad y el motivo en el historial de transacciones y auditoría.
- Las acciones del personal deben ser rastreables: quién realizó la acción, cuándo y qué cambió. Esto incluye correcciones de asistencia o sesiones y registros de pagos.
- Los plazos específicos de conservación y el diseño del almacenamiento de auditoría se definirán en la especificación.

## 7. Ingresos de instructores y asistencia

- Los propietarios, gerentes o administradores asignan a cada instructor un porcentaje según su experiencia, certificaciones y acuerdo. Los porcentajes actuales son 40 %, 50 % o 60 %.
- El pago al instructor se calcula por separado para cada crédito consumido por un cliente, usando su propio valor monetario, y después se suman los importes. No existe un pago fijo por sesión independiente de los asistentes.
- El porcentaje del instructor no cambia según el número de asistentes; el total que recibe sí.
- Ejemplo: créditos de 150 + 150 + 120 + 135 + 135 MXN suman 690 MXN. Con un porcentaje del 50 %, el instructor recibe 345 MXN por esa sesión.
- Si la clase se lleva a cabo, los créditos consumidos por asistencia, cancelación tardía e inasistencia generan ingresos para el instructor.
- Las cancelaciones a tiempo no generan ingresos para el instructor.
- Tanto los instructores como la administración pueden registrar asistencia y marcar una sesión como completada.
- La administración puede corregir los registros de asistencia y finalización. Los cambios se auditan.
- Los ingresos deben poder explicarse a partir de los créditos utilizados y sus valores, sin recalcular a todos los asistentes con el precio actual de la clase individual.

## 8. Nómina y confirmación de pago

- La nómina se calcula dos veces al mes: el día 15 y el último día del mes, no cada 14 días.
- La aplicación calcula los importes pendientes; la administración paga a los instructores fuera de la aplicación mediante su método habitual.
- La administración registra el importe, la fecha y el método de pago. El instructor confirma que lo recibió desde su propia cuenta.
- Tanto el registro del pago como su confirmación conservan fecha y hora en el historial, evitando depender de WhatsApp como único registro de confirmación.
- Los instructores pueden consultar sus propios ingresos e historial de pagos, incluidos los detalles y el estado de confirmación.
- Los pagos automáticos a instructores quedan fuera del alcance; no se promete su implementación futura.
- Falta especificar las horas de corte de los periodos, el cierre y aprobación, el redondeo y las correcciones posteriores al pago.

## 9. Permisos y visibilidad

| Rol o audiencia | Permisos y visibilidad confirmados |
| --- | --- |
| Propietario / administrador / gerente | Cambiar precios, asignar porcentajes a instructores, consultar las finanzas de ambas áreas y toda la nómina, registrar pagos a instructores y corregir registros de asistencia o sesiones |
| Todo el personal | Ajustar créditos con registro de auditoría; los demás permisos dependen de su función operativa |
| Recepción / personal de cafetería | Acceder a las reservas, pagos o ventas de cafetería necesarios para sus tareas diarias; no a todos los reportes financieros ni a la nómina de todos |
| Instructor | Clases asignadas, asistencia y finalización, ingresos propios, historial de pagos propio y confirmación de pagos recibidos; no a los ingresos privados de otros instructores |
| Cliente | Reservas propias e información pertinente de su cuenta, saldo familiar compartido cuando corresponda; no a la información financiera del personal |

La matriz exacta de permisos, los usuarios con varios roles, los permisos para invitar familiares y los roles que administran cada tipo de contenido se definirán en la especificación. Esta tabla no otorga acceso financiero ilimitado a todo el personal.

## 10. Cafetería

- La administración mantiene el catálogo, los precios y los paquetes o combos con descuento.
- Los paquetes de cafetería son descuentos sobre productos comprados juntos en una misma venta, no créditos prepagados para canjear en varias visitas.
- El personal registra ventas y pagos para contar con un historial financiero de la cafetería desde la primera versión.
- Solo los propietarios, administradores y gerentes pueden cambiar precios; el personal de cafetería puede realizar las operaciones de venta que tenga autorizadas.
- El inventario de ingredientes se agregará posteriormente.
- Los paquetes que combinen productos de cafetería y clases del estudio son una posibilidad futura, fuera de la primera versión.

## 11. Detalles por resolver durante la especificación

Estas preguntas no invalidan la intención confirmada y no deben resolverse de forma implícita durante la implementación:

- Contenido de la página pública de inicio, identidad visual, pantallas detalladas, gestión de medios y flujo de traducción.
- Registro de cuentas, autenticación, creación de familias e invitaciones, menores de edad y manejo de créditos cedidos previamente cuando se cierra un grupo.
- Cálculo exacto de la vigencia de 30 días, zona horaria y horas de corte, y qué créditos se renuevan al comprar dentro de una familia, incluidos los ya reservados.
- Vencimiento de créditos restablecidos, excepciones por cancelación tardía y créditos liberados cuya fecha de vencimiento original ya pasó.
- Selección del proveedor, conexión de cuentas, confirmaciones y fallos de pago, reembolsos y conciliación financiera.
- Anticipación máxima para reservar, recurrencia de horarios, sustitución de instructores, sesiones canceladas por el estudio y si una sesión sin asistentes cuenta como realizada para efectos de nómina.
- Catálogo de paquetes, requisitos y límites de recompra del paquete de entrada/prueba, y distribución del precio de un paquete entre sus créditos cuando no se divide de forma exacta.
- Fechas de aplicación de cambios de porcentaje de instructores, redondeo, límites de los periodos de nómina y ajustes después de confirmar o pagar la nómina.
- Alcance del registro de gastos y reportes, y flujos de corrección o reembolso de ventas de cafetería.
- Despliegue, criterios de accesibilidad, indicadores numéricos de éxito y una posible migración desde el otro sistema de la propietaria.
